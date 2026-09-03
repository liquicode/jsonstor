'use strict';

const jsongin = require( '@liquicode/jsongin' );
const SUPPORT = require( './TranslatorSupport' )();

/*
	Builds a MongoDB query document from a jsonstor criteria.

	***A jsongin criteria is already almost a Mango query, and this file is about the almost.***
	Twenty seven of jsongin's thirty one query operators are MongoDB's own operators, spelled
	the same way and meaning the same thing, so the translation for them is the identity. The
	remaining four - $eqx, $nex, $exprx and $noop - are jsongin extensions which MongoDB has
	never heard of. ***That is the entire difference, and it was measured rather than assumed***
	- see the Fidelities table below.

	***So the pushdown is a criteria with the words the target does not know taken out of it.***
	Where SqlExpression assembles a string in a foreign language, this one prunes a tree in a
	language the target mostly shares. Both obey the same invariant, and the pruning is where
	it bites.

	***The invariant: a pushdown may admit documents the criteria rejects, and must never
	reject a document the criteria admits.*** Returning too many costs time; returning too few
	is a wrong answer nothing downstream can correct.

	***The trap is that taking a condition out is only safe at an AND position.*** A criteria
	object is an AND of its keys, and an operator object is an AND of its conditions on one
	field, so dropping a key from either broadens the result. Dropping a child of $or does the
	opposite: `$or: [ A, B ]` without B is A, which admits strictly fewer documents. So an $or
	is kept whole or dropped whole, and so are the negations $not and $nor, where anything
	imprecise inside comes back out inverted.

	***What this file makes possible is not a faster query - it is a correct one.*** Until it
	existed the adapter handed Criteria to the driver unexamined, so `{ a: { $eqx: '1' } }`
	reached a server with no such operator and came back as `unknown operator: $eqx`. Measured
	against a live MongoDB on 2026-08-28: the driver refused all four extensions, while jsongin
	answered every one of them normally. The pushdown now leaves out what the server cannot
	read and the residual asks jsongin about it, which is the bargain every other adapter in
	this family already made.

	***And it is why the residual can be empty, which no other translator's can.*** An empty
	residual means the target decided the whole criteria by itself, so the adapter may skip the
	jsongin re-check entirely - and may hand a criteria to updateMany() and deleteMany()
	instead of reading the documents back to filter them itself. That is what jsonstor-mongodb
	has always done. The mechanism did not make it faster; it made the speed it already had
	***earned by a vocabulary check*** rather than assumed.

	***This translator is not MongoDB's alone, which is the point of it living here.*** CouchDB
	and PouchDB speak Mango too, but a narrower Mango - their vocabulary is a subset of this
	one. Such an adapter narrows the table with Options.OperatorFidelities rather than writing
	a second translator; see apply_defaults. Shipping this inside jsonstor-mongodb would have
	made every other Mango speaker depend on a sibling adapter, which is the cycle shape this
	family broke once already.
*/

