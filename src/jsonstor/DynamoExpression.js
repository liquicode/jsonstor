'use strict';

const jsongin = require( '@liquicode/jsongin' );
const SUPPORT = require( './TranslatorSupport' )();

/*
	Builds a DynamoDB filter expression from a jsonstor criteria.

	***This is the fourth translator and the first whose Pushdown is not one thing.*** SqlExpression
	assembles a string, MangoExpression prunes a tree, ElasticExpression assembles an object; this
	one produces a ***triple*** - an expression string, the attribute names it aliases, and the
	values it placeholders. jsonx/.plans/criteria-translation-layer.md predicted that shape by name,
	`{ Expr, Names, Values }`, before a line of it was run, and the prediction held.

	***The triple is checked, which the prediction did not say.*** DynamoDB refuses a request
	outright - 400, "Value provided in ExpressionAttributeNames unused in expressions" - when the
	name map carries an alias the expression never mentions. So Names is not a dictionary handed
	over wholesale; it is exactly what got emitted, and a branch which is dropped takes its names
	and values with it. Everything below allocates through one state object for that reason.

	***Values are plain JavaScript values and this file never marshals them.*** `{ N: '10' }` is the
	driver's spelling, and jsonstor does not depend on a driver - the adapter marshals on the way
	out, with `@aws-sdk/util-dynamodb` or by hand. Same boundary every other translator keeps.

	## The rule that shapes everything here

	***jsongin matches an array field element-wise, and DynamoDB has no per-element predicate.***
	`{ arr: 1 }` admits `arr: [1,2,3]` - MongoDB's rule, and jsongin's - while `#arr = :v` against
	a list is simply false. Measured 2026-09-05: the naive rendering of the commonest operator in
	the language ***narrows***, which is the one thing a pushdown may never do.

	***`contains` is the only element-wise construct in the language***, and pairing it with the
	comparison repairs equality exactly:

		#arr = :v                         ->  []      where jsongin says [1]     NARROWING
		( #arr = :v OR contains(#arr,:v) )->  [1]     where jsongin says [1]     exact

	***It does not repair ordering, and nothing does.*** `contains` asks for an element ***equal
	to*** a value; nothing asks for an element ***greater than*** one. So `{ arr: { $gt: 2 } }` has
	no rendering at all on a field which might hold an array - measured narrowing, no repair - and
	the ordering operators are rendered ***only where the adapter has declared the field holds a
	scalar***. That is what AllowedFields is for here, and it is the whole of what it is for.

	## What AllowedFields means here, which is not what it means for SQL

	***Every attribute is queryable and nothing has to be declared.*** There is no payload column
	in this target - a Scan filter names any attribute of any item - so an undeclared field is
	pushable, which is the opposite of the SQL family's default and of ElasticExpression's. A field
	entry is not permission to push; it is ***information which lets more be pushed***:

		short_type   the jsongin type the adapter promises the field holds. A scalar promise is
		             what makes the ordering operators renderable, because it rules out an array.

	## The other trap, which is `contains` against a string

	***`contains` is a substring test on a String attribute and an element test on a List.*** So the
	paired equality above is exact for a non-string operand and merely ***broadening*** for a string
	one - `contains(#s, 'wid')` admits `'widget'`, which jsongin's equality rejects. Broadening is
	allowed and the residual settles it.

	***But a negation over a broadening operand comes back out narrowing***, which is the asymmetry
	every translator in this family has had to learn separately. So $ne and $nin are rendered for a
	non-string operand and dropped for a string one. Not a special case - the general rule, arriving
	where this dialect happens to put it.

	## What is not rendered

	***$regex, $type and $elemMatch are dropped, and each one is a measurement.*** There are no
	regular expressions in the language at all and `begins_with` cannot carry a case-insensitive
	pattern, nor reach inside an array. `attribute_type(#arr, N)` answers nothing for an array of
	numbers where jsongin answers both documents - narrowing. And $elemMatch asks for a predicate
	per element, which is the construct the language lacks.

	***$mod, the four $bits operators and $expr have no arithmetic to render them with.*** DynamoDB
	filter expressions have no operators beyond comparison, membership, and the five functions.

	***A dotted path is dropped, and the reason is the array rule again.*** `#a.#b` addresses a map
	and only a map, while jsongin admits `a` being an array of objects each carrying `b`.
	MangoExpression repairs exactly that with a disjunction of $elemMatch branches - measured on
	CouchDB, one branch per position the array could sit at - and ***that repair needs the element
	predicate this language does not have***. So the path is left whole to the residual, which costs
	a document read and is never wrong.

	## The emulator caveat, which this file resolves by construction

	***DynamoDB Local is what these measurements ran against, and it cannot be checked against the
	service*** - it accepts an invalid signature, so nothing local can tell the two apart, and the
	service needs an account. One difference already showed up: a bare `#n <> :v` against an absent
	attribute is documented as false and the emulator admits the document.

	***So where the emulator is more generous than the documentation, this file renders the form
	which is correct under both readings.*** $ne carries an explicit `attribute_not_exists` guard
	although the emulator says it does not need one. See jsonx/.plans/wave-5-query-languages.md.
*/

