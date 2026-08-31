'use strict';

const jsongin = require( '@liquicode/jsongin' );
const SUPPORT = require( './TranslatorSupport' )();

/*
	Builds a SQL WHERE clause from a jsonstor criteria.

	***This clause is a pre-filter and not the row filter.*** Every adapter which uses it
	(only jsonstor-mysql today) hands each returned row to jsongin.Query with the same
	criteria, so the statement decides how many rows travel and jsongin decides which ones
	match. jsonstor-mysql/SQL_Query says as much: "Do the actual query filtering here."

	***So the one invariant is: never render a clause which excludes a row the criteria
	would match.*** Returning too many rows costs time. Returning too few returns a wrong
	answer that nothing downstream can correct. When a condition cannot be rendered - an
	operand type SQL cannot carry, a field the caller did not allow - it is left out and
	the result broadens. That is why so much of this file drops rather than throws.

	***The trap is a logical operator, where dropping a child is not the same as
	broadening.*** Dropping an always true child of $or narrows the clause to its
	remaining children, which loses rows. $and is the only operator for which dropping a
	child is safe.

	***The other trap is three-valued logic.*** SQL answers UNKNOWN where a criteria answers
	false, and the two stop being interchangeable the moment a negation is involved: NOT
	UNKNOWN is UNKNOWN, so `NOT (field >= 0)` drops every row whose column is NULL - exactly
	the rows the criteria keeps, because an absent field does not match the condition being
	negated. A NULL also poisons an IN list, where `2 IN (10, NULL)` is UNKNOWN rather than
	false. Every negation in this file goes through negate(), and every IN list has its nulls
	taken out and asked about separately.

	***Which operators are rendered, and why the rest are not, is recorded in one place:***
	`docs/data/sql-predicates.js` in jsonstor-docs.git. It lists SQL's predicate vocabulary
	against jsongin's query operators, and `SqlExpression Parity.js` measures every rendering
	below against a live MySQL server. A rendering added here without a row there fails that
	suite.
*/