module.exports = function ( jsonstor )
{

	//---------------------------------------------------------------------
	// ***What MongoDB does with each jsongin query operator, measured on a live server.***
	//
	// This is the ceiling. It is the same table the plugin publishes as Fidelities at the
	// bottom of the file, declared here so Translate can read it without reaching back
	// through the registry to find itself.
	//
	// ***`exact` here is a measurement, which is what makes it different from SqlExpression***
	// - where nothing claims exact, because nothing had been measured for it. Every operator
	// below was put to both MongoDB and jsongin over one corpus, and the two agreed on all
	// twenty seven. The four extensions did not disagree: the server refused them.
	const FIDELITIES = {
		// Comparison - MongoDB's own, same spelling, same meaning.
		'$eq': 'exact',
		'$ne': 'exact',
		'$gt': 'exact',
		'$gte': 'exact',
		'$lt': 'exact',
		'$lte': 'exact',
		'$in': 'exact',
		'$nin': 'exact',
		// Logical
		'$and': 'exact',
		'$or': 'exact',
		'$nor': 'exact',
		'$not': 'exact',
		// Evaluation
		'$regex': 'exact',
		'$expr': 'exact',
		'$mod': 'exact',
		// Bitwise
		'$bitsAllSet': 'exact',
		'$bitsAllClear': 'exact',
		'$bitsAnySet': 'exact',
		'$bitsAnyClear': 'exact',
		// Array
		'$elemMatch': 'exact',
		'$size': 'exact',
		'$all': 'exact',
		// Element
		'$exists': 'exact',
		'$type': 'exact',
		// Miscellaneous
		//
		// ***$sampleRate is exact or dropped, and must never be called broadening.*** It is
		// the one operator here which does not answer the same way twice. Rendering it and
		// then re-checking it would draw two independent samples and keep their intersection,
		// which at rate p returns p*p of the documents - a narrowing, and the one direction
		// the invariant forbids. Absorbed whole it is one sample drawn once, on the server,
		// which is what the criteria asked for. ***A fidelity is not always a measure of
		// precision; here it is a statement about who is allowed to answer.***
		'$sampleRate': 'exact',
		// $comment annotates a query and constrains nothing. MongoDB accepts it and ignores
		// it, which is exactly what jsongin does with it.
		'$comment': 'exact',
		// Extension
		//
		// ***An internal operator: `{ field: value }` with no operator written.*** MongoDB's
		// implicit form means the same thing, including the two places it differs from $eq -
		// a regexp value pattern matches, and a document of operators is read as operators.
		'$ImplicitEq': 'exact',
		// ***The four jsongin extensions MongoDB has never heard of.*** Not unrendered -
		// refused: the driver answers `unknown operator: $eqx` rather than matching nothing.
		// They are what the residual exists for.
		'$eqx': 'dropped',
		'$nex': 'dropped',
		'$exprx': 'dropped',
		'$noop': 'dropped',
	};


	// In order of decreasing trust, matching OperatorMatrix.FIDELITIES.
	const FIDELITY_RANK = { 'exact': 0, 'broadening': 1, 'dropped': 2 };


	//---------------------------------------------------------------------
	// ***The field level operators whose answer turns on a field the document does not
	// have.*** Every one of them is true in jsongin for a document with no such field: a
	// missing field is not equal to 5, so it satisfies $ne.
	//
	// ***Not every Mango speaker agrees, and the disagreement loses rows.*** Measured against
	// CouchDB 2.3.1 and 3.5.2 on 2026-09-02: `{ n: { $ne: 5 } }` returns only the documents
	// which have an `n`, so a document with none is dropped. MongoDB returns it. The same
	// cause covers an equality against null, which is why $eq is here by its operand rather
	// than by its name.
	const NEGATION_OPERATORS = { '$ne': true, '$nin': true, '$not': true };


	//---------------------------------------------------------------------
	// ***The comparisons which turn on a missing field only when their operand says null.***
	//
	// ***A fidelity is a property of the operator and its operand, and this file read the name
	// alone.*** OperatorMatrix's header has said the other thing since it was written - a cell
	// is a ceiling and the renderer reports the fidelity actually achieved, which depends on
	// the operand - and nothing here asked about an operand except $eq.
	//
	// ***The cost of reading the name alone is an operator dropped for every operand because
	// one shape of operand narrows.*** Measured against CouchDB 2.3.1 and 3.5.2 on 2026-09-03,
	// both servers agreeing on every cell: an operand of null makes $gte and $lte come back
	// short by the documents which have no such field, exactly as $ne does - and the same four
	// comparisons against a number, a string or a boolean lose nothing at all. So the adapter
	// which found this had dropped four comparisons and $in to buy the null case.
	const RANGE_OPERATORS = { '$gt': true, '$gte': true, '$lt': true, '$lte': true };


	//---------------------------------------------------------------------
	// Whether this operand asks about null at all.
	//
	// $in takes a list and one null member is enough: measured, an $in holding null loses the
	// documents which lack the field, and an $in of two numbers loses nothing.
	function operand_asks_about_null( Name, Operand )
	{
		if ( Name === '$in' )
		{
			if ( jsongin.ShortType( Operand ) !== 'a' ) { return false; }
			for ( let index = 0; index < Operand.length; index++ )
			{
				if ( Operand[ index ] === null ) { return true; }
			}
			return false;
		}
		return ( Operand === null );
	}


	//---------------------------------------------------------------------
	// Whether this one condition has to carry an explicit absence test to mean what the
	// criteria means. Always false unless the adapter said its target needs it, so a target
	// which answers negations the way jsongin does is rendered exactly as it was before.
	function condition_needs_absence_test( Name, Operand, options )
	{
		if ( options.ExcludesMissingFields !== true ) { return false; }
		// A negation is one whatever it is given, so its name settles it.
		if ( NEGATION_OPERATORS[ Name ] === true ) { return true; }
		// ***The rest is asked of the operand rather than of the name.*** An equality, a
		// comparison or an $in which mentions null is asking about a value a document without
		// the field also has, so a target which answers only over the documents holding the
		// field comes back short by exactly those.
		if ( ( Name === '$eq' ) || ( Name === '$in' ) || ( RANGE_OPERATORS[ Name ] === true ) )
		{
			return operand_asks_about_null( Name, Operand );
		}
		return false;
	}


	//---------------------------------------------------------------------
	// Builds a one field criteria. Written out rather than with a computed key, because the
	// field name is a variable and the result has to be a plain criteria object.
	function one_field( Name, Value )
	{
		let criteria = {};
		criteria[ Name ] = Value;
		return criteria;
	}


	//---------------------------------------------------------------------
	// ***The second disagreement of the same shape, and it is the commoner one.***
	//
	// ***MongoDB's query language is built on implicit array element matching and CouchDB's
	// Mango has none.*** `{ tags: 'B' }` asks jsongin and MongoDB whether `tags` is 'B'
	// ***or contains it***, and asks CouchDB only the first - so a document whose `tags` is
	// `[ 'A', 'B', 'C' ]` is dropped. Measured on 2.3.1 and 3.5.2, 2026-09-03.
	//
	// ***A criteria cannot say whether a field holds an array***, so this cannot be decided by
	// the operand the way the absence test is. It is decided by the target alone: a target
	// which does not match elements needs the element test on every condition which compares.
	//
	// ***A comparison reaches an array's elements in jsongin exactly as an equality does***,
	// and this asked only about $eq until 2026-09-03. Measured on both CouchDB servers: a $lt
	// against a field holding an array is kept by jsongin and dropped by the server, and the
	// $elemMatch offered beside it agrees again. ***$in is deliberately absent*** - measured on
	// the same corpus, CouchDB's own $in reaches an array's elements, so a repair there would
	// be a widening nothing asked for.
	function condition_needs_element_test( Name, options )
	{
		if ( options.ExcludesArrayElements !== true ) { return false; }
		return ( ( Name === '$eq' ) || ( RANGE_OPERATORS[ Name ] === true ) );
	}


	//---------------------------------------------------------------------
	// ***How deep a path the element repair is rendered for.***
	//
	// ***The branch count doubles per segment*** - two for a plain field, four for one dot,
	// eight for two - so the repair is rendered while the selector stays small and a deeper
	// path is left to the residual, which costs a document read and is never wrong. Four
	// segments is sixteen branches. The limit is not a measurement; it is here so that a path
	// nobody expected cannot silently become a thousand branch selector.
	const MAX_ELEMENT_REPAIR_SEGMENTS = 4;


	//---------------------------------------------------------------------
	// ***Whether the element test can be placed on this field at all.***
	function field_allows_element_test( FieldName )
	{
		return ( String( FieldName ).split( '.' ).length <= MAX_ELEMENT_REPAIR_SEGMENTS );
	}


	//---------------------------------------------------------------------
	// ***Every place an array can sit along a path, one branch each.***
	//
	// `$elemMatch` asks the conditions of each element of ***one*** field, and a dotted path
	// does not say which of its segments holds the array - so the repair asks about each of
	// them in turn. A path matches when the whole path compares, when its ***leaf*** holds an
	// array carrying the value, or when a ***prefix*** holds an array whose elements match the
	// rest of the path, which is the same question one segment shorter.
	//
	// ***The obvious repair is one of the wrong ones, which is why this was measured.*** A
	// disjunct per split of the path - what this file proposed while it was refusing dotted
	// paths outright - repairs an array at a prefix and misses one at the leaf. Measured on
	// CouchDB 2.3.1 and 3.5.2, 2026-09-03, over a corpus holding an array at every position
	// along a two segment and a three segment path: the plain rendering loses four documents of
	// five, the per-split rendering still loses two, and ***the whole set is exact*** for an
	// equality and never narrows for a comparison. Both servers agreed.
	//
	// The returned branches do not include the plain path itself; widened_repair carries that.
	function element_branches( FieldName, Conditions )
	{
		let segments = String( FieldName ).split( '.' );
		// The leaf itself may hold the array, whatever else the path does.
		let branches = [ one_field( FieldName, { $elemMatch: Conditions } ) ];
		for ( let index = 1; index < segments.length; index++ )
		{
			let head = segments.slice( 0, index ).join( '.' );
			let tail = segments.slice( index ).join( '.' );
			// ***Relative to the element***, so the rest of the path is asked without its head -
			// and an adapter mapping field names never reaches inside an operator's operand.
			let rest = [ one_field( tail, Conditions ) ].concat( element_branches( tail, Conditions ) );
			for ( let r = 0; r < rest.length; r++ )
			{
				branches.push( one_field( head, { $elemMatch: rest[ r ] } ) );
			}
		}
		return branches;
	}


	//---------------------------------------------------------------------
	// Whether any condition in this field's operator object needs the element test.
	//
	// ***Asked of the object rather than of $eq***, because the comparisons need the test too
	// and a field carrying a $lt on a dotted path is the same unrepairable shape as one
	// carrying an $eq.
	function operator_object_needs_element_test( Operators, options )
	{
		for ( let key in Operators )
		{
			if ( condition_needs_element_test( key, options ) ) { return true; }
		}
		return false;
	}


	//---------------------------------------------------------------------
	// ***One widening, carrying whichever second questions this condition needs.***
	//
	// ***Both repairs are the same move*** - ask the operand a second way beside the first, so
	// that the pushdown survives instead of falling to the residual - and a condition can need
	// both at once, which is why they are assembled here rather than in two places.
	//
	// Measured on CouchDB 2.3.1 and 3.5.2:
	//   absence   $ne, $nin, $not, $eq null and the implicit null form, 2026-09-02
	//   element   $eq and the implicit form against an array field, 2026-09-03
	//
	// ***This is the jsonb array repair one layer up***, which is where the shape came from.
	function widened_repair( Name, Conditions, NeedsAbsence, NeedsElement )
	{
		let branches = [ one_field( Name, Conditions ) ];
		if ( NeedsAbsence ) { branches.push( one_field( Name, { $exists: false } ) ); }
		// $elemMatch asks the same conditions of each element, which is exactly the question
		// MongoDB answers implicitly and this target does not. One branch for a plain field, and
		// one per place an array can sit when the field is a path.
		if ( NeedsElement ) { branches = branches.concat( element_branches( Name, Conditions ) ); }
		return { $or: branches };
	}


	//---------------------------------------------------------------------
	// ***The implicit form written out.*** `{ n: 5 }` becomes `{ n: { $eq: 5 } }`.
	//
	// ***Only safe for an operand which is not a regular expression.*** MongoDB's implicit
	// form differs from $eq in exactly two places, and one of them is that a regexp value
	// pattern matches rather than compares - so rewriting one would change its meaning. The
	// other is that a document of operators is read as operators, which is decided before this
	// is reached.
	//
	// ***Rewriting is what makes the element repair expressible at all***, because $elemMatch
	// takes a conditions object and a bare value is not one. It is also an improvement on its
	// own: measured 2026-09-03, `{ o: { n: 3.14 } }` reaches CouchDB as a sub-selector and
	// broadens, while `{ o: { $eq: { n: 3.14 } } }` is exact on both servers.
	function explicit_equality( Value )
	{
		return { $eq: Value };
	}


	//---------------------------------------------------------------------
	function apply_defaults( Options )
	{
		let options = Object.assign( {}, Options );

		// ***An adapter narrows the vocabulary and can never widen it.*** A Mango dialect
		// which lacks $bitsAllSet says so here and gets a correct translator for free, which
		// is the whole reason this file is parameterized rather than being MongoDB's alone.
		//
		// The table above is the ceiling and this is clamped against it, so an option only
		// ever lowers a fidelity. Letting it raise one would let an adapter promise an
		// absorption nobody measured, and the residual is the one value in this design which
		// must never be optimistic.
		if ( typeof options.OperatorFidelities === 'undefined' ) { options.OperatorFidelities = null; }

		// ***Declared by the adapter, about its target, and false everywhere it is not.***
		// MongoDB renders exactly as it did before this option existed.
		if ( options.ExcludesMissingFields !== true ) { options.ExcludesMissingFields = false; }

		// ***The same, for a target with no implicit array element matching.*** Off means the
		// target answers an equality the way MongoDB does, which is what MongoDB does.
		if ( options.ExcludesArrayElements !== true ) { options.ExcludesArrayElements = false; }

		let fidelities = {};
		for ( let name in FIDELITIES )
		{
			let ceiling = FIDELITIES[ name ];
			let declared = options.OperatorFidelities ? options.OperatorFidelities[ name ] : undefined;
			if ( typeof FIDELITY_RANK[ declared ] === 'undefined' ) { fidelities[ name ] = ceiling; }
			else if ( FIDELITY_RANK[ declared ] > FIDELITY_RANK[ ceiling ] ) { fidelities[ name ] = declared; }
			else { fidelities[ name ] = ceiling; }
		}
		options.Fidelities = fidelities;
		return options;
	}


	//---------------------------------------------------------------------
	// ***A regular expression operand asks the $regex question, whatever operator it is written
	// under.***
	//
	// `{ tags: { $in: [ /^be/, /^st/ ] } }` is MongoDB's own spelling, and it is a pattern match
	// rather than a comparison - so a target which cannot answer `$regex` cannot answer this
	// either. Rendering it sends a selector comparing against a serialized object, which matches
	// nothing: ***a narrowing, and the one direction the invariant forbids.***
	//
	// ***Found by the shared inventory on 2026-09-03***, the day `$in` began to render at all.
	// MongoDB's own `$in` reference example lost both its documents against CouchDB, and no
	// hand-built corpus had thought to put a regexp inside an `$in`.
	//
	// ***The rule is read from the fidelity table rather than from a new option***, because an
	// adapter has already declared what its target does with `$regex`. A third flag would be a
	// second way of saying something already said.
	function operand_asks_about_regex( Operand )
	{
		let st = jsongin.ShortType( Operand );
		if ( st === 'r' ) { return true; }
		if ( st !== 'a' ) { return false; }
		for ( let index = 0; index < Operand.length; index++ )
		{
			if ( jsongin.ShortType( Operand[ index ] ) === 'r' ) { return true; }
		}
		return false;
	}


	//---------------------------------------------------------------------
	// Whether this operand may be handed to the target at all.
	//
	// $regex is exempt because it is the operator whose own cell decides the question - asking
	// it of itself would be circular, and an adapter which renders $regex declares so there.
	function condition_allows_operand( Name, Operand, options )
	{
		if ( Name === '$regex' ) { return true; }
		if ( !operand_asks_about_regex( Operand ) ) { return true; }
		return operator_is_renderable( '$regex', options );
	}


	//---------------------------------------------------------------------
	// Whether the target decides this operator by itself.
	//
	// ***An operator nobody declared is `dropped`***, which is the safe default and is what
	// makes a new jsongin operator arrive here correct rather than wrong: it is absent from
	// the table, so it lands in the residual and jsongin answers it. Slower, never incorrect.
	function operator_is_exact( Name, options )
	{
		return ( options.Fidelities[ Name ] === 'exact' );
	}


	//---------------------------------------------------------------------
	// Whether the target may be handed this operator at all.
	//
	// ***`broadening` was declared and never rendered.*** `OperatorMatrix` has carried the
	// three fidelities since it was written - exact, broadening, dropped - and `SqlExpression`
	// renders broadening as its ordinary case. This file gated every rendering on `exact`, so
	// a broadening operator behaved exactly like a dropped one and the middle fidelity did
	// nothing. Found 2026-09-02 by the first adapter which needed it.
	//
	// ***The distinction it buys is the whole two stage bargain.*** A broadening operator
	// narrows the search and `jsongin` decides the answer, which is what every SQL adapter in
	// this family already does. Without it a target which merely disagrees about type
	// coercion - CouchDB compares a number against a string, jsongin refuses to - has to drop
	// the operator entirely and send the collection.
	//
	// ***It is only ever asked at an AND position.*** Whole-or-nothing positions - inside an
	// $or, a negation, an $elemMatch - still demand `exact`, because a broadening under a
	// negation comes back out as a narrowing. That is `subtree_is_exact`, unchanged.
	function operator_is_renderable( Name, options )
	{
		let fidelity = options.Fidelities[ Name ];
		return ( ( fidelity === 'exact' ) || ( fidelity === 'broadening' ) );
	}


	//---------------------------------------------------------------------
	// Whether every operator in a subtree is absorbed exactly.
	//
	// ***This is the question asked wherever dropping a part would be unsafe*** - inside an
	// $or, inside a negation, inside an $elemMatch. There the choice is the whole node or none
	// of it, so the whole node has to answer.
	//
	// It walks values as well as keys, because an operator's operand can hold a criteria: $or
	// takes an array of them, $elemMatch takes one, and $not takes an operator object.
	// ***AllowRepair says whether this position is one the repair can reach.*** A criteria is
	// an AND of its keys and so is a field's operator object, so both are repairable. Every
	// other operand - inside $or, $nor, $not, $elemMatch - is copied to the target verbatim,
	// so a narrowing operator found there makes the whole node inexact and it is dropped.
	// ***Conservative on purpose***: only the shapes actually measured are repaired.
	function subtree_is_exact( Node, options, AllowRepair )
	{
		let st = jsongin.ShortType( Node );
		if ( st === 'a' )
		{
			for ( let index = 0; index < Node.length; index++ )
			{
				if ( !subtree_is_exact( Node[ index ], options, AllowRepair ) ) { return false; }
			}
			return true;
		}
		if ( st !== 'o' ) { return true; }
		for ( let key in Node )
		{
			// $options is not an operator of its own. It carries the flags for a sibling
			// $regex and travels with it; jsongin refuses it standing alone, and so does
			// MongoDB. Asking the table about it would find nothing and drop a $regex which
			// is perfectly absorbable.
			if ( key === '$options' ) { continue; }
			if ( key.startsWith( '$' ) )
			{
				if ( !operator_is_exact( key, options ) ) { return false; }
				// A regexp operand is the $regex question wearing another operator's name.
				if ( !condition_allows_operand( key, Node[ key ], options ) ) { return false; }
				// ***Exact only where it can be repaired.*** Left where it cannot, this operator
				// would be copied verbatim and would lose the documents which lack the field,
				// or the documents whose field holds the value inside an array.
				if ( condition_needs_absence_test( key, Node[ key ], options ) && ( AllowRepair !== true ) ) { return false; }
				if ( condition_needs_element_test( key, options ) && ( AllowRepair !== true ) ) { return false; }
			}
			else if ( SUPPORT.IsOperatorObject( Node[ key ] )
				&& !field_allows_element_test( key )
				&& operator_object_needs_element_test( Node[ key ], options ) )
			{
				// ***The explicit form of the same thing, one level down.*** The field name is
				// this key and the condition sits inside its operator object, so the check has
				// to happen here - the recursion below sees `$eq` or `$lt` without ever seeing
				// the path it belongs to, and a path too deep to repair is where the repair has
				// nowhere to go.
				return false;
			}
			else if ( !SUPPORT.IsOperatorObject( Node[ key ] ) )
			{
				// ***A field carrying a plain value is an implicit equality, and nothing here
				// used to ask the table about it.*** push_conjunction did, so the condition was
				// left out of the pushdown - and this function said the criteria was absorbed
				// anyway. An adapter which lowers $ImplicitEq therefore got an empty pushdown
				// with a null residual: ***every document, reported as an exact answer.***
				// Found 2026-09-02 by the first adapter to lower it.
				if ( !operator_is_exact( '$ImplicitEq', options ) ) { return false; }
				// The implicit form of a regexp is the $regex question, wherever it is written.
				if ( !condition_allows_operand( '$ImplicitEq', Node[ key ], options ) ) { return false; }
				// ***The implicit equality needs the element test wherever an equality does***,
				// and a regexp operand is not an equality at all - neither can be rendered
				// where the repair does not fit.
				if ( condition_needs_element_test( '$eq', options ) )
				{
					if ( AllowRepair !== true ) { return false; }
					if ( jsongin.ShortType( Node[ key ] ) === 'r' ) { return false; }
					if ( !field_allows_element_test( key ) ) { return false; }
				}
				// ***And the implicit form of an equality against null needs the same absence
				// test the explicit one gets.*** `{ n: null }` at an AND position is repaired
				// by push_conjunction; inside an $or or a negation there is nowhere to put the
				// repair, so the node cannot be called exact. Left exact, `{ $or: [ { n: null } ] }`
				// went to the target verbatim and lost every document with no `n` at all -
				// ***a narrowing, which is the one direction the invariant forbids.***
				if ( condition_needs_absence_test( '$eq', Node[ key ], options ) && ( AllowRepair !== true ) ) { return false; }
			}
			// $and holds an AND position for its children; every other operator's operand is
			// handed over whole, so a repair cannot be placed inside it.
			let child_allows_repair = AllowRepair;
			if ( key.startsWith( '$' ) && ( key !== '$and' ) ) { child_allows_repair = false; }
			if ( !subtree_is_exact( Node[ key ], options, child_allows_repair ) ) { return false; }
		}
		return true;
	}


	//---------------------------------------------------------------------
	// Builds a pushdown which admits at least every document the criteria admits.
	//
	// ***A criteria is an AND of its keys, so a key may be left out and the result broadens.***
	// That is the only move this function makes. Everything else is deciding whether a given
	// key may be left out on its own, or has to be kept whole.
	function push_conjunction( Criteria, options )
	{
		let pushdown = {};
		let repairs = [];
		if ( jsongin.ShortType( Criteria ) !== 'o' ) { return pushdown; }

		for ( let key in Criteria )
		{
			let value = Criteria[ key ];

			// ***$and is the one logical operator whose children are an AND position too***,
			// so each child is pruned on its own rather than kept or dropped whole. A child
			// which prunes away to nothing is left out, and an $and which loses every child
			// goes with them - MongoDB refuses an empty $and array.
			if ( key === '$and' )
			{
				if ( jsongin.ShortType( value ) !== 'a' ) { continue; }
				let children = [];
				for ( let index = 0; index < value.length; index++ )
				{
					let child = push_conjunction( value[ index ], options );
					if ( Object.keys( child ).length ) { children.push( child ); }
				}
				if ( children.length ) { pushdown.$and = children; }
				continue;
			}

			// $options never stands alone. It is copied in beside the $regex it belongs to,
			// in push_field_conditions, and left out with it - a $regex which loses its 'i'
			// flag matches fewer strings, which is a narrowing wearing a simplification's
			// clothes.
			if ( key === '$options' ) { continue; }

			// Every other operator at this level - $or, $nor, $expr, and every extension - is
			// kept whole or dropped whole. Its children are not an AND position, or are not
			// reliably one, and the difference is not worth guessing at.
			if ( key.startsWith( '$' ) )
			{
				if ( !operator_is_exact( key, options ) ) { continue; }
				if ( !subtree_is_exact( value, options, false ) ) { continue; }
				pushdown[ key ] = value;
				continue;
			}

			// A field. Its value is either an operator object - an AND of conditions on that
			// one field, which is an AND position and can be pruned - or a value the field
			// must equal, which is the implicit form and has nothing to prune.
			if ( SUPPORT.IsOperatorObject( value ) )
			{
				let split = push_field_conditions( key, value, options );
				if ( Object.keys( split.Conditions ).length ) { pushdown[ key ] = split.Conditions; }
				// ***The conditions needing a widening travel separately***, one $or per kind
				// of widening they need.
				for ( let signature in split.Widened )
				{
					let group = split.Widened[ signature ];
					repairs.push( widened_repair( key, group.Conditions, group.Absence, group.Element ) );
				}
				continue;
			}

			// ***An AND position, so a broadening rendering is safe here.*** The condition
			// narrows the search and the residual - which is not null, because the criteria
			// holds an operator which is not exact - decides the answer.
			if ( !operator_is_renderable( '$ImplicitEq', options ) ) { continue; }
			// ***And an implicit regexp is the $regex question too.*** `{ s: /^a/ }` is a pattern
			// match written without an operator, so it belongs wherever $regex is renderable and
			// nowhere else.
			if ( !condition_allows_operand( '$ImplicitEq', value, options ) ) { continue; }

			// The implicit form of the same thing: `{ n: null }` reads as an equality, and
			// `{ tags: 'B' }` is the equality which has to reach an array's elements.
			let implicit_absence = condition_needs_absence_test( '$eq', value, options );
			let implicit_element = condition_needs_element_test( '$eq', options );

			// ***A regexp value pattern is the one implicit operand which is not an
			// equality***, so it is never rewritten and never repaired. Left out rather than
			// rendered, because neither repair below would mean what it says.
			if ( implicit_element && ( jsongin.ShortType( value ) === 'r' ) ) { continue; }
			// And a path deeper than the repair is rendered for is left to the residual.
			if ( implicit_element && !field_allows_element_test( key ) ) { continue; }

			if ( implicit_absence || implicit_element )
			{
				// Written out, because $elemMatch takes a conditions object and a bare value
				// is not one - and because the explicit form is the more exact of the two
				// against an object operand.
				let conditions = implicit_element ? explicit_equality( value ) : value;
				repairs.push( widened_repair( key, conditions, implicit_absence, implicit_element ) );
				continue;
			}
			pushdown[ key ] = value;
		}

		// ***A criteria is an AND of its keys, so the repairs join it as more of them.*** They
		// go under $and because each one is an $or and a criteria object holds one key of any
		// given name.
		if ( repairs.length )
		{
			if ( jsongin.ShortType( pushdown.$and ) === 'a' ) { pushdown.$and = pushdown.$and.concat( repairs ); }
			else { pushdown.$and = repairs; }
		}

		return pushdown;
	}


	//---------------------------------------------------------------------
	// Prunes the operator object on one field. `{ $gt: 1, $eqx: 2 }` is an AND of two
	// conditions on that field, so keeping the first and leaving out the second broadens it.
	// ***Returns two objects rather than one.*** Conditions render against the field as they
	// always have; AbsenceConditions are the ones which need the field's absence offered
	// beside them, and are empty unless the adapter asked for that.
	// ***Returns one plain bucket and a bucket per kind of widening.*** A condition can need
	// the absence test, the element test, or both, and conditions needing the same pair are
	// rendered under one $or - so a field carrying `$gt: 1` and `$ne: 5` keeps the first as an
	// ordinary condition and widens only the second.
	function push_field_conditions( FieldName, Operators, options )
	{
		let conditions = {};
		// Keyed by which repairs the conditions in it need: 'A', 'E' or 'AE'.
		let widened = {};
		for ( let key in Operators )
		{
			if ( key === '$options' ) { continue; }
			// ***A field's operator object is an AND of its conditions***, so a broadening
			// condition may be rendered beside the others - it narrows the search and never
			// the answer. The operand is still handed over whole, so its interior must be
			// exact.
			if ( !operator_is_renderable( key, options ) ) { continue; }
			if ( !condition_allows_operand( key, Operators[ key ], options ) ) { continue; }
			if ( !subtree_is_exact( Operators[ key ], options, false ) ) { continue; }

			let needs_absence = condition_needs_absence_test( key, Operators[ key ], options );
			let needs_element = condition_needs_element_test( key, options );
			// A path deeper than the repair is rendered for is left out of the pushdown.
			if ( needs_element && !field_allows_element_test( FieldName ) ) { continue; }

			let target = conditions;
			if ( needs_absence || needs_element )
			{
				// ***One widening carrying two comparisons is not the same question as two
				// widenings.*** `{ dim: { $gt: 15, $lt: 20 } }` matches in jsongin when one element
				// of an array satisfies each condition and no element satisfies both, and an
				// $elemMatch carrying the pair demands a single element satisfy both - ***narrower
				// than what was asked.*** So a condition needing the element test is widened alone,
				// and only conditions needing the absence test may share a branch, because a
				// missing field satisfies every one of them at once.
				//
				// ***Found by the shared inventory on 2026-09-03***, where it is MongoDB's own
				// tutorial: *Query an Array with Compound Filter Conditions on the Array Elements*.
				let signature = needs_element ? `E ${key}` : 'A';
				if ( typeof widened[ signature ] === 'undefined' )
				{
					widened[ signature ] = { Absence: needs_absence, Element: needs_element, Conditions: {} };
				}
				target = widened[ signature ].Conditions;
			}

			target[ key ] = Operators[ key ];
			// A kept $regex takes its flags with it.
			if ( ( key === '$regex' ) && ( typeof Operators.$options !== 'undefined' ) )
			{
				target.$options = Operators.$options;
			}
		}
		return { Conditions: conditions, Widened: widened };
	}


	//---------------------------------------------------------------------
	// ***The public entry point, and the only one.***
	//
	// Returns:
	//
	//   Pushdown   A MongoDB query document. ***Opaque to jsonstor*** - only the adapter
	//              which chose this translator gives it meaning. An empty object is Mango for
	//              "every document", which is what a criteria it could absorb nothing of
	//              comes back as.
	//   Residual   The part of the criteria the pushdown does not decide exactly, or ***null
	//              when it decides all of it***. Null is what lets the adapter skip the
	//              jsongin re-check and mutate on the server.
	//   *Absorbed  Whether the translator took responsibility for that part of the query.
	//              All false here: only the criteria is implemented. MongoDB can sort, project
	//              and limit on the server, and saying so is a later, additive change.
	function Translate( Request )
	{
		if ( jsongin.ShortType( Request ) !== 'o' ) { throw new Error( `The Request parameter must be an object.` ); }
		let options = apply_defaults( Request.Options );
		let criteria = Request.Criteria;

		// ***The residual is decided by the vocabulary, not by what the pruning gave back.***
		// Comparing the pushdown against the criteria would be the same question asked of two
		// trees, and it would be wrong in the case that matters most: a criteria carrying a
		// $noop prunes to an object which looks untouched, because $noop constrains nothing
		// and leaves no gap behind when it goes.
		//
		// ***A criteria which is not a criteria is never absorbed.*** subtree_is_exact answers
		// true for a scalar, and correctly so - a scalar holds no operator this translator
		// cannot read. But holding nothing unreadable is not the same as meaning something,
		// and absorbing one would turn `Count( 'nonsense' )` into a count of every document.
		// That is precisely the failure jsongin's refuse() exists to prevent: a typo must
		// never be indistinguishable from an empty result. Left unabsorbed it reaches jsongin,
		// which refuses it.
		//
		// ***Null and undefined are not typos - they are the whole collection***, which is the
		// contract every other adapter in this family keeps: `Count()` and `Count( null )`
		// count everything, and only some other non-object is refused. They absorb to an empty
		// pushdown, which is Mango for the same thing.
		//
		// ***And null is the one value which could not have been reported any other way.***
		// The residual for an unabsorbed criteria is the criteria, so a null one would come
		// back as `Residual: null` - indistinguishable from the signal that the target settled
		// it. That the two meanings agree here is not luck to lean on: it is why the type is
		// decided before the vocabulary is, rather than after.
		let exact = 'olu'.includes( jsongin.ShortType( criteria ) ) && subtree_is_exact( criteria, options, true );

		return {
			Pushdown: push_conjunction( criteria, options ),
			// ***Null means the target answered the whole question, and this is the first
			// translator which can say so.*** It is not an optimization bolted on: it is the
			// behavior jsonstor-mongodb has always had, now conditional on the one check which
			// makes it true. For the four extensions the answer is the whole criteria, which
			// is every other adapter's permanent answer.
			Residual: exact ? null : criteria,
			SortAbsorbed: false,
			ProjectionAbsorbed: false,
			LimitAbsorbed: false,
		};
	}


	// ***A translator is a plugin, the way an adapter and a filter already are.***
	// jsonstor.LoadPlugin files this under jsonstor.Translators by TranslatorName.
	return {
		TranslatorName: 'MangoExpression',
		Translate: Translate,
		// The table above, published. It is the ceiling an adapter's OperatorFidelities is
		// clamped against, and the column OperatorMatrix reads.
		Fidelities: FIDELITIES,
	};
};