module.exports = function ( jsonstor )
{

	//---------------------------------------------------------------------
	// ***What DynamoDB does with each jsongin query operator, measured against DynamoDB Local
	// 3.3.1 on 2026-09-05.***
	//
	// This is the ceiling, not a promise. A cell declares the best achievable fidelity and the
	// renderer reports the actual one, which depends on the operand and on what the adapter has
	// declared about the field - see OperatorMatrix. Anything undeclared is dropped, which is
	// always correct and merely slow.
	const FIDELITIES = {
		// ***Comparison. Exact, because DynamoDB coerces nothing.*** The probe asked and every
		// attribute came back the type it went in as, the string '10' still a string beside the
		// number 10 - so a typed comparison means here what it means in jsongin. That is the one
		// large difference from every other target in this family, and it is why negation is
		// renderable at all.
		'$eq': 'exact',
		'$ne': 'exact',
		'$in': 'exact',
		'$nin': 'exact',
		// ***Ordering is exact only where the field is declared scalar***, and dropped otherwise -
		// see the header. The ceiling says what a declared field can reach.
		'$gt': 'exact',
		'$gte': 'exact',
		'$lt': 'exact',
		'$lte': 'exact',
		// Logical. A conjunction is as exact as its children; a disjunction is kept whole or
		// dropped whole; a negation needs an exact subtree under it.
		'$and': 'exact',
		'$or': 'exact',
		'$nor': 'exact',
		'$not': 'exact',
		// Evaluation. No regular expressions and no arithmetic of any kind.
		'$regex': 'dropped',
		'$expr': 'dropped',
		'$mod': 'dropped',
		'$bitsAllSet': 'dropped',
		'$bitsAllClear': 'dropped',
		'$bitsAnySet': 'dropped',
		'$bitsAnyClear': 'dropped',
		// Array. $size is exact behind a type guard - see render_condition, where the guard is
		// what stops it counting the bytes of a string. $all is a conjunction of element tests.
		'$elemMatch': 'dropped',
		'$size': 'exact',
		'$all': 'exact',
		// Element. attribute_exists answers exactly what jsongin asks, a stored NULL included.
		'$exists': 'exact',
		// ***$type narrows against an array and there is no repair.*** attribute_type(#arr, N)
		// answers nothing where jsongin answers every document whose array holds a number.
		'$type': 'dropped',
		// Miscellaneous. $comment annotates and constrains nothing, which is what jsongin does
		// with it too. $sampleRate has no filter form, and rendering an approximation then
		// re-checking it draws two independent samples and keeps their intersection - a
		// narrowing. Same reasoning MangoExpression and ElasticExpression carry.
		'$comment': 'exact',
		'$sampleRate': 'dropped',
		// Extension. `{ field: value }` with no operator written.
		'$ImplicitEq': 'exact',
		// The four jsongin extensions. No target has ever heard of them.
		'$eqx': 'dropped',
		'$nex': 'dropped',
		'$exprx': 'dropped',
		'$noop': 'dropped',
	};

	const FIDELITY_ORDER = [ 'exact', 'broadening', 'dropped' ];

	// ***DynamoDB refuses an IN list longer than this.*** A longer one is dropped rather than
	// split, because splitting it into an OR of chunks is a rendering nobody has measured.
	const MAX_IN_OPERANDS = 100;

	// ***Above this code point, UTF-8 byte order and UTF-16 code unit order disagree.*** DynamoDB
	// compares strings as UTF-8 bytes and jsongin compares them as JavaScript strings, which is
	// UTF-16 code units. The two orders differ only when the first difference falls between a
	// supplementary character and one in U+E000..U+FFFF: the surrogate lead unit sorts below
	// U+E000 while the code point sorts above it. ***An operand made only of code points below
	// U+E000 cannot reach that case against any stored value***, which is a small enough
	// restriction to be free and a provable one, so it is the line an ordering operand has to
	// clear. Everything above it is dropped rather than guessed at.
	const ORDERING_SAFE_CODE_POINT_CEILING = 0xE000;


	//---------------------------------------------------------------------
	// An adapter may narrow the table and may never widen it. Same clamp the other translators
	// apply, for the same reason: a target which speaks a subset says so in its own settings
	// rather than by shipping a second translator.
	function apply_defaults( Options )
	{
		let options = Object.assign( {}, Options );
		if ( typeof options.AllowedFields === 'undefined' ) { options.AllowedFields = null; }
		if ( typeof options.FieldName === 'undefined' ) { options.FieldName = ''; }
		if ( typeof options.OperatorFidelities === 'undefined' ) { options.OperatorFidelities = null; }

		let fidelities = {};
		let names = Object.keys( jsongin.QueryOperators );
		for ( let index = 0; index < names.length; index++ )
		{
			let name = names[ index ];
			let ceiling = FIDELITIES[ name ];
			if ( FIDELITY_ORDER.indexOf( ceiling ) < 0 ) { ceiling = 'dropped'; }
			let declared = options.OperatorFidelities ? options.OperatorFidelities[ name ] : undefined;
			if ( FIDELITY_ORDER.indexOf( declared ) < 0 ) { declared = ceiling; }
			// The weaker of the two wins, the table's order being strongest first.
			fidelities[ name ] = ( FIDELITY_ORDER.indexOf( declared ) > FIDELITY_ORDER.indexOf( ceiling ) )
				? declared : ceiling;
		}
		options.Fidelities = fidelities;
		return options;
	}


	//---------------------------------------------------------------------
	// ***One allocator for the whole render, and it is what keeps the triple tight.***
	//
	// A name or a value reaches the request only by being asked for here, and it is asked for
	// only at the moment a clause which uses it is built. A branch which is dropped never calls
	// in, so nothing it would have needed is in the map - which is the difference between a
	// request DynamoDB answers and one it refuses outright.
	//
	// ***Exactness is tracked here too, rather than by a second walk over the criteria.***
	// SqlExpression and ElasticExpression decide it by re-walking the tree and reading the
	// fidelity table, which works while a translator has no exact comparison to render. This one
	// does, so the two answers can diverge: `$gt` is exact by the table and dropped in fact
	// against a field nobody declared scalar. ***A pushdown which quietly rendered nothing while
	// the residual was declared null would return the whole collection as a match***, so the
	// renderer reports what it actually did and `not_exact` is called from every path which
	// declines, broadens, or drops.
	function new_state()
	{
		return {
			Names: {},
			Values: {},
			aliases: {},
			value_count: 0,
			exact: true,
		};
	}


	function not_exact( state )
	{
		state.exact = false;
	}


	// ***Every field goes through an alias, unconditionally.*** A DynamoDB reserved word cannot
	// appear in an expression at all and the list runs to hundreds of entries, so testing
	// membership per field is more code and more risk than aliasing everything.
	function name_of( state, FieldName )
	{
		if ( typeof state.aliases[ FieldName ] === 'undefined' )
		{
			let alias = '#f' + Object.keys( state.aliases ).length;
			state.aliases[ FieldName ] = alias;
			state.Names[ alias ] = FieldName;
		}
		return state.aliases[ FieldName ];
	}


	function value_of( state, Value )
	{
		let placeholder = ':v' + state.value_count;
		state.value_count += 1;
		state.Values[ placeholder ] = Value;
		return placeholder;
	}


	//---------------------------------------------------------------------
	function field_entry( FieldName, options )
	{
		if ( !options.AllowedFields ) { return null; }
		if ( !FieldName ) { return null; }
		return options.AllowedFields[ FieldName ] || null;
	}


	//---------------------------------------------------------------------
	// ***A dotted path is not rendered.*** See the header: `#a.#b` addresses a map and only a
	// map, and the disjunction which repairs that needs an element predicate this language does
	// not have.
	function field_is_pushable( FieldName )
	{
		if ( !FieldName ) { return false; }
		if ( String( FieldName ).includes( '.' ) ) { return false; }
		return true;
	}


	//---------------------------------------------------------------------
	// ***Whether the adapter has promised this field holds a scalar***, which is what makes the
	// ordering operators renderable. An array under an ordering comparison narrows and cannot be
	// repaired, so an undeclared field does not get one.
	function field_is_declared_scalar( FieldName, options )
	{
		let field = field_entry( FieldName, options );
		if ( !field ) { return false; }
		if ( !field.short_type ) { return false; }
		return 'nsb'.includes( field.short_type );
	}


	//---------------------------------------------------------------------
	function is_scalar_operand( Value )
	{
		return 'nsb'.includes( jsongin.ShortType( Value ) );
	}


	//---------------------------------------------------------------------
	// ***Whether a string operand can be ordered against safely.*** See the constant.
	function operand_orders_safely( Value )
	{
		if ( jsongin.ShortType( Value ) !== 's' ) { return true; }
		for ( let character of Value )
		{
			if ( character.codePointAt( 0 ) >= ORDERING_SAFE_CODE_POINT_CEILING ) { return false; }
		}
		return true;
	}


	//---------------------------------------------------------------------
	// ***An equality which admits an array element, which is jsongin's rule.***
	//
	// `( #f = :v OR contains(#f, :v) )` - measured exact for a non-string operand. For a string
	// operand `contains` is a substring test, so the clause admits documents jsongin rejects:
	// still legal, and the caller is told by way of not_exact so the residual re-checks.
	function element_equality( state, FieldName, Operand, options )
	{
		if ( !is_scalar_operand( Operand ) ) { return null; }
		let name = name_of( state, FieldName );
		let placeholder = value_of( state, Operand );
		if ( jsongin.ShortType( Operand ) === 's' ) { not_exact( state ); }
		return `( ${name} = ${placeholder} OR contains(${name}, ${placeholder}) )`;
	}


	//---------------------------------------------------------------------
	// ***Whether a negation may be built over this operand at all.*** A negation inverts whatever
	// is under it, so a broadening operand comes back out narrowing - which is the one direction
	// forbidden. A string operand broadens through `contains`, so it has no negation here.
	function operand_negates_safely( Operand )
	{
		if ( !is_scalar_operand( Operand ) ) { return false; }
		return ( jsongin.ShortType( Operand ) !== 's' );
	}


	//---------------------------------------------------------------------
	// One condition on one field. Returns an expression string, or null meaning "not rendered",
	// which every caller has to treat as its own position demands.
	function render_condition( state, FieldName, Operator, Operand, options )
	{
		if ( !field_is_pushable( FieldName ) ) { not_exact( state ); return null; }
		if ( options.Fidelities[ Operator ] === 'dropped' ) { not_exact( state ); return null; }

		switch ( Operator )
		{
			case '$eq':
			case '$ImplicitEq':
			{
				// ***A null operand matches a null and an absent field both***, and it also
				// matches an array holding a null - measured. The third case has no rendering,
				// so the whole operand is left to the residual rather than answered partly.
				if ( jsongin.ShortType( Operand ) === 'l' ) { not_exact( state ); return null; }
				let clause = element_equality( state, FieldName, Operand, options );
				if ( !clause ) { not_exact( state ); return null; }
				return clause;
			}

			case '$ne':
			{
				if ( !operand_negates_safely( Operand ) ) { not_exact( state ); return null; }
				let name = name_of( state, FieldName );
				let placeholder = value_of( state, Operand );
				// ***The guard is kept although the emulator says it is unnecessary.*** See the
				// header: it is correct whichever way the absent-attribute question is answered,
				// and the bare form is correct only one way.
				return `( attribute_not_exists(${name}) OR NOT ( ${name} = ${placeholder} OR contains(${name}, ${placeholder}) ) )`;
			}

			case '$gt':
			case '$gte':
			case '$lt':
			case '$lte':
			{
				// ***Ordering needs a scalar promise, because an array under it narrows.***
				if ( !field_is_declared_scalar( FieldName, options ) ) { not_exact( state ); return null; }
				// A boolean has no ordering in DynamoDB and jsongin refuses a cross type ordering
				// anyway, so only numbers and strings are rendered.
				if ( !'ns'.includes( jsongin.ShortType( Operand ) ) ) { not_exact( state ); return null; }
				if ( !operand_orders_safely( Operand ) ) { not_exact( state ); return null; }
				const SPELLING = { '$gt': '>', '$gte': '>=', '$lt': '<', '$lte': '<=' };
				let name = name_of( state, FieldName );
				let placeholder = value_of( state, Operand );
				return `${name} ${SPELLING[ Operator ]} ${placeholder}`;
			}

			case '$in':
			{
				if ( jsongin.ShortType( Operand ) !== 'a' ) { not_exact( state ); return null; }
				if ( !Operand.length ) { not_exact( state ); return null; }
				if ( Operand.length > MAX_IN_OPERANDS ) { not_exact( state ); return null; }
				// ***A null in the list carries the null-or-absent meaning*** which has no
				// rendering here, exactly as a bare null operand does.
				let split = SUPPORT.SplitNullValues( Operand );
				if ( split.HasNull ) { not_exact( state ); return null; }
				// ***Each member gets the element treatment.*** A bare IN list against an array
				// field answered nothing where jsongin answered a document - measured narrowing.
				let branches = [];
				for ( let index = 0; index < Operand.length; index++ )
				{
					let clause = element_equality( state, FieldName, Operand[ index ], options );
					if ( !clause ) { not_exact( state ); return null; }
					branches.push( clause );
				}
				return '( ' + branches.join( ' OR ' ) + ' )';
			}

			case '$nin':
			{
				if ( jsongin.ShortType( Operand ) !== 'a' ) { not_exact( state ); return null; }
				if ( !Operand.length ) { not_exact( state ); return null; }
				if ( Operand.length > MAX_IN_OPERANDS ) { not_exact( state ); return null; }
				for ( let index = 0; index < Operand.length; index++ )
				{
					if ( !operand_negates_safely( Operand[ index ] ) ) { not_exact( state ); return null; }
				}
				let name = name_of( state, FieldName );
				let branches = [];
				for ( let index = 0; index < Operand.length; index++ )
				{
					let placeholder = value_of( state, Operand[ index ] );
					branches.push( `${name} = ${placeholder} OR contains(${name}, ${placeholder})` );
				}
				return `( attribute_not_exists(${name}) OR NOT ( ${branches.join( ' OR ' )} ) )`;
			}

			case '$all':
			{
				if ( jsongin.ShortType( Operand ) !== 'a' ) { not_exact( state ); return null; }
				if ( !Operand.length ) { not_exact( state ); return null; }
				// ***$all admits a scalar equal to its one member***, measured, which is why the
				// element form is used here rather than a bare `contains` conjunction.
				let clauses = [];
				for ( let index = 0; index < Operand.length; index++ )
				{
					let clause = element_equality( state, FieldName, Operand[ index ], options );
					if ( !clause ) { not_exact( state ); return null; }
					clauses.push( clause );
				}
				return '( ' + clauses.join( ' AND ' ) + ' )';
			}

			case '$size':
			{
				if ( jsongin.ShortType( Operand ) !== 'n' ) { not_exact( state ); return null; }
				// ***The type guard is what makes this exact.*** `size()` counts the bytes of a
				// string and the entries of a map as readily as the elements of a list, and
				// jsongin's $size answers only for an array - measured broadening without the
				// guard, exact with it.
				let name = name_of( state, FieldName );
				let type_placeholder = value_of( state, 'L' );
				let size_placeholder = value_of( state, Operand );
				return `( attribute_type(${name}, ${type_placeholder}) AND size(${name}) = ${size_placeholder} )`;
			}

			case '$exists':
			{
				if ( jsongin.ShortType( Operand ) !== 'b' ) { not_exact( state ); return null; }
				let name = name_of( state, FieldName );
				// A stored NULL is an attribute which exists, and jsongin says the key is
				// present. The two agree - measured.
				if ( Operand === true ) { return `attribute_exists(${name})`; }
				return `attribute_not_exists(${name})`;
			}

			default:
				not_exact( state );
				return null;
		}
	}


	//---------------------------------------------------------------------
	// An operator object - `{ $gte: 1, $lte: 5 }` - is an AND of its conditions on one field,
	// so an unrendered condition is dropped and the rest still stand.
	function render_operator_object( state, FieldName, Operators, options )
	{
		let clauses = [];
		let names = Object.keys( Operators );
		for ( let index = 0; index < names.length; index++ )
		{
			let name = names[ index ];
			// $options is not a condition. It qualifies the $regex beside it, and $regex is not
			// rendered here at all.
			if ( name === '$options' ) { continue; }
			let clause = render_condition( state, FieldName, name, Operators[ name ], options );
			if ( clause ) { clauses.push( clause ); }
		}
		if ( !clauses.length ) { return null; }
		if ( clauses.length === 1 ) { return clauses[ 0 ]; }
		return '( ' + clauses.join( ' AND ' ) + ' )';
	}


	//---------------------------------------------------------------------
	// One key of a criteria object. A field name carries either an operator object or a value
	// the field must equal; a $ key is a logical operator over criteria of its own.
	function render_key( state, Key, Value, options )
	{
		if ( !Key.startsWith( '$' ) )
		{
			if ( SUPPORT.IsOperatorObject( Value ) ) { return render_operator_object( state, Key, Value, options ); }
			return render_condition( state, Key, '$ImplicitEq', Value, options );
		}

		switch ( Key )
		{
			case '$and':
			{
				if ( jsongin.ShortType( Value ) !== 'a' ) { not_exact( state ); return null; }
				let clauses = [];
				for ( let index = 0; index < Value.length; index++ )
				{
					// ***Dropping a child of an AND is safe*** - the clause admits more and the
					// residual decides the rest. This is the only operator that is true of.
					let clause = render_criteria( state, Value[ index ], options );
					if ( clause ) { clauses.push( clause ); }
				}
				if ( !clauses.length ) { return null; }
				if ( clauses.length === 1 ) { return clauses[ 0 ]; }
				return '( ' + clauses.join( ' AND ' ) + ' )';
			}

			case '$or':
			{
				if ( jsongin.ShortType( Value ) !== 'a' ) { not_exact( state ); return null; }
				if ( !Value.length ) { not_exact( state ); return null; }
				let clauses = [];
				for ( let index = 0; index < Value.length; index++ )
				{
					let clause = render_criteria( state, Value[ index ], options );
					// ***An $or is kept whole or dropped whole.*** Dropping one branch narrows
					// the disjunction to the others and loses exactly the documents that branch
					// was there for - the asymmetry TranslatorSupport was written about.
					if ( !clause ) { not_exact( state ); return null; }
					clauses.push( clause );
				}
				if ( clauses.length === 1 ) { return clauses[ 0 ]; }
				return '( ' + clauses.join( ' OR ' ) + ' )';
			}

			case '$not':
			case '$nor':
			{
				// ***A negation is renderable only over a subtree which came out exact.*** The
				// probe measured it working - `NOT ( #n = :v )` answered jsongin's own three
				// documents, absent attribute included - but that holds only while nothing
				// underneath broadened, so the subtree is rendered into a state of its own and
				// the result is thrown away unless it came back exact.
				let inner = ( jsongin.ShortType( Value ) === 'a' ) ? Value : [ Value ];
				let probe = new_state();
				let clauses = [];
				let renderable = true;
				for ( let index = 0; index < inner.length; index++ )
				{
					let clause = render_criteria( probe, inner[ index ], options );
					if ( !clause ) { renderable = false; break; }
					clauses.push( clause );
				}
				if ( !renderable || !probe.exact ) { not_exact( state ); return null; }

				// ***Rendered a second time into the real state***, so that the names and values
				// of a negation which is being kept are the only ones which reach the request.
				// Cheap, and it keeps the allocator's one rule intact.
				let kept = [];
				for ( let index = 0; index < inner.length; index++ )
				{
					kept.push( render_criteria( state, inner[ index ], options ) );
				}
				let body = ( kept.length === 1 ) ? kept[ 0 ] : '( ' + kept.join( ' OR ' ) + ' )';
				return `NOT ${body}`;
			}

			case '$comment':
				// Annotates the query and constrains nothing, which is what jsongin does with
				// it. Rendering nothing here is not a drop - there is no condition to lose.
				return null;

			default:
				not_exact( state );
				return null;
		}
	}


	//---------------------------------------------------------------------
	// A criteria object is an AND of its keys.
	function render_criteria( state, Criteria, options )
	{
		if ( jsongin.ShortType( Criteria ) !== 'o' ) { not_exact( state ); return null; }
		let clauses = [];
		let keys = Object.keys( Criteria );
		for ( let index = 0; index < keys.length; index++ )
		{
			let clause = render_key( state, keys[ index ], Criteria[ keys[ index ] ], options );
			if ( clause ) { clauses.push( clause ); }
		}
		if ( !clauses.length ) { return null; }
		if ( clauses.length === 1 ) { return clauses[ 0 ]; }
		return '( ' + clauses.join( ' AND ' ) + ' )';
	}


	//---------------------------------------------------------------------
	// ***The public entry point, and the only one.***
	//
	// Returns:
	//
	//   Pushdown   ***A `{ Expr, Names, Values }` triple, opaque to jsonstor*** - only the adapter
	//              which chose this translator gives it meaning. `Expr` is null for a criteria
	//              nothing could be absorbed from, which the adapter renders by sending no
	//              FilterExpression at all; `Names` and `Values` are then empty, and they are
	//              always exactly what `Expr` mentions. ***Values hold plain JavaScript values***
	//              and the adapter marshals them.
	//   Residual   The part of the criteria the pushdown does not decide exactly, or null when it
	//              decides all of it. ***Null is common here***, unlike in the other three
	//              translators, because nothing in this target coerces.
	//   *Absorbed  Whether the translator took responsibility for that part of the query. All
	//              false: only the criteria is implemented. DynamoDB can page and project on the
	//              server and cannot sort outside a key condition, and saying so is a later,
	//              additive change.
	function Translate( Request )
	{
		if ( jsongin.ShortType( Request ) !== 'o' ) { throw new Error( `The Request parameter must be an object.` ); }
		let options = apply_defaults( Request.Options );
		let criteria = Request.Criteria;
		let state = new_state();

		// ***A criteria which is not a criteria is never absorbed.*** Null and undefined are the
		// whole collection, which every adapter in this family agrees on; some other non-object
		// is a typo, and a typo must never be indistinguishable from an empty result. Left
		// unabsorbed it reaches jsongin, which refuses it. Same reasoning as the other three.
		let st = jsongin.ShortType( criteria );
		if ( 'lu'.includes( st ) )
		{
			return {
				Pushdown: { Expr: null, Names: {}, Values: {} },
				Residual: null,
				SortAbsorbed: false,
				ProjectionAbsorbed: false,
				LimitAbsorbed: false,
			};
		}

		let expression = ( st === 'o' ) ? render_criteria( state, criteria, options ) : null;
		if ( !expression ) { not_exact( state ); }

		return {
			Pushdown: expression
				? { Expr: expression, Names: state.Names, Values: state.Values }
				: { Expr: null, Names: {}, Values: {} },
			Residual: state.exact ? null : criteria,
			SortAbsorbed: false,
			ProjectionAbsorbed: false,
			LimitAbsorbed: false,
		};
	}


	// ***A translator is a plugin, the way an adapter and a filter already are.***
	// jsonstor.LoadPlugin files this under jsonstor.Translators by TranslatorName.
	return {
		TranslatorName: 'DynamoExpression',
		Translate: Translate,
		// The table above, published. It is the ceiling an adapter's OperatorFidelities is
		// clamped against, and the column OperatorMatrix reads.
		Fidelities: FIDELITIES,
	};
};