module.exports = function ( jsonstor )
{

	//---------------------------------------------------------------------
	function get_operation_expression( Operator, Value, Options )
	{
		if ( !'bnsla'.includes( jsongin.ShortType( Value ) ) ) { return null; }
		// Only IN takes a list. Every other operator compares against a single value, and
		// an array operand renders as a row constructor - `field = (1, 2)` - which MySQL
		// refuses outright with "Operand should contain 1 column(s)".
		if ( ( jsongin.ShortType( Value ) === 'a' ) && ( Operator !== 'IN' ) ) { return null; }
		if ( jsongin.ShortType( Options ) !== 'o' ) { throw new Error( `The Options parameter must be an object.` ); }
		// ***An engine which throws on a type mismatch is asked nothing it would throw about.***
		// Every field-against-operand comparison in this file arrives here, so this is the one
		// place the check has to be. It drops the condition the same way an unrenderable operand
		// does, which broadens - the safe direction, and the only one available: a statement
		// which errors returns no rows to filter afterwards.
		//
		// Off by default, so MySQL and SQLite render exactly what they rendered before. See
		// apply_defaults for why their coercion makes the looser reading correct for them.
		if ( Options.RefusesTypeMismatch )
		{
			if ( !operand_type_agrees( Value, Options ) ) { return null; }
		}
		// The value is rendered first. A value SQL cannot carry renders as nothing, and the
		// condition is dropped rather than emitted with an empty or malformed operand.
		let value_expr = render( Value, Options );
		if ( !value_expr ) { return null; }
		let expr = '';
		if ( Options.FieldName )
		{
			expr += `${Options.IdentifierQuotes}${Options.FieldName}${Options.IdentifierQuotes} `;
		}
		if ( Operator )
		{
			expr += Operator + ' ';
		}
		expr += value_expr;
		return expr;
	}


	//---------------------------------------------------------------------
	function get_field_reference( Options )
	{
		if ( !Options.FieldName ) { return ''; }
		return `${Options.IdentifierQuotes}${Options.FieldName}${Options.IdentifierQuotes}`;
	}


	//---------------------------------------------------------------------
	// ***The target-agnostic half, which lives in jsonstor rather than here.***
	//
	// These ask about the shape of a criteria and about the field allowlist, and mention no
	// SQL at all - so they are the same questions a Mango or a DynamoDB translator has to
	// ask. They kept their local names here, so every call site below reads as it did.
	const is_operator_object = SUPPORT.IsOperatorObject;
	const field_is_projection = SUPPORT.FieldIsProjection;
	const criteria_names_projection = SUPPORT.CriteriaNamesProjection;
	const operand_type_agrees = SUPPORT.OperandTypeAgrees;
	const split_null_values = SUPPORT.SplitNullValues;


	//---------------------------------------------------------------------
	// Negates a rendered condition without losing the rows SQL calls UNKNOWN.
	//
	// A plain NOT is not the negation this file needs. NOT UNKNOWN is UNKNOWN, so `NOT (n >= 0)`
	// drops every row whose column is NULL - and the criteria keeps those rows, because a field
	// which is absent or null does not match the condition being negated. IS NOT TRUE answers
	// true for both false and unknown, which is exactly the question. Measured against MySQL
	// 8.0.41: NULL IS NOT TRUE is 1, 0 IS NOT TRUE is 1, 1 IS NOT TRUE is 0.
	//
	// The Expression is expected to arrive parenthesized.
	function negate( Expression, Options )
	{
		if ( Options.NegateWithIsNotTrue ) { return `(${Expression} IS NOT TRUE)`; }
		// The portable spelling, and the default. It says the same thing at the cost of naming
		// the expression twice, and every engine has it.
		return `((NOT ${Expression}) OR ${Expression} IS NULL)`;
	}


	//---------------------------------------------------------------------
	// Broadens a condition on a column which only mirrors the stored value.
	//
	// ***An AllowedFields entry marked is_projection is an index, not the value.*** An adapter
	// which keeps the document in a payload column writes each projected column as a copy, and
	// writes NULL where the value did not fit - a number into a text column, an array into any
	// of them. The row is still there and its real value is still in the payload, so a bare
	// `col = x` excludes exactly the rows the payload would have answered for, and the payload
	// is never reached because the row never travels.
	//
	// The rows `IS NULL` admits are precisely those rows, so this keeps the invariant by
	// construction at the cost of one disjunct. See jsonx/.plans/sql-adapter-architecture.md,
	// rule F4.
	function broaden_projection( Expression, Options )
	{
		if ( !Expression ) { return Expression; }
		if ( !field_is_projection( Options.FieldName, Options ) ) { return Expression; }
		return `(${Expression} OR ${get_field_reference( Options )} IS NULL)`;
	}


	//---------------------------------------------------------------------
	// The bitmask a $bits* operand asks about, as a decimal string, or null when it is an
	// operand this clause cannot ask about.
	//
	// jsongin accepts either a bitmask, which names its bits directly, or an array of bit
	// positions counted from the least significant. It reads them in unbounded BigInt, and
	// MySQL computes a bitwise operation in 64 unsigned bits - so a mask which does not fit is
	// a question with an answer there and none here, and the condition drops.
	function get_bit_mask( Value )
	{
		const LARGEST = 18446744073709551615n;
		let mask = 0n;
		let short_type = jsongin.ShortType( Value );
		if ( short_type === 'n' )
		{
			if ( !Number.isInteger( Value ) ) { return null; }
			if ( Value < 0 ) { return null; }
			mask = BigInt( Value );
		}
		else if ( short_type === 'a' )
		{
			for ( let index = 0; index < Value.length; index++ )
			{
				let position = Value[ index ];
				if ( jsongin.ShortType( position ) !== 'n' ) { return null; }
				if ( !Number.isInteger( position ) ) { return null; }
				if ( position < 0 ) { return null; }
				if ( position > 63 ) { return null; }
				mask = mask | ( 1n << BigInt( position ) );
			}
		}
		else { return null; }
		if ( mask > LARGEST ) { return null; }
		return mask.toString();
	}


	//---------------------------------------------------------------------
	// A LIKE pattern for a $regex operand, or null when the pattern is not plain text.
	//
	// Only a pattern whose body is literal can become a LIKE. A character class, a quantifier,
	// an alternation - none has a LIKE form, and guessing at one would miss rows the regex
	// matches. A leading ^ and a trailing $ are read as anchors and decide which ends of the
	// pattern get a wildcard.
	function get_like_pattern( Value, RegExpOptions, Options )
	{
		let source = '';
		let flags = '';
		let short_type = jsongin.ShortType( Value );
		if ( short_type === 'r' ) { source = Value.source; flags = Value.flags; }
		else if ( short_type === 's' ) { source = Value; }
		else { return null; }
		if ( jsongin.ShortType( RegExpOptions ) === 's' ) { flags += RegExpOptions; }

		// ***The one flag which can narrow.*** LIKE is case insensitive under a default
		// collation and case sensitive under a binary one, and this file cannot see which the
		// column has. A case sensitive pattern is safe under either - it admits the same rows
		// under a binary collation and more under a default one - so only the i flag is refused.
		if ( flags.includes( 'i' ) ) { return null; }
		// Both of these change what ^ and $ mean, which is what the anchors below are read as.
		if ( flags.includes( 'm' ) ) { return null; }
		if ( flags.includes( 's' ) ) { return null; }

		let anchored_start = false;
		let anchored_end = false;
		if ( source.startsWith( '^' ) ) { anchored_start = true; source = source.slice( 1 ); }
		if ( source.endsWith( '$' ) ) { anchored_end = true; source = source.slice( 0, -1 ); }
		if ( !source.length ) { return null; }
		// Anything left which is a regular expression metacharacter means this is not plain
		// text. A backslash is in the list, so the literal below cannot contain one.
		if ( /[\\^$.*+?()[\]{}|]/.test( source ) ) { return null; }

		// % and _ are LIKE's own wildcards, so a literal one of either has to be escaped on the
		// way into the pattern.
		//
		// ***Which character does that is the dialect's to say, and some dialects have none.***
		// MySQL escapes with a backslash by default. SQLite has no default at all, so there an
		// unescaped pattern reads \% as a literal backslash followed by the wildcard and drops
		// the very row the criteria matches - which is the one direction this file may never
		// go. An empty LikeEscapeCharacter says the dialect cannot ask this question, and the
		// pattern is refused so that jsongin answers it instead.
		let escape_character = Options.LikeEscapeCharacter;
		let needs_escape = ( source.includes( '%' ) || source.includes( '_' ) );
		if ( needs_escape && !escape_character ) { return null; }
		let literal = source.split( '%' ).join( escape_character + '%' );
		literal = literal.split( '_' ).join( escape_character + '_' );

		let pattern = literal;
		if ( !anchored_start ) { pattern = '%' + pattern; }
		if ( !anchored_end ) { pattern = pattern + '%'; }
		return pattern;
	}


	//---------------------------------------------------------------------
	// One operand of an $expr comparison: a field reference or a scalar number.
	//
	// ***A field is only rendered when the catalog says its column holds a number.*** jsongin
	// orders values of different types by their BSON type where SQL coerces them, so a
	// comparison of two columns of different types can disagree in either direction - and one
	// of those directions loses rows.
	function get_expression_operand( Operand, Options )
	{
		if ( ( jsongin.ShortType( Operand ) === 's' ) && Operand.startsWith( '$' ) )
		{
			let name = Operand.slice( 1 );
			if ( !name ) { return null; }
			if ( !Options.AllowedFields ) { return null; }
			let field = Options.AllowedFields[ name ];
			if ( !field ) { return null; }
			if ( field.short_type !== 'n' ) { return null; }
			return `${Options.IdentifierQuotes}${name}${Options.IdentifierQuotes}`;
		}
		if ( jsongin.ShortType( Operand ) !== 'n' ) { return null; }
		return '' + Operand;
	}


	//---------------------------------------------------------------------
	// An $expr comparison of two operands, or null.
	//
	// Only the one shape SQL answers natively. jsongin's $expr also carries arithmetic, string,
	// date and conditional operators, and none of those is attempted: the condition drops and
	// the result broadens, which is what the invariant asks for.
	function get_expression_comparison( Value, Options )
	{
		const COMPARISONS = { $eq: '=', $ne: '<>', $lt: '<', $lte: '<=', $gt: '>', $gte: '>=' };
		if ( jsongin.ShortType( Value ) !== 'o' ) { return null; }
		let keys = Object.keys( Value );
		if ( keys.length !== 1 ) { return null; }
		let operator = COMPARISONS[ keys[ 0 ] ];
		if ( !operator ) { return null; }
		let operands = Value[ keys[ 0 ] ];
		if ( jsongin.ShortType( operands ) !== 'a' ) { return null; }
		if ( operands.length !== 2 ) { return null; }
		let left = get_expression_operand( operands[ 0 ], Options );
		if ( left === null ) { return null; }
		let right = get_expression_operand( operands[ 1 ], Options );
		if ( right === null ) { return null; }
		return `(${left} ${operator} ${right})`;
	}


	//---------------------------------------------------------------------
	function get_expression_array( Values, Options )
	{
		if ( jsongin.ShortType( Values ) !== 'a' ) { return null; }
		if ( jsongin.ShortType( Options ) !== 'o' ) { throw new Error( `The Options parameter must be an object.` ); }
		if ( Values.length === 0 ) { return null; }
		let expressions = [];
		for ( let index = 0; index < Values.length; index++ )
		{
			// An empty rendering is kept rather than skipped. It means the condition places
			// ***no constraint on the statement*** - either because it is always true, or
			// because nothing about it could be rendered - and only the operator holding it
			// knows what that implies. Skipping it here made { $or: [ {}, { a: 1 } ] }
			// render as ((a = 1)), which returns fewer rows than the criteria matches.
			expressions.push( render( Values[ index ], Options ) );
		}
		return expressions;
	}


	//---------------------------------------------------------------------
	// Fills in every option the renderer reads. ***Called once, at the entry point.***
	//
	// ***This used to run at every node of the criteria tree.*** The renderer cloned and
	// re-defaulted its options on each recursive call, which was wasteful and - the reason
	// it had to go - a hard blocker on a function valued option. jsongin.Clone is
	// JSON.parse( JSON.stringify() ), which ***silently drops a function***, so a renderer
	// an adapter injected would have been deleted on the way in with no error at all.
	// Defaulting once, with a shallow copy, is what lets an adapter supply a rendering
	// rather than only a scalar. Nothing below here mutates an option except FieldName,
	// which is set on a per field copy - see the object case.
	//
	// ***Where the engines disagree, and what each adapter is asked to declare.***
	//
	// These were a single `Options.Dialect === 'mysql'` branch until a second SQL adapter
	// arrived and turned it into a fork. An adapter now declares what its own platform
	// does differently and says nothing about the rest.
	//
	// ***Every default below is the answer which is safe on every engine.*** That is the
	// rule which makes the next adapter cheap: an option added later for some future
	// dialect can only cost an existing adapter a rendering it never had, and can never
	// narrow a clause behind its back - which is the one direction the pre-filter
	// invariant forbids. ***Declaring nothing is always correct, and merely slow.***
	//
	// See jsonx/.plans/sql-adapter-architecture.md, The Dialect Interface.
	function apply_defaults( Options )
	{
		let options = Object.assign( {}, Options );
		if ( typeof options.StringLiteralQuotes === 'undefined' ) { options.StringLiteralQuotes = '"'; }
		if ( typeof options.IdentifierQuotes === 'undefined' ) { options.IdentifierQuotes = ''; }
		if ( typeof options.AllowedFields === 'undefined' ) { options.AllowedFields = null; }
		if ( typeof options.FieldName === 'undefined' ) { options.FieldName = ''; }

		// How a string literal escapes its own quote. 'double' doubles the quote and leaves a
		// backslash alone, which is standard SQL and what SQLite and Postgres read. MySQL
		// reads a backslash as an escape character and needs 'backslash'.
		if ( typeof options.StringLiteralEscape === 'undefined' ) { options.StringLiteralEscape = 'double'; }
		// The character which escapes a literal % or _ inside a LIKE pattern. Empty means the
		// dialect offers none, and a pattern needing one is refused rather than rendered wrong.
		if ( typeof options.LikeEscapeCharacter === 'undefined' ) { options.LikeEscapeCharacter = ''; }
		// Whether a rendered LIKE names its escape character with an ESCAPE clause.
		if ( typeof options.LikeEscapeClause === 'undefined' ) { options.LikeEscapeClause = false; }
		// Whether the engine has IS NOT TRUE. See negate().
		if ( typeof options.NegateWithIsNotTrue === 'undefined' ) { options.NegateWithIsNotTrue = false; }
		// Whether $mod renders. Neither MOD() nor TRUNCATE() is universal, and the truncation
		// is load bearing rather than cosmetic - see the $mod case.
		if ( typeof options.RendersModulo === 'undefined' ) { options.RendersModulo = false; }
		// Whether the four $bits* operators render.
		if ( typeof options.RendersBitwise === 'undefined' ) { options.RendersBitwise = false; }
		// ***Whether this engine refuses a comparison whose operand is not the column's type.***
		// Coercion is dialect behavior rather than SQL behavior, and the three engines here do
		// three different things with `size = 'not-a-number'` against an integer column: MySQL
		// coerces, SQLite applies affinity, and ***Postgres throws***. The first two only admit
		// or exclude rows, which is why operand_type_agrees guards the negating comparisons
		// alone - those are the ones with rows to lose. A thrown statement is a different
		// failure: it returns no answer at all rather than a broad one.
		//
		// So an engine which refuses says so, and every comparison it renders is checked rather
		// than only the negating ones. The default is the tolerant reading, which is what MySQL
		// and SQLite have always done and leaves both unchanged. See
		// jsonx/.plans/sql-adapter-architecture.md, The Dialect Interface.
		if ( typeof options.RefusesTypeMismatch === 'undefined' ) { options.RefusesTypeMismatch = false; }
		return options;
	}


	//---------------------------------------------------------------------
	// ***The public entry point, and the only one.*** The recursive renderer below is
	// internal: it returns a bare string and assumes its options are already defaulted.
	//
	// ***Object in, object out, so every later addition is additive.*** A named field can
	// join either side without touching a caller, which is what lets the sort, projection
	// and limit half of the seam be shaped now and implemented later.
	//
	// Returns:
	//
	//   Pushdown   The WHERE clause, as a string. ***Opaque to jsonstor*** - only the
	//              adapter which chose this translator gives it meaning. Empty means the
	//              criteria could not be narrowed at all and every row must travel.
	//   Residual   The part of the criteria the pushdown does not decide ***exactly***,
	//              which the adapter must still put to jsongin.Query. See below.
	//   *Absorbed  Whether the translator took responsibility for that part of the query.
	//              All false here: only the criteria is implemented.
	function Translate( Request )
	{
		if ( jsongin.ShortType( Request ) !== 'o' ) { throw new Error( `The Request parameter must be an object.` ); }
		let options = apply_defaults( Request.Options );
		return {
			Pushdown: render( Request.Criteria, options ),
			// ***The residual is the whole criteria, and that is the honest answer today.***
			// The clause is a pre-filter and jsongin.Query is the row filter. Until a
			// rendering can report that it decided a condition ***exactly*** - which is not
			// the same as having rendered it, because a projected column is broadened on
			// purpose - the honest answer is that it decided none of them. Returning less
			// than this would narrow an answer, which is the one direction the invariant
			// forbids. Reducing it is an optimization, and it has to be earned per operator.
			Residual: Request.Criteria,
			// The seam is shaped for the whole query; only the criteria is implemented. An
			// adapter reads these to learn it must still sort, project and limit itself.
			SortAbsorbed: false,
			ProjectionAbsorbed: false,
			LimitAbsorbed: false,
		};
	}


	//---------------------------------------------------------------------
	// The recursive renderer. Internal - see Translate.
	function render( Criteria, options )
	{


		switch ( jsongin.ShortType( Criteria ) )
		{

			//---------------------------------------------------------------------
			//  Values
			//---------------------------------------------------------------------

			case 'b':
				if ( Criteria === true ) { return 'TRUE'; }
				else if ( Criteria === false ) { return 'FALSE'; }
				else { throw new Error( `SqlExpression: Internal error 101` ); }
				break;
			case 'n':
				return '' + Criteria;
				break;
			case 's':
				{
					// ***This is the one place a caller's text reaches the statement
					// unparameterized***, so how a dialect escapes its own quote is not a detail.
					//
					// Both spellings use split/join because String.replace with a string pattern
					// replaces only the ***first*** occurrence. A value holding two quotes closed
					// its literal early and MySQL answered ER_PARSE_ERROR; a value holding a
					// backslash was worse, because "a\b" is an 'a' and a backspace to MySQL and
					// the statement ran and matched the wrong rows.
					let text = Criteria;
					if ( options.StringLiteralEscape === 'backslash' )
					{
						// ***The escape character goes first.*** Escaping the quotes first would
						// double the backslashes that escaping introduced.
						text = text.split( '\\' ).join( '\\\\' );
						text = text.split( options.StringLiteralQuotes ).join( '\\' + options.StringLiteralQuotes );
					}
					else
					{
						// Standard SQL, and what SQLite and Postgres read. A backslash is an
						// ordinary character here, and doubling it would store two.
						text = text.split( options.StringLiteralQuotes ).join( options.StringLiteralQuotes + options.StringLiteralQuotes );
					}
					return `${options.StringLiteralQuotes}${text}${options.StringLiteralQuotes}`;
				}
				break;
			case 'l':
				return 'NULL';
				break;
			case 'a':
				{
					// An empty list renders as `()`, which is a syntax error rather than a constraint.
					if ( Criteria.length === 0 ) { return ''; }
					let expressions = [];
					for ( let index = 0; index < Criteria.length; index++ )
					{
						// An element SQL cannot carry cannot be listed, so the whole condition is
						// dropped and the result broadens.
						if ( !'bnsl'.includes( jsongin.ShortType( Criteria[ index ] ) ) ) { return ''; }
						expressions.push( render( Criteria[ index ], options ) );
					}
					let expr = '(' + expressions.join( ', ' ) + ')';
					return expr;
				}
				break;

			//---------------------------------------------------------------------
			//  More Criteria
			//---------------------------------------------------------------------

			case 'o':
				{
					let expressions = [];
					for ( let key in Criteria )
					{
						let value = Criteria[ key ];
						if ( key.startsWith( '$' ) )
						{
							// Key is an operator.
							switch ( key )
							{
								case '$and':
									{
										if ( jsongin.ShortType( value ) !== 'a' ) { throw new Error( `SqlExpression: The operator [${key}] must be followed by an array.` ); }
										let sub_expressions = get_expression_array( value, options );
										if ( !sub_expressions ) { throw new Error( `SqlExpression: The operator [${key}] requires a non-empty array of criteria.` ); }
										// AND TRUE is the identity, so an always true condition is dropped.
										// If every condition was always true the whole clause constrains
										// nothing and contributes nothing.
										let terms = sub_expressions.filter( function ( Text ) { return Text !== ''; } );
										if ( !terms.length ) { continue; }
										let expr = '';
										if ( terms.length === 1 ) { expr = terms[ 0 ]; }
										else { expr = terms.join( ' AND ' ); }
										expressions.push( `(${expr})` );
									}
									break;
								case '$or':
									{
										if ( jsongin.ShortType( value ) !== 'a' ) { throw new Error( `SqlExpression: The operator [${key}] must be followed by an array.` ); }
										let sub_expressions = get_expression_array( value, options );
										if ( !sub_expressions ) { throw new Error( `SqlExpression: The operator [${key}] requires a non-empty array of criteria.` ); }
										// OR TRUE is TRUE, so one always true condition makes the whole
										// clause unconstraining. It contributes nothing to the enclosing
										// AND - which is not the same as dropping the condition and
										// keeping its neighbours, which is what used to happen.
										if ( sub_expressions.indexOf( '' ) >= 0 ) { continue; }
										let expr = '';
										if ( sub_expressions.length === 1 ) { expr = sub_expressions[ 0 ]; }
										else { expr = sub_expressions.join( ' OR ' ); }
										expressions.push( `(${expr})` );
									}
									break;
								case '$nor':
									{
										if ( jsongin.ShortType( value ) !== 'a' ) { throw new Error( `SqlExpression: The operator [${key}] must be followed by an array.` ); }
										let sub_expressions = get_expression_array( value, options );
										if ( !sub_expressions ) { throw new Error( `SqlExpression: The operator [${key}] requires a non-empty array of criteria.` ); }
										// A child which rendered nothing is either always true or merely not
										// renderable, and the two are indistinguishable here. FALSE would be right
										// for the first and would wrongly narrow the result for the second, so the
										// whole clause is dropped and the result broadens instead.
										if ( sub_expressions.indexOf( '' ) >= 0 ) { continue; }
										// A projected column cannot be negated. See criteria_names_projection.
										if ( !options.FieldName && criteria_names_projection( value, options ) ) { continue; }
										let expr = '';
										if ( sub_expressions.length === 1 ) { expr = sub_expressions[ 0 ]; }
										else { expr = sub_expressions.join( ' OR ' ); }
										// Through negate(), because a plain NOT drops every row whose columns
										// are NULL - the disjunction is UNKNOWN there, not false.
										expressions.push( negate( `(${expr})`, options ) );
									}
									break;
								case '$not':
									{
										// A field level $not is negated inside the broadening applied where the
										// field is pushed, so only the top level form has to be dropped.
										if ( !options.FieldName && criteria_names_projection( value, options ) ) { continue; }
										let expr = render( value, options );
										// An empty operand renders nothing and the clause is left out, broadening
										// the result. MongoDB refuses this criteria outright; jsongin is the one that
										// gets to say so, not the statement builder.
										if ( !expr ) { continue; }
										expressions.push( negate( expr, options ) );
									}
									break;
								case '$eq':
								case '$eqx':
									{
										// SQL has no value which is equal to NULL, so `field = NULL` matches nothing
										// while the criteria matches every row whose field is null or absent. IS NULL
										// is the faithful rendering, and an absent field is a NULL column here.
										if ( jsongin.ShortType( value ) === 'l' )
										{
											let field_ref = get_field_reference( options );
											if ( !field_ref ) { continue; }
											expressions.push( `(${field_ref} IS NULL)` );
											break;
										}
										let expr = get_operation_expression( '=', value, options );
										// The operand is a type SQL cannot carry, so this condition is left out of the
										// statement and the caller sees a broader result. See the note at the top.
										if ( !expr ) { continue; }
										expressions.push( `(${expr})` );
									}
									break;
								case '$ne':
								case '$nex':
									{
										// The mirror of $eq. `field <> NULL` is never true, and for a real operand SQL
										// drops every row whose field is NULL - which the criteria keeps, because an
										// absent field is not equal to anything. Those rows are added back by name.
										let field_ref = get_field_reference( options );
										if ( jsongin.ShortType( value ) === 'l' )
										{
											if ( !field_ref ) { continue; }
											expressions.push( `(${field_ref} IS NOT NULL)` );
											break;
										}
										// jsongin compares by type where SQL coerces, and this is one of the two
										// comparisons where that disagreement loses rows rather than adding them.
										if ( !operand_type_agrees( value, options ) ) { continue; }
										let expr = get_operation_expression( '<>', value, options );
										if ( !expr ) { continue; }
										if ( !field_ref ) { expressions.push( `(${expr})` ); }
										else { expressions.push( `((${expr}) OR ${field_ref} IS NULL)` ); }
									}
									break;
								case '$lt':
									{
										// A comparison against null is not an ordering question - the criteria selects
										// null and absent fields - and SQL answers UNKNOWN, dropping exactly the rows
										// which should have been kept. It is left out and the result broadens.
										if ( jsongin.ShortType( value ) === 'l' ) { continue; }
										let expr = get_operation_expression( '<', value, options );
										// The operand is a type SQL cannot carry, so this condition is left out of
										// the statement and the caller sees a broader result. That is safe: the row
										// filter is jsongin, not the WHERE clause. See the note at the top.
										if ( !expr ) { continue; }
										expressions.push( `(${expr})` );
									}
									break;
								case '$lte':
									{
										// A comparison against null is not an ordering question - the criteria selects
										// null and absent fields - and SQL answers UNKNOWN, dropping exactly the rows
										// which should have been kept. It is left out and the result broadens.
										if ( jsongin.ShortType( value ) === 'l' ) { continue; }
										let expr = get_operation_expression( '<=', value, options );
										if ( !expr ) { continue; }
										expressions.push( `(${expr})` );
									}
									break;
								case '$gt':
									{
										// A comparison against null is not an ordering question - the criteria selects
										// null and absent fields - and SQL answers UNKNOWN, dropping exactly the rows
										// which should have been kept. It is left out and the result broadens.
										if ( jsongin.ShortType( value ) === 'l' ) { continue; }
										let expr = get_operation_expression( '>', value, options );
										if ( !expr ) { continue; }
										expressions.push( `(${expr})` );
									}
									break;
								case '$gte':
									{
										// A comparison against null is not an ordering question - the criteria selects
										// null and absent fields - and SQL answers UNKNOWN, dropping exactly the rows
										// which should have been kept. It is left out and the result broadens.
										if ( jsongin.ShortType( value ) === 'l' ) { continue; }
										let expr = get_operation_expression( '>=', value, options );
										if ( !expr ) { continue; }
										expressions.push( `(${expr})` );
									}
									break;
								case '$in':
									{
										if ( jsongin.ShortType( value ) !== 'a' ) { continue; }
										let field_ref = get_field_reference( options );
										// A NULL in the list makes every comparison against it UNKNOWN, so the nulls
										// are taken out and asked about with IS NULL instead.
										let split = split_null_values( value );
										if ( !split.Values.length )
										{
											// The list named nothing but nulls, so it asks only about nullness. A NULL
											// column satisfies it, and so does an absent field.
											if ( !field_ref ) { continue; }
											if ( !split.HasNull ) { continue; }
											expressions.push( `(${field_ref} IS NULL)` );
											break;
										}
										let expr = get_operation_expression( 'IN', split.Values, options );
										if ( !expr ) { continue; }
										// A NULL column satisfies no IN list, so a list which named null needs those
										// rows added back explicitly.
										if ( field_ref && split.HasNull ) { expressions.push( `((${expr}) OR ${field_ref} IS NULL)` ); }
										else { expressions.push( `(${expr})` ); }
									}
									break;
								case '$nin':
									{
										if ( jsongin.ShortType( value ) !== 'a' ) { continue; }
										let field_ref = get_field_reference( options );
										let split = split_null_values( value );
										// A list of nothing but nulls asks that the field not be null, which the
										// criteria also refuses for an absent field. There is no rendering which is a
										// superset of that and still constrains anything, so it is left out.
										if ( !split.Values.length ) { continue; }
										// The other one. NOT IN over a coerced comparison drops the rows jsongin keeps,
										// because a value of a different type is in no list as far as jsongin is concerned.
										if ( !operand_type_agrees( split.Values, options ) ) { continue; }
										let expr = get_operation_expression( 'IN', split.Values, options );
										if ( !expr ) { continue; }
										// NOT IN is UNKNOWN for a NULL column, so SQL drops those rows while the
										// criteria keeps them - an absent field is in no list.
										if ( !field_ref ) { expressions.push( `(NOT (${expr}))` ); }
										else { expressions.push( `((NOT (${expr})) OR ${field_ref} IS NULL)` ); }
									}
									break;
								case '$exists':
									{
										let field_ref = get_field_reference( options );
										if ( !field_ref ) { continue; }
										// The value is coerced to a boolean, the way MongoDB and jsongin coerce it,
										// so { $exists: 1 } asks the same question as { $exists: true }.
										if ( jsongin.AsBoolean( value ) )
										{
											// ***$exists: true cannot be rendered.*** A field holding null exists to
											// jsongin, and it is a NULL column here, so IS NOT NULL would drop exactly
											// those rows. The asymmetry is the correct answer rather than an omission:
											// dropping the condition broadens, which is the safe direction.
											continue;
										}
										// $exists: false matches only an absent field. A NULL column covers both an
										// absent field and one holding null, so the clause admits a superset.
										expressions.push( `(${field_ref} IS NULL)` );
									}
									break;
								case '$mod':
									{
										if ( !options.RendersModulo ) { continue; }
										if ( jsongin.ShortType( value ) !== 'a' ) { continue; }
										if ( value.length !== 2 ) { continue; }
										let divisor = value[ 0 ];
										let remainder = value[ 1 ];
										if ( jsongin.ShortType( divisor ) !== 'n' ) { continue; }
										if ( jsongin.ShortType( remainder ) !== 'n' ) { continue; }
										if ( divisor === 0 ) { continue; }
										let field_ref = get_field_reference( options );
										if ( !field_ref ) { continue; }
										// ***TRUNCATE is load bearing.*** jsongin truncates toward zero before
										// dividing and MySQL does not: MOD( 10.5, 3 ) is 1.5 where jsongin answers 1,
										// so without it every fractional row the criteria matches is dropped. Both
										// keep the sign of the dividend, so negatives need nothing further.
										expressions.push( `(MOD(TRUNCATE(${field_ref}, 0), ${divisor}) = ${remainder})` );
									}
									break;
								case '$bitsAllSet':
								case '$bitsAllClear':
								case '$bitsAnySet':
								case '$bitsAnyClear':
									{
										if ( !options.RendersBitwise ) { continue; }
										let field_ref = get_field_reference( options );
										if ( !field_ref ) { continue; }
										let mask = get_bit_mask( value );
										if ( mask === null ) { continue; }
										// ***MySQL rounds a DOUBLE before masking*** - 9.7 & 1 is the answer for 10 -
										// where jsongin refuses a non-integer outright and matches nothing. Without
										// this guard the two disagree in both directions, and one of them loses a row.
										let guard = `${field_ref} = TRUNCATE(${field_ref}, 0)`;
										let test = '';
										if ( key === '$bitsAllSet' ) { test = `(${field_ref} & ${mask}) = ${mask}`; }
										else if ( key === '$bitsAllClear' ) { test = `(${field_ref} & ${mask}) = 0`; }
										else if ( key === '$bitsAnySet' ) { test = `(${field_ref} & ${mask}) <> 0`; }
										else { test = `(${field_ref} & ${mask}) <> ${mask}`; }
										expressions.push( `(${guard} AND ${test})` );
									}
									break;
								case '$regex':
									{
										let field_ref = get_field_reference( options );
										if ( !field_ref ) { continue; }
										let pattern = get_like_pattern( value, Criteria.$options, options );
										// Not plain text, a flag which would narrow, or a wildcard this dialect
										// cannot escape. Left out, and jsongin applies the expression to every
										// row instead.
										if ( pattern === null ) { continue; }
										let like = `${field_ref} LIKE ${render( pattern, options )}`;
										// ***Naming the escape character is what makes the escaping above mean
										// anything*** on an engine which has no default one. MySQL has one and
										// does not want the clause.
										if ( options.LikeEscapeClause )
										{
											like += ` ESCAPE ${render( options.LikeEscapeCharacter, options )}`;
										}
										expressions.push( `(${like})` );
									}
									break;
								case '$options':
									// Read by $regex above rather than on its own. It is not a condition and
									// constrains nothing by itself.
									continue;
								case '$expr':
								case '$exprx':
									{
										let expr = get_expression_comparison( value, options );
										if ( !expr ) { continue; }
										expressions.push( expr );
									}
									break;
								case '$comment':
								case '$noop':
									// Both match every document, so the empty clause is exactly right rather
									// than merely safe. SQL would write TRUE and it would mean the same thing.
									continue;
								case '$sampleRate':
									// ***Deliberately not rendered.*** RAND() would sample the rows on the way
									// out of the server and jsongin samples them again on the way in, so a
									// rendered rate is applied twice and drops rows the criteria matched.
									continue;
								default:
									// An operator this builder cannot render - $type, $size, $all and
									// $elemMatch today, and anything added later - places no constraint on
									// the statement, so it is left out and the result broadens. jsongin still
									// applies the whole criteria to every row, and jsongin is what refuses
									// an operator which is genuinely invalid.
									//
									// Those four are not unclassified: they ask about a value stored as a
									// serialized envelope in a text column, which the catalog cannot tell from
									// a plain string. See Threads Still Open in .plans/story.md.
									continue;
							}
						}
						else
						{
							// Key is a field.
							let child_options = Object.assign( {}, options );
							if ( options && options.AllowedFields )
							{
								if ( typeof options.AllowedFields[ key ] === 'undefined' ) { continue; }
							}
							child_options.FieldName = key;

							let expr = '';
							// `field = NULL` is never true in SQL, while the criteria matches every row whose
							// field is null or absent - and an absent field is a NULL column here.
							if ( jsongin.ShortType( value ) === 'l' )
							{
								expressions.push( `(${get_field_reference( child_options )} IS NULL)` );
								continue;
							}
							if ( 'bnsla'.includes( jsongin.ShortType( value ) ) )
							{
								expr = get_operation_expression( '=', value, child_options );
								// ***The refusal has to be tested before it is wrapped.*** The helper says it
								// cannot render a value by returning null - an array against `=` among them -
								// and wrapping first turned that into the four character string "(null)",
								// which is truthy and so passed the guard below and reached the statement.
								// MySQL evaluates WHERE (NULL) as UNKNOWN and returns no rows at all, which
								// made the most ordinary criteria there is - a field compared to an array -
								// silently match nothing.
								if ( !expr ) { continue; }
								expr = `(${expr})`;
							}
							else
							{
								// ***An object here is one of two entirely different criteria.*** A set of
								// operators describes the field and is rendered. Anything else is an exact
								// comparison against the whole object, which SQL cannot carry - and recursing
								// into it read the object's keys as ***column names***, so { tags: { a: 1 } }
								// rendered as `(a = 1)`: a condition on an unrelated column. A row whose tags
								// really were { a: 1 } was then dropped whenever its own `a` column was not 1,
								// which is a lost row rather than a broadened result.
								if ( !is_operator_object( value ) ) { continue; }
								expr = render( value, child_options );
							}
							// Nothing renderable for this field, so it contributes no constraint and the
							// result broadens. jsongin still applies the field criteria to every row.
							if ( !expr ) { continue; }
							// ***Broadened here and not deeper.*** This is outside the field's own $not, so
							// a negated condition is broadened after it has been negated rather than before.
							expressions.push( broaden_projection( expr, child_options ) );
						}

					}
					if ( !expressions.length ) { return ''; }
					if ( expressions.length === 1 )
					{
						return expressions[ 0 ];
					}
					else
					{
						let expr = '(' + expressions.join( ' AND ' ) + ')';
						return expr;
					}
					return null; // Unreachable code.
				}
				break;

			// Invalid Criteria
			case 'r':
			case 'f':
			case 'y':
			case 'u':
			// A RegExp, a function, a symbol or an undefined has no SQL form. It constrains
			// nothing here, and jsongin applies it to every row instead.
			default: return '';
		}

		return null; // Unreachable code.
	}


	// ***A translator is a plugin, the way an adapter and a filter already are.***
	// jsonstor.LoadPlugin files this under jsonstor.Translators by TranslatorName.
	return {
		TranslatorName: 'SqlExpression',
		Translate: Translate,
		// ***What this translator does with each jsongin query operator.*** Only what it
		// renders is named; anything undeclared is `dropped`, which is the safe default.
		//
		// ***Nothing here is `exact`, and that is a measurement result rather than an
		// oversight.*** Exactness is a claim about what a running engine does with a
		// rendering, and no rendering below has been measured for it. Two reasons it is
		// rarely reachable here anyway: a projected column is broadened under F4, and a
		// dialect coerces where jsongin compares by type. Raising a cell is the per
		// operator optimization a live-server suite has to license first.
		//
		// $elemMatch, $size, $all and $type are deferred, and $comment, $sampleRate and
		// $noop constrain nothing - all seven are left undeclared.
		Fidelities: {
			// Comparison
			'$eq': 'broadening',
			'$ne': 'broadening',
			'$gt': 'broadening',
			'$gte': 'broadening',
			'$lt': 'broadening',
			'$lte': 'broadening',
			'$in': 'broadening',
			'$nin': 'broadening',
			// Logical
			'$and': 'broadening',
			'$or': 'broadening',
			'$nor': 'broadening',
			'$not': 'broadening',
			// Evaluation
			'$regex': 'broadening',
			'$expr': 'broadening',
			'$mod': 'broadening',
			// Bitwise
			'$bitsAllSet': 'broadening',
			'$bitsAllClear': 'broadening',
			'$bitsAnySet': 'broadening',
			'$bitsAnyClear': 'broadening',
			// Element
			'$exists': 'broadening',
			// Extension
			'$ImplicitEq': 'broadening',
			'$eqx': 'broadening',
			'$nex': 'broadening',
			'$exprx': 'broadening',
		},
	};
};
