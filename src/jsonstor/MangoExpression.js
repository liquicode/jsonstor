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
	// Whether every operator in a subtree is absorbed exactly.
	//
	// ***This is the question asked wherever dropping a part would be unsafe*** - inside an
	// $or, inside a negation, inside an $elemMatch. There the choice is the whole node or none
	// of it, so the whole node has to answer.
	//
	// It walks values as well as keys, because an operator's operand can hold a criteria: $or
	// takes an array of them, $elemMatch takes one, and $not takes an operator object.
	function subtree_is_exact( Node, options )
	{
		let st = jsongin.ShortType( Node );
		if ( st === 'a' )
		{
			for ( let index = 0; index < Node.length; index++ )
			{
				if ( !subtree_is_exact( Node[ index ], options ) ) { return false; }
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
			}
			if ( !subtree_is_exact( Node[ key ], options ) ) { return false; }
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
				if ( !subtree_is_exact( value, options ) ) { continue; }
				pushdown[ key ] = value;
				continue;
			}

			// A field. Its value is either an operator object - an AND of conditions on that
			// one field, which is an AND position and can be pruned - or a value the field
			// must equal, which is the implicit form and has nothing to prune.
			if ( SUPPORT.IsOperatorObject( value ) )
			{
				let conditions = push_field_conditions( value, options );
				if ( Object.keys( conditions ).length ) { pushdown[ key ] = conditions; }
				continue;
			}

			if ( !operator_is_exact( '$ImplicitEq', options ) ) { continue; }
			pushdown[ key ] = value;
		}

		return pushdown;
	}


	//---------------------------------------------------------------------
	// Prunes the operator object on one field. `{ $gt: 1, $eqx: 2 }` is an AND of two
	// conditions on that field, so keeping the first and leaving out the second broadens it.
	function push_field_conditions( Operators, options )
	{
		let conditions = {};
		for ( let key in Operators )
		{
			if ( key === '$options' ) { continue; }
			if ( !operator_is_exact( key, options ) ) { continue; }
			if ( !subtree_is_exact( Operators[ key ], options ) ) { continue; }
			conditions[ key ] = Operators[ key ];
			// A kept $regex takes its flags with it.
			if ( ( key === '$regex' ) && ( typeof Operators.$options !== 'undefined' ) )
			{
				conditions.$options = Operators.$options;
			}
		}
		return conditions;
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
		let exact = 'olu'.includes( jsongin.ShortType( criteria ) ) && subtree_is_exact( criteria, options );

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
