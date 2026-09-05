'use strict';

const jsongin = require( '@liquicode/jsongin' );
const SUPPORT = require( './TranslatorSupport' )();

/*
	Builds an Elasticsearch Query DSL object from a jsonstor criteria.

	***This is the third corner of the translator design and the first one which assembles an
	object in a foreign language.*** SqlExpression assembles a string in a foreign language.
	MangoExpression prunes a tree in a language the target mostly shares - twenty seven of
	jsongin's thirty one operators are MongoDB's own, spelled the same way. Query DSL shares
	none of that spelling: $gte is `{ range: { field: { gte: v } } }`, $and is `bool.filter`,
	$or is `bool.should` with `minimum_should_match`, and there is no criteria-shaped thing to
	prune. Every clause here is built rather than kept.

	***One translator, two products.*** Elasticsearch and OpenSearch answered all thirty one
	operators identically on 2026-09-05 - same renderings, same coercion, same null behavior -
	so this file serves both, the way MangoExpression serves MongoDB and CouchDB. See
	jsonx/.plans/wave-5-query-languages.md.

	***The invariant is the same one every translator obeys:*** a pushdown may admit documents
	the criteria rejects, and must never reject one the criteria admits. Returning too many
	costs time; returning too few is a wrong answer nothing downstream can correct.

	## Why almost nothing here is exact

	***Elasticsearch coerces on the way in, and that is not a setting to turn off.*** A field
	mapped `double` which receives the string '10' stores 10 in the index; `_source` still reads
	"10", so the document comes back unchanged and the *index* has quietly agreed that a string
	and a number are the same value. jsongin does not agree, and never will - it compares by
	type.

	***The obvious repair is worse and was measured.*** The same document under `coerce: false`
	is refused outright with `failed to parse field [n] of type [double]`. So a JSON store on a
	typed index chooses between comparisons which admit too much and a store which cannot hold
	the document at all. ***This is the first target in the family where the storage layer
	itself changes the value*** - every SQL adapter keeps the payload verbatim and pushes down
	beside it.

	***So every comparison declares `broadening`, and the negations fall out of that.*** A
	negation wrapping a broadening operand comes back out ***narrowing***, which is the one
	direction the invariant forbids: measured, $ne, $nin, $nor and $not each dropped exactly the
	document holding '10'. That is not a new rule - MangoExpression already keeps $or, $not and
	$nor whole or drops them whole, "where anything imprecise inside comes back out inverted".
	***Here it means a negation is renderable only over an exact subtree, and with no exact
	comparison to build one from, negation is dropped.*** The check is written out anyway rather
	than short-circuited, because the day a field becomes exact is the day it should start
	working without anyone remembering this paragraph.

	## Two things the mapping decides, not the operator

	***An analyzed field cannot carry an equality pushdown.*** A `text` field answers the same
	for 'widget' and 'Widget' - the analyzer doing its job, and the wrong answer for $eq. A
	`keyword` field answers only the value it holds. So a field the adapter marks `analyzed`
	is not pushable at all: not broadening, ***unpushable***, because it cannot distinguish the
	values the criteria distinguishes.

	***And a null is not an absent field, unless the mapping says so.*** Elasticsearch does not
	index a null, so `exists` cannot tell `{ nul: null }` from a document with no `nul` at all,
	while jsongin asks whether the key is present and says both. Measured: $exists narrowed.
	***A `null_value` sentinel in the mapping repairs it exactly*** - `exists` then answers the
	same documents jsongin does, and a term query on the sentinel isolates the null one. So
	$exists is exact where the adapter declares a sentinel and dropped where it does not, which
	makes it a property of the mapping rather than of the operator.

	## What is not rendered, and why it is not a defect

	***$mod, the four $bits operators, $expr and $size have measured Painless renderings which
	are deliberately not shipped.*** Each one works - they were run - but a script query is not
	cacheable, is evaluated per document, and throws on a document whose field is missing unless
	every rendering carries its own guard. ***A dropped operator costs a row read; a script which
	throws costs the query.*** They are additive later, and the measurements are in the wave
	document so nobody has to re-derive them.

	***$sampleRate is dropped rather than broadened, and that is a rule rather than a
	preference.*** Rendering an approximation and re-checking it draws two independent samples
	and keeps their intersection, which at rate p returns p*p of the documents - a narrowing.
	MangoExpression carries the same reasoning; Elasticsearch simply has no filter form of it.
*/

