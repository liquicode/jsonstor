'use strict';

const jsongin = require( '@liquicode/jsongin' );

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
		// The value is rendered first. A value SQL cannot carry renders as nothing, and the
		// condition is dropped rather than emitted with an empty or malformed operand.
		let value_expr = SqlExpression( Value, Options );
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
	// Whether an object describes a field, or is a value the field is compared against.
	//
	// { $gte: 1, $lte: 5 } describes the field and is rendered. { a: 1 } is an object the
	// field must equal, and SQL has no form for that. An empty object is a value too: it
	// matches only a field which holds an empty object.
	function is_operator_object( Value )
	{
		if ( jsongin.ShortType( Value ) !== 'o' ) { return false; }
		let keys = Object.keys( Value );
		if ( !keys.length ) { return false; }
		for ( let index = 0; index < keys.length; index++ )
		{
			if ( !keys[ index ].startsWith( '$' ) ) { return false; }
		}
		return true;
	}


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
		if ( Options.Dialect === 'mysql' ) { return `(${Expression} IS NOT TRUE)`; }
		// The portable spelling. It says the same thing at the cost of naming the expression
		// twice, and every engine has it.
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
	function field_is_projection( FieldName, Options )
	{
		if ( !Options.AllowedFields ) { return false; }
		if ( !FieldName ) { return false; }
		let field = Options.AllowedFields[ FieldName ];
		if ( !field ) { return false; }
		return ( field.is_projection === true );
	}


	//---------------------------------------------------------------------
	// Whether a criteria names any projected column, at any depth.
	//
	// ***Broadening has to happen outside the negation, and a logical operator turns it
	// inside out.*** A field level condition is broadened where it is pushed, which is already
	// outside its own $not - but $nor and a top level $not negate an expression built further
	// down, where the disjunct has been added: `NOT (col = x OR col IS NULL)` is
	// `col <> x AND col IS NOT NULL`, which drops the very rows F4 exists to keep. There is no
	// wrapping which repairs that, so the whole operator is dropped instead and the result
	// broadens.
	function criteria_names_projection( Criteria, Options )
	{
		let st = jsongin.ShortType( Criteria );
		if ( st === 'a' )
		{
			for ( let index = 0; index < Criteria.length; index++ )
			{
				if ( criteria_names_projection( Criteria[ index ], Options ) ) { return true; }
			}
			return false;
		}
		if ( st !== 'o' ) { return false; }
		for ( let key in Criteria )
		{
			if ( !key.startsWith( '$' ) )
			{
				if ( field_is_projection( key, Options ) ) { return true; }
			}
			if ( criteria_names_projection( Criteria[ key ], Options ) ) { return true; }
		}
		return false;
	}


	//---------------------------------------------------------------------
	// Whether an operand is the same kind of value as the column it is compared against.
	//
	// ***jsongin compares by type where SQL coerces.*** A boolean is never equal to a string
	// to jsongin, so { b: { $ne: '0' } } matches every row - while MySQL reads "0" as 0, finds
	// it equal to a false column, and drops exactly those rows.
	//
	// ***Only the negating comparisons need this.*** Under a type mismatch $eq and $in match
	// nothing in jsongin, so a coercing clause only admits extra rows; and jsongin refuses a
	// cross type ordering outright, which makes $lt and its siblings match nothing either.
	// $ne, $nex and $nin are the ones which match everything, and so have rows to lose.
	//
	// A column whose type the caller did not declare is not second guessed: with no
	// AllowedFields entry there is nothing to compare the operand against.
	function operand_type_agrees( Value, Options )
	{
		if ( !Options.AllowedFields ) { return true; }
		if ( !Options.FieldName ) { return true; }
		let field = Options.AllowedFields[ Options.FieldName ];
		if ( !field ) { return true; }
		if ( !field.short_type ) { return true; }
		let values = ( jsongin.ShortType( Value ) === 'a' ) ? Value : [ Value ];
		for ( let index = 0; index < values.length; index++ )
		{
			// A null is not a type mismatch. It is asked about with IS NULL instead.
			if ( jsongin.ShortType( values[ index ] ) === 'l' ) { continue; }
			if ( jsongin.ShortType( values[ index ] ) !== field.short_type ) { return false; }
		}
		return true;
	}


	//---------------------------------------------------------------------
	// Splits an operand list into its non-null values and whether it named a null.
	//
	// A NULL in an IN list poisons the whole comparison: `2 IN (10, NULL)` is UNKNOWN rather
	// than false, so NOT of it is UNKNOWN too and the row is dropped even though 2 is plainly
	// not in the list. The nulls come out of the list and are asked about with IS NULL instead.
	function split_null_values( Values )
	{
		let result = { Values: [], HasNull: false };
		if ( jsongin.ShortType( Values ) !== 'a' ) { return result; }
		for ( let index = 0; index < Values.length; index++ )
		{
			if ( jsongin.ShortType( Values[ index ] ) === 'l' ) { result.HasNull = true; continue; }
			result.Values.push( Values[ index ] );
		}
		return result;
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
	function get_like_pattern( Value, RegExpOptions )
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

		// % and _ are LIKE's own wildcards, and MySQL's default LIKE escape is the backslash.
		// A literal one of either has to be escaped on the way into the pattern.
		let literal = source.split( '%' ).join( '\\%' );
		literal = literal.split( '_' ).join( '\\_' );

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
			expressions.push( SqlExpression( Values[ index ], Options ) );
		}
		return expressions;
	}


	//---------------------------------------------------------------------
	function SqlExpression( Criteria, Options = {} )
	{
		let options = jsongin.Clone( Options );
		if ( typeof options.StringLiteralQuotes === 'undefined' ) { options.StringLiteralQuotes = '"'; }
		if ( typeof options.IdentifierQuotes === 'undefined' ) { options.IdentifierQuotes = ''; }
		if ( typeof options.AllowedFields === 'undefined' ) { options.AllowedFields = null; }
		if ( typeof options.FieldName === 'undefined' ) { options.FieldName = ''; }
		// Which SQL to write. 'mysql' is the only adapter using this file today and the only
		// dialect its renderings are measured against; 'core' restricts them to predicates
		// every engine has, for an adapter which is not MySQL.
		if ( typeof options.Dialect === 'undefined' ) { options.Dialect = 'mysql'; }


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
					// ***The escape character goes first.*** Escaping the quotes first would
					// double the backslashes that escaping introduced.
					//
					// Both use split/join because String.replace with a string pattern replaces
					// only the ***first*** occurrence. A value holding two quotes closed its
					// literal early and MySQL answered ER_PARSE_ERROR; a value holding a
					// backslash was worse, because "a\b" is an 'a' and a backspace to MySQL and
					// the statement ran and matched the wrong rows. It was also the one place a
					// caller's text reached the statement unparameterized.
					let text = Criteria.split( '\\' ).join( '\\\\' );
					text = text.split( options.StringLiteralQuotes ).join( '\\' + options.StringLiteralQuotes );
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
						expressions.push( SqlExpression( Criteria[ index ], options ) );
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
										let expr = SqlExpression( value, options );
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
										if ( options.Dialect !== 'mysql' ) { continue; }
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
										if ( options.Dialect !== 'mysql' ) { continue; }
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
										let pattern = get_like_pattern( value, Criteria.$options );
										// Not plain text, or a flag which would narrow. Left out, and jsongin
										// applies the expression to every row instead.
										if ( pattern === null ) { continue; }
										expressions.push( `(${field_ref} LIKE ${SqlExpression( pattern, options )})` );
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
							let child_options = jsongin.Clone( options );
							if ( Options && Options.AllowedFields )
							{
								if ( typeof Options.AllowedFields[ key ] === 'undefined' ) { continue; }
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
								expr = SqlExpression( value, child_options );
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




	return SqlExpression;
};