module.exports = function ( jsonstor )
{

	//---------------------------------------------------------------------
	// ***What Elasticsearch and OpenSearch do with each jsongin query operator, measured on
	// live servers of both products on 2026-09-05.***
	//
	// This is the ceiling, not a promise. A cell declares the best achievable fidelity and the
	// renderer reports the actual one, which depends on the operand and on the mapping - see
	// OperatorMatrix. Anything undeclared is dropped, which is always correct and merely slow.
	const FIDELITIES = {
		// Comparison. ***Broadening, all of them, because the index coerces.*** See the header.
		'$eq': 'broadening',
		'$gt': 'broadening',
		'$gte': 'broadening',
		'$lt': 'broadening',
		'$lte': 'broadening',
		'$in': 'broadening',
		// ***The negating comparisons have no ceiling above dropped here.*** Their rendering is
		// correct only over an exact operand, and coercion means there is no exact comparison
		// to give them. Declared dropped rather than exact-in-principle, so the table says what
		// this translator will actually do.
		'$ne': 'dropped',
		'$nin': 'dropped',
		// Logical. A conjunction is as exact as its children; a disjunction is kept whole or
		// dropped whole.
		'$and': 'exact',
		'$or': 'exact',
		'$nor': 'dropped',
		'$not': 'dropped',
		// Evaluation. $regex renders only the literal patterns which mean the same thing in
		// both dialects - see render_regex. Lucene has no lookaround and no backreference, so
		// a general translation could silently narrow.
		'$regex': 'broadening',
		'$expr': 'dropped',
		'$mod': 'dropped',
		// Bitwise. Painless renderings measured, not shipped. See the header.
		'$bitsAllSet': 'dropped',
		'$bitsAllClear': 'dropped',
		'$bitsAnySet': 'dropped',
		'$bitsAnyClear': 'dropped',
		// Array. A scalar array field matches if any of its elements match, which is
		// $elemMatch's own rule and $all's as a conjunction of terms.
		'$elemMatch': 'broadening',
		'$all': 'broadening',
		'$size': 'dropped',
		// Element. $exists is exact where the mapping declares a null sentinel, and the
		// renderer drops it where it does not.
		'$exists': 'exact',
		'$type': 'dropped',
		// Miscellaneous. $comment annotates and constrains nothing, which is what jsongin does
		// with it too. $sampleRate has no filter form - see the header for why broadening it
		// would be a narrowing.
		'$comment': 'exact',
		'$sampleRate': 'dropped',
		// Extension. `{ field: value }` with no operator written.
		'$ImplicitEq': 'broadening',
		// ***The four jsongin extensions no target has heard of.*** Unlike Mango, nothing is
		// refused here - they are simply never rendered, so they cost a row read.
		'$eqx': 'dropped',
		'$nex': 'dropped',
		'$exprx': 'dropped',
		'$noop': 'dropped',
	};

	const FIDELITY_ORDER = [ 'exact', 'broadening', 'dropped' ];


	//---------------------------------------------------------------------
	// An adapter may narrow the table and may never widen it. Same clamp MangoExpression
	// applies, for the same reason: a target which speaks a subset says so in its own settings
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
	// ***A mapping is the Columns model wearing another hat.*** A field the adapter did not
	// declare lives in the payload and has no queryable form, exactly as an undeclared column
	// does for the SQL family. An entry may carry:
	//
	//   short_type     the jsongin type the field is mapped for, if the adapter knows it
	//   analyzed       true for a `text` field, which cannot carry an equality
	//   null_sentinel  the mapping's `null_value`, which is what makes $exists answerable
	//
	// The first two are TranslatorSupport's own vocabulary. The third is this target's.
	function field_entry( FieldName, options )
	{
		if ( !options.AllowedFields ) { return null; }
		if ( !FieldName ) { return null; }
		return options.AllowedFields[ FieldName ] || null;
	}


	//---------------------------------------------------------------------
	function field_is_pushable( FieldName, options )
	{
		let field = field_entry( FieldName, options );
		if ( !field ) { return false; }
		// ***An analyzer is not an equality.*** See the header.
		if ( field.analyzed === true ) { return false; }
		return true;
	}


	//---------------------------------------------------------------------
	// Whether a value can be the operand of a term or range query at all. Objects and arrays
	// have no scalar form, and a null is asked about with the sentinel instead.
	function is_scalar_operand( Value )
	{
		return 'nsb'.includes( jsongin.ShortType( Value ) );
	}


	//---------------------------------------------------------------------
	// ***A null operand matches a null and an absent field both.*** That is jsongin's rule and
	// MongoDB's before it: `{ a: null }` admits a document which has no `a` at all.
	//
	// ***Found by measurement rather than by reading, and it cost two documents.*** The first
	// rendering asked only about the sentinel and lost every document which simply had no such
	// field - a narrowing, which is the one thing this file may not do.
	//
	// ***The two mappings need opposite renderings, which is the part worth keeping.*** Where a
	// sentinel is declared a null is a real indexed value, so `exists` is true for it and the
	// absent documents have to be added back by hand. Where no sentinel is declared a null is
	// invisible to the index, so `exists` is already false for both cases and the plain
	// negation is not just correct but exact. ***The mapping which looked like the poorer one
	// gives the simpler query.***
	function null_match( FieldName, options )
	{
		let field = field_entry( FieldName, options );
		if ( !field ) { return null; }
		let absent = { bool: { must_not: [ { exists: { field: FieldName } } ] } };
		if ( typeof field.null_sentinel === 'undefined' ) { return absent; }
		return {
			bool: {
				should: [ { term: { [ FieldName ]: field.null_sentinel } }, absent ],
				minimum_should_match: 1,
			},
		};
	}


	//---------------------------------------------------------------------
	// ***Only the patterns which mean the same thing in both dialects.***
	//
	// Lucene's regexp is anchored at both ends and has neither lookaround nor backreference,
	// while a jsongin pattern is a JavaScript regular expression matching anywhere. Translating
	// the general case would sometimes narrow, which is the one failure this file may not
	// have - so the safe subset is rendered and everything else is dropped:
	//
	//   ^literal   a prefix     -> literal.*
	//   literal$   a suffix     -> .*literal
	//   ^literal$  the whole    -> literal
	//   literal    anywhere     -> .*literal.*
	//
	// where `literal` holds no regular expression metacharacter at all. That is the shape of
	// most criteria anyone writes and it is provably the same query on both sides.
	const REGEX_METACHARACTERS = '\\^$.|?*+()[]{}';

	function render_regex( FieldName, Operand, Options_i )
	{
		let pattern = null;
		let insensitive = false;
		let st = jsongin.ShortType( Operand );
		if ( st === 's' ) { pattern = Operand; }
		else if ( st === 'r' ) { pattern = Operand.source; insensitive = Operand.flags.includes( 'i' ); }
		else { return null; }
		if ( Options_i && Options_i.includes( 'i' ) ) { insensitive = true; }

		let anchored_start = pattern.startsWith( '^' );
		let anchored_end = pattern.endsWith( '$' );
		let literal = pattern;
		if ( anchored_start ) { literal = literal.slice( 1 ); }
		if ( anchored_end ) { literal = literal.slice( 0, -1 ); }
		if ( !literal.length ) { return null; }
		for ( let index = 0; index < literal.length; index++ )
		{
			if ( REGEX_METACHARACTERS.includes( literal[ index ] ) ) { return null; }
		}

		let value = literal;
		if ( !anchored_start ) { value = '.*' + value; }
		if ( !anchored_end ) { value = value + '.*'; }
		return { regexp: { [ FieldName ]: { value: value, case_insensitive: insensitive } } };
	}


	//---------------------------------------------------------------------
	// One condition on one field. Returns a Query DSL object, or null meaning "not rendered",
	// which every caller has to treat as its own position demands.
	function render_condition( FieldName, Operator, Operand, options )
	{
		if ( !field_is_pushable( FieldName, options ) ) { return null; }
		if ( options.Fidelities[ Operator ] === 'dropped' ) { return null; }

		switch ( Operator )
		{
			case '$eq':
			case '$ImplicitEq':
				if ( jsongin.ShortType( Operand ) === 'l' ) { return null_match( FieldName, options ); }
				if ( !is_scalar_operand( Operand ) ) { return null; }
				return { term: { [ FieldName ]: Operand } };

			case '$gt':
			case '$gte':
			case '$lt':
			case '$lte':
			{
				// A boolean has no ordering in Elasticsearch and jsongin refuses a cross type
				// ordering anyway, so only numbers and strings are rendered.
				if ( !'ns'.includes( jsongin.ShortType( Operand ) ) ) { return null; }
				let bound = Operator.slice( 1 );
				return { range: { [ FieldName ]: { [ bound ]: Operand } } };
			}

			case '$in':
			{
				if ( jsongin.ShortType( Operand ) !== 'a' ) { return null; }
				let split = SUPPORT.SplitNullValues( Operand );
				for ( let index = 0; index < split.Values.length; index++ )
				{
					if ( !is_scalar_operand( split.Values[ index ] ) ) { return null; }
				}
				let branches = [];
				if ( split.Values.length ) { branches.push( { terms: { [ FieldName ]: split.Values } } ); }
				if ( split.HasNull )
				{
					// ***A null in the list carries the same null-or-absent meaning*** as a bare
					// null operand does. Answering only the non-null half would lose every
					// document holding null, and every document holding nothing.
					let null_branch = null_match( FieldName, options );
					if ( !null_branch ) { return null; }
					branches.push( null_branch );
				}
				if ( !branches.length ) { return null; }
				if ( branches.length === 1 ) { return branches[ 0 ]; }
				return { bool: { should: branches, minimum_should_match: 1 } };
			}

			case '$all':
			{
				if ( jsongin.ShortType( Operand ) !== 'a' ) { return null; }
				if ( !Operand.length ) { return null; }
				let terms = [];
				for ( let index = 0; index < Operand.length; index++ )
				{
					if ( !is_scalar_operand( Operand[ index ] ) ) { return null; }
					terms.push( { term: { [ FieldName ]: Operand[ index ] } } );
				}
				// Every element present, which for a scalar array is a conjunction of terms.
				return { bool: { filter: terms } };
			}

			case '$elemMatch':
			{
				// ***A scalar array field matches when any element matches***, which is exactly
				// what a term or range against the field name already means in Elasticsearch.
				// An operand naming sub-fields describes objects in the array and needs a
				// `nested` mapping, which this translator does not claim.
				if ( !SUPPORT.IsOperatorObject( Operand ) ) { return null; }
				return render_operator_object( FieldName, Operand, options );
			}

			case '$exists':
			{
				if ( jsongin.ShortType( Operand ) !== 'b' ) { return null; }
				// ***Without a sentinel this narrows, so it is not rendered at all.*** See the
				// header: the index holds nothing for a null, so `exists` answers fewer
				// documents than jsongin does.
				let field = field_entry( FieldName, options );
				if ( !field || typeof field.null_sentinel === 'undefined' ) { return null; }
				let exists = { exists: { field: FieldName } };
				if ( Operand === true ) { return exists; }
				return { bool: { must_not: [ exists ] } };
			}

			case '$regex':
				return render_regex( FieldName, Operand, options.RegexOptions );

			default:
				return null;
		}
	}


	//---------------------------------------------------------------------
	// An operator object - `{ $gte: 1, $lte: 5 }` - is an AND of its conditions on one field,
	// so an unrendered condition is dropped and the rest still stand.
	function render_operator_object( FieldName, Operators, options )
	{
		let clauses = [];
		let names = Object.keys( Operators );
		for ( let index = 0; index < names.length; index++ )
		{
			let name = names[ index ];
			// $options is not a condition. It qualifies the $regex beside it.
			if ( name === '$options' ) { continue; }
			let inner = Object.assign( {}, options );
			if ( name === '$regex' ) { inner.RegexOptions = Operators[ '$options' ]; }
			let clause = render_condition( FieldName, name, Operators[ name ], inner );
			if ( clause ) { clauses.push( clause ); }
		}
		if ( !clauses.length ) { return null; }
		if ( clauses.length === 1 ) { return clauses[ 0 ]; }
		return { bool: { filter: clauses } };
	}


	//---------------------------------------------------------------------
	// One key of a criteria object. A field name carries either an operator object or a value
	// the field must equal; a $ key is a logical operator over criteria of its own.
	function render_key( Key, Value, options )
	{
		if ( !Key.startsWith( '$' ) )
		{
			if ( SUPPORT.IsOperatorObject( Value ) ) { return render_operator_object( Key, Value, options ); }
			return render_condition( Key, '$ImplicitEq', Value, options );
		}

		switch ( Key )
		{
			case '$and':
			{
				if ( jsongin.ShortType( Value ) !== 'a' ) { return null; }
				let clauses = [];
				for ( let index = 0; index < Value.length; index++ )
				{
					// ***Dropping a child of an AND is safe*** - the clause admits more and the
					// residual decides the rest. This is the only operator that is true of.
					let clause = render_criteria( Value[ index ], options );
					if ( clause ) { clauses.push( clause ); }
				}
				if ( !clauses.length ) { return null; }
				return { bool: { filter: clauses } };
			}

			case '$or':
			{
				if ( jsongin.ShortType( Value ) !== 'a' ) { return null; }
				if ( !Value.length ) { return null; }
				let clauses = [];
				for ( let index = 0; index < Value.length; index++ )
				{
					let clause = render_criteria( Value[ index ], options );
					// ***An $or is kept whole or dropped whole.*** Dropping one branch narrows
					// the disjunction to the others and loses exactly the documents that branch
					// was there for - the asymmetry TranslatorSupport was written about.
					if ( !clause ) { return null; }
					clauses.push( clause );
				}
				return { bool: { should: clauses, minimum_should_match: 1 } };
			}

			case '$not':
			case '$nor':
			{
				// ***A negation is renderable only over an exact subtree.*** Anything imprecise
				// inside comes back out inverted, and inverted broadening is narrowing. With no
				// exact comparison in this dialect the check always refuses today; it is
				// written out so that it stops refusing on its own when one arrives.
				if ( !subtree_is_exact( Value, options ) ) { return null; }
				let inner = ( jsongin.ShortType( Value ) === 'a' ) ? Value : [ Value ];
				let clauses = [];
				for ( let index = 0; index < inner.length; index++ )
				{
					let clause = render_criteria( inner[ index ], options );
					if ( !clause ) { return null; }
					clauses.push( clause );
				}
				return { bool: { must_not: clauses } };
			}

			case '$comment':
				// Annotates the query and constrains nothing, which is what jsongin does with
				// it. Rendering nothing here is not a drop - there is no condition to lose.
				return null;

			default:
				return null;
		}
	}


	//---------------------------------------------------------------------
	// A criteria object is an AND of its keys.
	function render_criteria( Criteria, options )
	{
		if ( jsongin.ShortType( Criteria ) !== 'o' ) { return null; }
		let clauses = [];
		let keys = Object.keys( Criteria );
		for ( let index = 0; index < keys.length; index++ )
		{
			let clause = render_key( keys[ index ], Criteria[ keys[ index ] ], options );
			if ( clause ) { clauses.push( clause ); }
		}
		if ( !clauses.length ) { return null; }
		if ( clauses.length === 1 ) { return clauses[ 0 ]; }
		return { bool: { filter: clauses } };
	}


	//---------------------------------------------------------------------
	// Whether every operator in a subtree is exact, and every field it names is pushable.
	//
	// ***This decides two different things and they are the same question.*** Whether a
	// negation may be rendered at all, and whether the residual may be null. A subtree holding
	// one broadening comparison is neither negatable nor absorbable.
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

		let keys = Object.keys( Node );
		for ( let index = 0; index < keys.length; index++ )
		{
			let key = keys[ index ];
			if ( key.startsWith( '$' ) )
			{
				if ( key === '$options' ) { continue; }
				if ( options.Fidelities[ key ] !== 'exact' ) { return false; }
			}
			else
			{
				// A field nobody declared lives in the payload, and a payload field settles
				// nothing however precise the operator over it is.
				if ( !field_is_pushable( key, options ) ) { return false; }
				// ***A field name carrying a plain value is an implicit equality, and its
				// fidelity is what decides this subtree.*** There is no $ key to read it from,
				// so a walk which only inspects $ keys sees an empty criteria and calls it
				// exact.
				//
				// ***Measured, not reasoned: this is what let `$nor: [ { n: 10 } ]` render as a
				// `must_not` and lose the document coercion had widened the term to.*** It was
				// also declaring `Residual: null` on broadening criteria - telling the adapter
				// to skip the jsongin re-check over rows the pushdown had over-admitted, which
				// is the same defect arriving by the other door.
				if ( !SUPPORT.IsOperatorObject( Node[ key ] ) )
				{
					if ( options.Fidelities[ '$ImplicitEq' ] !== 'exact' ) { return false; }
				}
			}
			if ( !subtree_is_exact( Node[ key ], options ) ) { return false; }
		}
		return true;
	}


	//---------------------------------------------------------------------
	// ***The public entry point, and the only one.***
	//
	// Returns:
	//
	//   Pushdown   An Elasticsearch Query DSL query object. ***Opaque to jsonstor*** - only the
	//              adapter which chose this translator gives it meaning. `{ match_all: {} }` is
	//              Query DSL for every document, which is what a criteria this could absorb
	//              nothing of comes back as.
	//   Residual   The part of the criteria the pushdown does not decide exactly, or null when
	//              it decides all of it. ***Null will be rare here and that is correct*** - a
	//              coercing index cannot settle a typed comparison by itself.
	//   *Absorbed  Whether the translator took responsibility for that part of the query. All
	//              false: only the criteria is implemented. Elasticsearch can sort, page and
	//              return fields on the server, and saying so is a later, additive change.
	function Translate( Request )
	{
		if ( jsongin.ShortType( Request ) !== 'o' ) { throw new Error( `The Request parameter must be an object.` ); }
		let options = apply_defaults( Request.Options );
		let criteria = Request.Criteria;

		// ***A criteria which is not a criteria is never absorbed.*** Null and undefined are
		// the whole collection, which every adapter in this family agrees on; some other
		// non-object is a typo, and a typo must never be indistinguishable from an empty
		// result. Left unabsorbed it reaches jsongin, which refuses it. Same reasoning as
		// MangoExpression, and the type is decided before the vocabulary for the same reason.
		let st = jsongin.ShortType( criteria );
		if ( 'lu'.includes( st ) )
		{
			return {
				Pushdown: { match_all: {} },
				Residual: null,
				SortAbsorbed: false,
				ProjectionAbsorbed: false,
				LimitAbsorbed: false,
			};
		}

		let exact = ( st === 'o' ) && subtree_is_exact( criteria, options );
		let pushdown = ( st === 'o' ) ? render_criteria( criteria, options ) : null;

		return {
			Pushdown: pushdown || { match_all: {} },
			Residual: exact ? null : criteria,
			SortAbsorbed: false,
			ProjectionAbsorbed: false,
			LimitAbsorbed: false,
		};
	}


	// ***A translator is a plugin, the way an adapter and a filter already are.***
	// jsonstor.LoadPlugin files this under jsonstor.Translators by TranslatorName.
	return {
		TranslatorName: 'ElasticExpression',
		Translate: Translate,
		// The table above, published. It is the ceiling an adapter's OperatorFidelities is
		// clamped against, and the column OperatorMatrix reads.
		Fidelities: FIDELITIES,
	};
};
