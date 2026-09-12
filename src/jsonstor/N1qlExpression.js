'use strict';

const jsongin = require( '@liquicode/jsongin' );
const SUPPORT = require( './TranslatorSupport' )();

/*
	Builds a Couchbase N1QL WHERE clause from a jsonstor criteria.

	***This is the family's fifth translator and the first one whose target shares jsongin's own
	value model.*** SqlExpression assembles a string over columns, MangoExpression prunes a tree in
	a language the target mostly shares, ElasticExpression and DynamoExpression assemble objects in
	foreign languages. This one assembles a string like SqlExpression does - and is emphatically
	***not*** a SqlExpression dialect, for the reason in the next paragraph.

	## Why this is not a SqlExpression dialect

	***Measured on 2026-09-05 rather than argued.*** SqlExpression was pointed at a live Couchbase
	server under the most N1QL-flavoured options it has and scored ***7 of 31 exact***, with eight
	statements the server refused outright. Four of those refusals are spellings which could have
	been new options - `IN (a, b)` against N1QL's `IN [a, b]`, no `IS NOT TRUE`, `TRUNCATE` against
	`TRUNC`, and no `&` operator at all.

	***The decision rests on the one failure which did not refuse.*** A nested field renders there
	as a single quoted identifier - `` `sub.x` `` - because in SQL that is what a column is called.
	N1QL reads it as an identifier containing a dot, finds no such field, and ***returns nothing
	with no error***. Every mechanism SqlExpression owns is built on naming a column: AllowedFields,
	ColumnFields, PayloadContainment, PayloadColumn, broaden_projection. ***N1QL has no columns and
	no payload*** - the document is the row and every path is addressable - so all five have nothing
	to describe. A translator whose entire storage model is inapplicable is not a dialect of it.

	See jsonx/.plans/wave-5-query-languages.md.

	## The invariant, and the two traps this target sets for it

	***A pushdown may admit documents the criteria rejects, and must never reject one it admits.***
	Returning too many costs time; returning too few is a wrong answer nothing downstream can
	correct.

	***Trap one: N1QL is four-valued, and a negation loses two kinds of document rather than one.***
	SQL has NULL; N1QL has NULL ***and*** MISSING. `n != 10` answers MISSING where the field is
	absent and NULL where the field holds null, and jsongin keeps both. So every negation here goes
	through negate(), which guards ***the expression*** rather than the field:

		((NOT (X)) OR (X) IS NOT VALUED)

	***Guarding the field instead is wrong and was measured wrong.*** For `$nor: [ {n:10}, {s:'x'} ]`
	a field-guarded rendering returned documents 1,5,7 where jsongin returns 1,2,3,4,5 - narrowing
	and broadening at once, because one field's guard says nothing about the other's. `IS NOT VALUED`
	applied to the whole expression covers MISSING and NULL together and needs no field at all,
	which makes it the exact analogue of SqlExpression's portable `((NOT X) OR X IS NULL)`.

	***Trap two: N1QL and jsongin sort types differently, so an unguarded comparison inverts badly.***
	N1QL orders missing < null < boolean < number < string < array < object. jsongin refuses a
	cross-type ordering outright, and inside `$expr` it puts booleans ***above*** numbers - measured,
	`true > 5` is true to jsongin and false to N1QL. So every range comparison carries
	`TYPE(field) = "<operand type>"`. Unguarded it broadens, which is legal; but its negation
	narrows, which is not.

	## Why so much of this is exact, which has not happened before

	***N1QL distinguishes an absent field from an explicit null, and nothing else in this family
	does.*** `IS MISSING`, `IS NULL` and `IS NOT VALUED` answer three different sets. That is
	jsongin's own model, so `$exists` and `$type` are exact here and dropped or broadened against
	every other target. Nothing is coerced on the way in either - the round trip returns every value
	with its type intact - so a comparison means what jsongin means by it.

	***The table below is a ceiling and not a corpus result***, which is a distinction this file
	nearly lost. The shared four-document corpus scored ***31 of 31 exact***, and an adversarial
	corpus built afterwards - a null in the compared field, a boolean against a numeric string, a
	non-scalar inside an array - found ***five narrowings*** the clean sweep had hidden. Every one
	is repaired above; the cells which stayed broadening are declared broadening here.

	## What is deliberately not rendered

	***An array or object operand for equality.*** Couchbase reorders an object's fields on the way
	in - the round trip is value-identical and key-reordered - and jsongin's object equality is
	order sensitive, so an equality against a whole object is a comparison of two different
	orderings. Dropped rather than guessed, which broadens and costs a document read.

	***A regular expression this dialect cannot be shown to share.*** N1QL's engine is RE2, which
	***refuses lookaround outright*** - `error parsing regexp` - and a refused statement returns no
	rows, which is a narrowing. So only patterns verified translatable are rendered. Note also that
	the function is ***REGEXP_CONTAINS*** and not REGEXP_LIKE: `REGEXP_LIKE` matches the entire
	string, measured, so using it would silently mistranslate every unanchored pattern.

	***$sampleRate and $noop.*** Rendering an approximation of a sample and re-checking it draws two
	independent samples and keeps their intersection, which at rate p returns p*p - a narrowing.
	MangoExpression and ElasticExpression carry the same reasoning.
*/

module.exports = function ( jsonstor )
{

	//---------------------------------------------------------------------
	// ***What Couchbase N1QL does with every jsongin query operator, measured against live
	// servers on 2026-09-05*** - Community 8.0.2, 6.6.0, 5.1.1 and 5.0.1, which answer
	// identically, over two corpora.
	//
	// This is the ceiling, not a promise. A cell declares the best achievable fidelity and the
	// renderer reports the actual one, which depends on the operand - see OperatorMatrix.
	// Anything undeclared is dropped, which is always correct and merely slow.
	const FIDELITIES = {
		// ***Comparison, and this is the row no other target here has.*** N1QL compares by type
		// the way jsongin does and coerces nothing on the way in, so an equality means what
		// jsongin means. The range operators are exact only because of their type guard.
		'$eq': 'exact',
		'$ne': 'exact',
		'$gt': 'exact',
		'$gte': 'exact',
		'$lt': 'exact',
		'$lte': 'exact',
		'$in': 'exact',
		'$nin': 'exact',
		// Logical. A conjunction is as exact as its children; a disjunction and a negation are
		// kept whole or dropped whole.
		'$and': 'exact',
		'$or': 'exact',
		'$nor': 'exact',
		'$not': 'exact',
		// Evaluation. $regex renders only patterns RE2 and Javascript demonstrably share.
		'$regex': 'exact',
		// ***$expr is broadening because jsongin's own ordering is not N1QL's.*** Inside $expr
		// jsongin sorts booleans above numbers and N1QL sorts them below, so the rendering
		// carries a boolean disjunct which over-admits by design.
		'$expr': 'broadening',
		'$exprx': 'broadening',
		// ***$mod is exact and the four $bits are not, which is a real difference and not an
		// oversight.*** jsongin truncates toward zero before dividing, exactly as TRUNC does; but
		// it ***refuses*** a non-integer for a bitwise test, where TRUNC accepts it. Measured: a
		// document holding 10.5 matched every $bits rendering and no $bits criteria.
		'$mod': 'exact',
		'$bitsAllSet': 'broadening',
		'$bitsAllClear': 'broadening',
		'$bitsAnySet': 'broadening',
		'$bitsAnyClear': 'broadening',
		// Array. ANY..SATISFIES compares an element by N1QL's ordering, which admits a non-scalar
		// element where jsongin refuses one. $all and $size are exact over scalars.
		'$elemMatch': 'broadening',
		'$size': 'exact',
		'$all': 'exact',
		// ***Element, and the pair this target answers and the others cannot.*** IS MISSING and
		// IS NULL are different questions here, which is jsongin's own model.
		'$exists': 'exact',
		'$type': 'exact',
		// Miscellaneous. $comment annotates and constrains nothing, which is what jsongin does
		// with it. $sampleRate has no filter form - see the header.
		'$comment': 'exact',
		'$sampleRate': 'dropped',
		// Extension. `{ field: value }` with no operator written.
		'$ImplicitEq': 'exact',
		// ***The four jsongin extensions, and this is the first target to render any of them.***
		// Query DSL and DynamoDB dropped all four. N1QL has TO_STRING, which reaches the loose
		// comparisons - broadening, because Javascript's `==` equates `true` and `'1'` and
		// TO_STRING does not, so the rendering carries a boolean disjunct.
		'$eqx': 'broadening',
		'$nex': 'broadening',
		'$noop': 'dropped',
	};

	const FIDELITY_ORDER = [ 'exact', 'broadening', 'dropped' ];

	// jsongin short type to the string N1QL's TYPE() returns. Measured: TYPE() answers exactly
	// these six names, which are jsongin's own spellings.
	const TYPE_NAMES = { n: 'number', s: 'string', b: 'boolean', l: 'null', a: 'array', o: 'object' };


	//---------------------------------------------------------------------
	// An adapter may narrow the table and may never widen it. Same clamp the other translators
	// apply: a target which speaks a subset says so in its own settings rather than by shipping
	// a second translator.
	function apply_defaults( Options )
	{
		let options = Object.assign( {}, Options );
		// ***Null AllowedFields means every field is pushable, which is the opposite of
		// SqlExpression's default and is correct here.*** There a field with no column lives in
		// an opaque payload and cannot be asked about; here the document ***is*** the row and
		// every path is addressable, so refusing to push on an undeclared field would refuse to
		// push on anything. An adapter may still supply a list to restrict this.
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
	// ***The field reference, and it is the whole reason this file exists.***
	//
	// A jsonstor field name is a path, and N1QL addresses a path by quoting each step
	// separately: `sub`.`x`. Rendering it as one identifier - `` `sub.x` `` - is what
	// SqlExpression does, because in SQL that is a column name, and N1QL answers nothing at all
	// for it without erroring.
	//
	// ***Every step is quoted, always.*** N1QL has a large reserved word list and an unquoted
	// identifier which collides with one is a syntax error rather than a field - `probe` is
	// reserved, which is how this was found. Quoting unconditionally costs nothing and removes
	// the whole class.
	//
	// ***A numeric step is not a field name here and it is refused.*** `{ 'arr.0': 10 }` means
	// the first ***element*** of an array to jsongin, as it does to MongoDB, and N1QL spells
	// that `arr[0]`; `` `arr`.`0` `` asks for a field literally named `0`. Rendering the second
	// for the first returns nothing and - because every operator in that path is exact - claimed
	// `Residual: null` while doing it. ***Measured 2026-09-05 against a live server***, where
	// `{ 'arr.0': 10 }`, `{ 'objs.0.x': 1 }` and `{ 'arr.1': 10 }` each answered `[]` against
	// jsongin's one document.
	//
	// ***Refusing is not the only rendering available, and it is the one which is certainly
	// right.*** jsongin resolves that path against an array element ***and*** against a field of
	// that name, so a faithful rendering is a disjunction of `arr[0]` and `` `arr`.`0` `` - and
	// a disjunction whose two halves have not been put to a server is a guess. Dropping the
	// condition broadens, which costs a document read and never an answer. See
	// jsonx/.plans/wave-5-query-languages.md.
	//
	// ***`jsonstor-dynamodb` reached the same conclusion about the same shape*** from the other
	// direction: a dotted path there addresses a map and only a map, and it is left to jsongin
	// for that reason.
	function field_reference( FieldName )
	{
		if ( !FieldName ) { return null; }
		return path_reference( '', String( FieldName ).split( '.' ) );
	}


	//---------------------------------------------------------------------
	// ***The same path, relative to a base expression.*** An empty base gives the bare field
	// reference above; a bound variable gives the path relative to one array element, which is
	// what path_branches needs and the only reason this is separate.
	function path_reference( Base, Segments )
	{
		let quoted = [];
		for ( let index = 0; index < Segments.length; index++ )
		{
			let part = Segments[ index ];
			if ( !part.length ) { return null; }
			// A backtick inside an identifier is pathological and the escape is not worth
			// guessing at. Refusing drops the condition, which broadens.
			if ( part.indexOf( '`' ) >= 0 ) { return null; }
			// See above: an array index, not a field name.
			if ( /^[0-9]+$/.test( part ) ) { return null; }
			quoted.push( '`' + part + '`' );
		}
		if ( !quoted.length ) { return Base ? Base : null; }
		if ( Base ) { return Base + '.' + quoted.join( '.' ); }
		return quoted.join( '.' );
	}


	//---------------------------------------------------------------------
	// ***How deep a path the array repair is rendered for.***
	//
	// ***The branch count doubles per segment*** - one for a plain field, two for one dot, four
	// for two - so the repair is rendered while the clause stays small and a deeper path is
	// dropped instead, which costs a document read and is never wrong. `MangoExpression` carries
	// the same cap for the same construction; the number is not a measurement, it is here so
	// that a path nobody expected cannot silently become a thousand branch clause.
	const MAX_PATH_BRANCH_SEGMENTS = 4;


	//---------------------------------------------------------------------
	// ***Every place an array can sit along a path, one branch each.***
	//
	// ***A dotted path does not say which of its segments holds an array***, and jsongin
	// resolves candidates at every one of them: `{ 'instock.qty': { $lte: 20 } }` admits a
	// document whose `instock` is an ***array of embedded documents*** one of which has a small
	// `qty`. N1QL's `` `instock`.`qty` `` addresses a field of an object and answers MISSING for
	// an array, so the path as written returns nothing for exactly those documents - and every
	// operator along it being exact, the translator claimed `Residual: null` while losing them.
	//
	// ***Found by the shared conformance inventory and by nothing before it.*** The operator
	// probe sends one criteria per operator, the translator check listed sixteen shapes
	// including a nested path, and neither ever put an array at an ***intermediate*** segment.
	// array_aware already covered an array at the ***leaf***, which is why this looked covered.
	//
	// ***This is `MangoExpression.element_branches` in another language***, and that file's
	// measurement is why the obvious repair is not the one written here: a disjunct per split of
	// the path ***still loses documents***, because the branch it omits is the leaf's own.
	// Measured there on CouchDB 2.3.1 and 3.5.2, 2026-09-03, over a corpus holding an array at
	// every position. The leaf branch is array_aware's, inside each rendered condition; the
	// prefix branches are these.
	//
	// Returns a list of { Ref, Wrap, Parent } - the expression to render the condition against,
	// the ANY..SATISFIES it has to sit inside, and the expression the last segment was read off.
	// Wrap is null for the path as written; Parent is null for a top level field.
	//
	// ***Parent exists for the absence tests.*** `a.b IS NOT VALUED` is true whenever `a` is an
	// array, because N1QL reads a field of an array as MISSING - and jsongin, since the null
	// repair of 2026-09-11, says an array which offered no document to descend into is ***not***
	// a missing field. So the direct branch guards `TYPE(parent) != "array"`, and the element
	// branches below guard `TYPE(element) = "object"`. Measured as a false exact on 8.0.2 and
	// 5.0.1, 2026-09-12: twelve documents admitted, the engine rejecting every one.
	function path_branches( Segments, Base, Depth )
	{
		let whole = path_reference( Base, Segments );
		if ( whole === null ) { return null; }
		// A single segment has no parent to guard: at the top it is the document, and below an
		// ANY it is the bound element, which any_wrapper has already required to be an object.
		let parent = ( Segments.length > 1 ) ? path_reference( Base, Segments.slice( 0, -1 ) ) : null;
		let branches = [ { Ref: whole, Wrap: null, Parent: parent } ];

		for ( let index = 1; index < Segments.length; index++ )
		{
			let head = path_reference( Base, Segments.slice( 0, index ) );
			if ( head === null ) { return null; }
			// ***A variable of its own per depth.*** array_aware binds `jsonstor_v` and so does
			// $elemMatch, and a repair which shadowed either would be correct today and
			// confusing forever.
			let variable = `jsonstor_p${Depth}`;
			// ***The rest of the path, asked of the element*** - which is the same question one
			// segment shorter, arrays and all.
			let inner = path_branches( Segments.slice( index ), variable, Depth + 1 );
			if ( inner === null ) { return null; }
			for ( let which = 0; which < inner.length; which++ )
			{
				branches.push( {
					Ref: inner[ which ].Ref,
					Wrap: any_wrapper( head, variable, inner[ which ].Wrap ),
					Parent: inner[ which ].Parent,
				} );
			}
		}
		return branches;
	}


	//---------------------------------------------------------------------
	function any_wrapper( Head, Variable, Inner )
	{
		return function ( Text )
		{
			let body = Inner ? Inner( Text ) : Text;
			// ***Only an object element continues a path.*** A scalar or null element reached
			// by index is not a document lacking the next field, so `p.b IS NOT VALUED` must not
			// fire on it. Every positive predicate is false on MISSING anyway, so the guard
			// changes nothing but the absence tests. See path_branches.
			return `(TYPE(${Head}) = "array" AND ANY ${Variable} IN ${Head} SATISFIES (TYPE(${Variable}) = "object" AND ${body}) END)`;
		};
	}


	//---------------------------------------------------------------------
	// ***An N1QL literal is a JSON literal***, which is the one place this target is simpler
	// than every SQL dialect: no quote doubling, no backslash dialect, no boolean spelling
	// question. What JSON.stringify emits, N1QL's parser accepts.
	//
	// The guards are for the values JSON cannot carry. NaN and Infinity stringify to `null`,
	// which would silently compare against the wrong thing.
	function render_literal( Value )
	{
		let st = jsongin.ShortType( Value );
		if ( st === 'u' ) { return null; }
		if ( st === 'n' )
		{
			if ( !Number.isFinite( Value ) ) { return null; }
		}
		let text = JSON.stringify( Value );
		if ( typeof text === 'undefined' ) { return null; }
		return text;
	}


	//---------------------------------------------------------------------
	function field_is_pushable( FieldName, options )
	{
		if ( !field_reference( FieldName ) ) { return false; }
		// See apply_defaults: no list means everything is pushable here.
		if ( !options.AllowedFields ) { return true; }
		return !!options.AllowedFields[ FieldName ];
	}


	//---------------------------------------------------------------------
	// Negates a rendered condition without losing the documents N1QL calls MISSING or NULL.
	//
	// ***Guards the expression, never the field.*** See the header - a field-guarded negation
	// was measured returning both too few and too many documents for a two field $nor.
	function negate( Expression )
	{
		if ( !Expression ) { return null; }
		return `((NOT (${Expression})) OR (${Expression}) IS NOT VALUED)`;
	}


	//---------------------------------------------------------------------
	// ***jsongin resolves candidates, so a field holding an array matches on its elements too***,
	// and every scalar predicate below has to say so.
	//
	// `{ tags: 'a' }` matches `{ tags: [ 'a', 'b' ] }` - jsongin's own documented rule, MongoDB's
	// before it. Measured across the operators: `$eq: 1` matches `[1]`, `$gt: 5` matches `[9]`,
	// `$type: 'number'` matches `[1]` ***and*** `$type: 'array'` does as well, and `$ne: 1`
	// answers false for `[1]` because the negation inverts a resolved match.
	//
	// ***This was found by the translator check and not by the operator probe***, because neither
	// corpus ever put an array in the field a comparison was aimed at. `{ 'sub.x': 1 }` against
	// `sub: { x: [ 1 ] }` rendered `` `sub`.`x` = 1 ``, returned nothing, and claimed
	// `Residual: null` while doing it - a wrong answer rather than a slow one.
	//
	// ***One level only, which is jsongin's rule too:*** `$eq: 1` does not match `[[1]]`.
	//
	// A predicate builder is handed a reference and returns a clause over it, so the same code
	// renders the direct test and the per-element one. A builder which refuses either refuses
	// both, which drops the condition and broadens.
	function array_aware( FieldRef, BuildPredicate )
	{
		let direct = BuildPredicate( FieldRef );
		if ( !direct ) { return null; }
		let element = BuildPredicate( 'jsonstor_v' );
		if ( !element ) { return null; }
		return `(${direct} OR (TYPE(${FieldRef}) = "array"`
			+ ` AND ANY jsonstor_v IN ${FieldRef} SATISFIES ${element} END))`;
	}


	//---------------------------------------------------------------------
	// ***A null operand matches a null and an absent field both.*** That is jsongin's rule and
	// MongoDB's before it: `{ a: null }` admits a document which has no `a` at all. N1QL spells
	// exactly that question `IS NOT VALUED`, which is why this is one expression here and a
	// two-branch repair on every other target.
	function render_equality( FieldRef, Value, Parent )
	{
		let st = jsongin.ShortType( Value );
		// ***An array or object operand is not rendered.*** See the header: Couchbase reorders an
		// object's keys and jsongin's object equality is order sensitive.
		if ( !'nsbl'.includes( st ) ) { return null; }
		return array_aware( FieldRef, function ( ref )
		{
			if ( st === 'l' ) { return render_absent_or_null( ref, ( ref === FieldRef ) ? Parent : null ); }
			let literal = render_literal( Value );
			if ( literal === null ) { return null; }
			return `(${ref} = ${literal})`;
		} );
	}


	//---------------------------------------------------------------------
	// ***The absent-or-null question, in MongoDB's sense of absent.*** A field is missing when
	// the document lacks it or when the path ran on below a scalar or null reached by name; a
	// field of an ***array*** is not missing, it is a path which resolved to nothing. N1QL
	// answers MISSING for both, so `IS NOT VALUED` alone admits `{ a: [] }` for `{ 'a.b': null }`
	// where jsongin and MongoDB reject it. The parent guard is what separates the two; a bound
	// element has no parent to guard and is guarded by any_wrapper instead.
	function render_absent_or_null( ref, Parent )
	{
		if ( !Parent ) { return `(${ref} IS NOT VALUED)`; }
		return `(TYPE(${Parent}) != "array" AND ${ref} IS NOT VALUED)`;
	}


	//---------------------------------------------------------------------
	// A range comparison, with the type guard which makes it exact. See the header, trap two.
	function render_comparison( FieldRef, Operator, Value )
	{
		let st = jsongin.ShortType( Value );
		if ( !'nsb'.includes( st ) ) { return null; }
		let literal = render_literal( Value );
		if ( literal === null ) { return null; }
		return array_aware( FieldRef, function ( ref )
		{
			return `(TYPE(${ref}) = "${TYPE_NAMES[ st ]}" AND ${ref} ${Operator} ${literal})`;
		} );
	}


	//---------------------------------------------------------------------
	// `field IN [ ... ]`, which is N1QL's spelling and not SQL's parenthesized list.
	//
	// ***A non-scalar member drops the whole condition rather than itself.*** Dropping one member
	// narrows the list to the others and loses exactly the documents that member was there for -
	// the same asymmetry TranslatorSupport was written about, one level down.
	function render_in( FieldRef, Values, Parent )
	{
		if ( jsongin.ShortType( Values ) !== 'a' ) { return null; }
		if ( !Values.length ) { return null; }
		let split = SUPPORT.SplitNullValues( Values );
		let literals = [];
		for ( let index = 0; index < split.Values.length; index++ )
		{
			let st = jsongin.ShortType( split.Values[ index ] );
			if ( !'nsb'.includes( st ) ) { return null; }
			let literal = render_literal( split.Values[ index ] );
			if ( literal === null ) { return null; }
			literals.push( literal );
		}
		return array_aware( FieldRef, function ( ref )
		{
			let clauses = [];
			if ( literals.length ) { clauses.push( `${ref} IN [ ${literals.join( ', ' )} ]` ); }
			// A null in the list asks the absent-or-null question beside the list, not in it.
			if ( split.HasNull ) { clauses.push( render_absent_or_null( ref, ( ref === FieldRef ) ? Parent : null ) ); }
			if ( !clauses.length ) { return null; }
			return `(${clauses.join( ' OR ' )})`;
		} );
	}


	//---------------------------------------------------------------------
	// ***Only a pattern RE2 and Javascript demonstrably share.*** RE2 has no lookaround and no
	// backreference and ***refuses to compile*** rather than ignoring them, so an unrenderable
	// pattern must be dropped and not attempted - a refused statement returns no rows, which is
	// a narrowing.
	function render_regex( FieldRef, Pattern, RegexOptions )
	{
		if ( jsongin.ShortType( Pattern ) !== 's' ) { return null; }
		// Lookahead, lookbehind, named and atomic groups, and backreferences.
		if ( /\(\?[=!<']/.test( Pattern ) ) { return null; }
		if ( /\\[1-9]/.test( Pattern ) ) { return null; }
		let flags = '';
		if ( RegexOptions && String( RegexOptions ).indexOf( 'i' ) >= 0 ) { flags = '(?i)'; }
		let literal = render_literal( flags + Pattern );
		if ( literal === null ) { return null; }
		// ***REGEXP_CONTAINS and not REGEXP_LIKE.*** REGEXP_LIKE matches the entire string -
		// measured - so it would mistranslate every unanchored pattern into a stricter one.
		return array_aware( FieldRef, function ( ref )
		{
			return `REGEXP_CONTAINS(${ref}, ${literal})`;
		} );
	}


	//---------------------------------------------------------------------
	// The bitmask a $bits* operand asks about, as a decimal string, or null for an operand this
	// clause cannot ask about. jsongin accepts a mask or an array of bit positions and reads
	// them in unbounded BigInt; N1QL's BITAND is 64 bit, so a mask which does not fit is a
	// question with an answer there and none here.
	function get_bit_mask( Value )
	{
		let st = jsongin.ShortType( Value );
		let mask = null;
		if ( st === 'n' )
		{
			if ( !Number.isInteger( Value ) || ( Value < 0 ) ) { return null; }
			mask = BigInt( Value );
		}
		else if ( st === 'a' )
		{
			mask = 0n;
			for ( let index = 0; index < Value.length; index++ )
			{
				let bit = Value[ index ];
				if ( !Number.isInteger( bit ) || ( bit < 0 ) || ( bit > 63 ) ) { return null; }
				mask |= ( 1n << BigInt( bit ) );
			}
		}
		else { return null; }
		if ( mask > 0x7fffffffffffffffn ) { return null; }
		return mask.toString();
	}


	//---------------------------------------------------------------------
	// ***One `$operator: value` against one field, in every place an array can sit.***
	//
	// The rendering itself is render_condition_at, once per branch; this is the walk over the
	// branches and the OR which joins them. See path_branches.
	function render_condition( FieldName, Operator, Value, options )
	{
		if ( options.Fidelities[ Operator ] === 'dropped' ) { return null; }
		if ( !field_is_pushable( FieldName, options ) ) { return null; }

		let segments = String( FieldName ).split( '.' );
		if ( segments.length > MAX_PATH_BRANCH_SEGMENTS ) { return null; }
		let branches = path_branches( segments, '', 0 );
		if ( branches === null ) { return null; }

		// See NEGATED_BY: a negation is taken over the whole branch set and never inside one.
		let positive = NEGATED_BY[ Operator ];
		let render_as = positive ? positive : Operator;
		let value = Value;
		// ***`$exists: false` is the negation of `$exists: true` over the branch set***, for the
		// same reason `$ne` is: `{ 'a.b': { $exists: false } }` asks that ***no*** resolution of
		// the path exists. Rendered per branch, the direct `a.b IS MISSING` admitted
		// `{ a: [ { b: 1 } ] }` - a false exact, measured on 8.0.2 and 5.0.1 on 2026-09-12.
		// A top level field has one branch and keeps the plain `IS MISSING` spelling.
		if ( ( Operator === '$exists' ) && ( Value === false ) && ( branches.length > 1 ) ) { positive = '$exists'; value = true; }

		let rendered = [];
		for ( let index = 0; index < branches.length; index++ )
		{
			let text = render_condition_at( branches[ index ].Ref, render_as, value, options, branches[ index ].Parent );
			// ***A branch which cannot be rendered drops the whole condition.*** Keeping the
			// others would ask about some of the places an array can sit and none of the rest,
			// which is the narrowing this repair exists to remove, arrived at from inside the
			// repair.
			if ( !text ) { return null; }
			let wrap = branches[ index ].Wrap;
			rendered.push( wrap ? wrap( text ) : text );
		}
		let combined = ( rendered.length === 1 ) ? rendered[ 0 ] : `(${rendered.join( ' OR ' )})`;
		if ( positive ) { return negate( combined ); }
		return combined;
	}


	//---------------------------------------------------------------------
	// ***An operator which negates negates the whole branch set, never one branch.***
	//
	// `{ 'a.b': { $ne: 10 } }` asks that ***no*** resolution of the path equals 10, and the
	// branches ***are*** the resolutions - so the rendering is `NOT( any of them matches )` and
	// never `( any of them fails to match )`. The two are different questions the moment a path
	// has more than one resolution, which is the moment an array sits along it.
	//
	// ***Measured 2026-09-05, and it is the defect the paths corpus was added to find.*** Against
	// a document whose `a` is `[ { b: 10 }, { b: 99 } ]`, the per-branch form admitted it - the
	// second element satisfies the negation - where jsongin answers false because the first
	// element matches. It broadened rather than narrowed, so no document was lost; ***but it
	// claimed `Residual: null` while doing it***, which is a FALSE-EXACT and a wrong answer.
	//
	// `$nexMatch` is internal and exists only for this table: `$nex` is not the negation of the
	// `$eqx` rendering - see the `$eqx` case - so it needs a positive form of its own to negate.
	const NEGATED_BY = {
		'$ne': '$eq',
		'$nin': '$in',
		'$nex': '$nexMatch',
	};


	//---------------------------------------------------------------------
	// One `$operator: value` against one already-rendered reference, which is a field path or a
	// bound array element.
	//
	// ***The negating operators are not here***, only the positive forms they are built from.
	// See NEGATED_BY.
	function render_condition_at( ref, Operator, Value, options, Parent )
	{
		switch ( Operator )
		{
			case '$eq':
			case '$ImplicitEq':
				return render_equality( ref, Value, Parent );

			case '$gt': return render_comparison( ref, '>', Value );
			case '$gte': return render_comparison( ref, '>=', Value );
			case '$lt': return render_comparison( ref, '<', Value );
			case '$lte': return render_comparison( ref, '<=', Value );

			case '$in': return render_in( ref, Value, Parent );

			case '$regex': return render_regex( ref, Value, options.RegexOptions );

			case '$mod':
			{
				if ( jsongin.ShortType( Value ) !== 'a' ) { return null; }
				if ( Value.length !== 2 ) { return null; }
				let divisor = Value[ 0 ];
				let remainder = Value[ 1 ];
				if ( !Number.isFinite( divisor ) || !Number.isFinite( remainder ) ) { return null; }
				// ***The operands are truncated as well***, because jsongin and MongoDB read
				// `[ 5.5, 1 ]` as `[ 5, 1 ]`. Rendered as written, `MOD( 11, 5.5 ) = 1` is false
				// where the criteria matches 11 - a narrowing under an exact claim, measured on
				// 8.0.2 and 5.0.1 on 2026-09-12. A divisor which truncates to zero is jsongin's
				// to refuse, so it is left to the residual.
				divisor = Math.trunc( divisor );
				remainder = Math.trunc( remainder );
				if ( divisor === 0 ) { return null; }
				// ***TRUNC is load bearing.*** jsongin truncates toward zero before dividing, and
				// a bare MOD does not: MOD( 10.5, 3 ) is 1.5 where jsongin answers 1. N1QL spells
				// it TRUNC; SQL spells it TRUNCATE, which is one of the eight statements the
				// server refused when SqlExpression was pointed at it.
				return array_aware( ref, function ( r )
				{
					return `(TYPE(${r}) = "number" AND MOD(TRUNC(${r}, 0), ${divisor}) = ${remainder})`;
				} );
			}

			case '$bitsAllSet':
			case '$bitsAllClear':
			case '$bitsAnySet':
			case '$bitsAnyClear':
			{
				let mask = get_bit_mask( Value );
				if ( mask === null ) { return null; }
				// ***BITAND, because N1QL has no bitwise operator at all.*** `&` is one of the
				// eight refusals. The TRUNC is what makes this broadening rather than exact -
				// jsongin refuses a non-integer here and TRUNC accepts one.
				return array_aware( ref, function ( r )
				{
					let and = `BITAND(TRUNC(${r}, 0), ${mask})`;
					let guard = `TYPE(${r}) = "number"`;
					if ( Operator === '$bitsAllSet' ) { return `(${guard} AND ${and} = ${mask})`; }
					if ( Operator === '$bitsAllClear' ) { return `(${guard} AND ${and} = 0)`; }
					if ( Operator === '$bitsAnySet' ) { return `(${guard} AND ${and} != 0)`; }
					return `(${guard} AND ${and} != ${mask})`;
				} );
			}

			case '$size':
			{
				if ( !Number.isInteger( Value ) || ( Value < 0 ) ) { return null; }
				return `(ARRAY_LENGTH(${ref}) = ${Value})`;
			}

			case '$all':
			{
				if ( jsongin.ShortType( Value ) !== 'a' ) { return null; }
				if ( !Value.length ) { return null; }
				let terms = [];
				for ( let index = 0; index < Value.length; index++ )
				{
					let st = jsongin.ShortType( Value[ index ] );
					if ( !'nsb'.includes( st ) ) { return null; }
					let literal = render_literal( Value[ index ] );
					if ( literal === null ) { return null; }
					// ***`$all` also selects against a field which is not an array***, which
					// MongoDB documents and jsongin follows: `{ n: { $all: [ 10 ] } }` matches a
					// document whose `n` is the number 10. N1QL's `IN` wants an array on the
					// right and answers nothing for a scalar, so the equality is the other half
					// of the same question.
					//
					// ***Measured as a NARROWING on 2026-09-05*** - `IN` alone lost the document
					// while claiming `Residual: null` - and found by the shared conformance
					// inventory, because every `$all` the operator probe sent was aimed at a
					// field which really was an array.
					//
					// ***A list of two terms still cannot match a scalar***, and that falls out
					// rather than being special-cased: the terms are joined by AND, and one
					// value is not equal to two different literals.
					terms.push( `(${literal} IN ${ref} OR ${ref} = ${literal})` );
				}
				return `(${terms.join( ' AND ' )})`;
			}

			case '$elemMatch':
			{
				// Only a scalar comparison over the element is rendered. `v` is a bound variable
				// and cannot collide with a field name, which is what ANY..SATISFIES is for.
				let inner = render_element_match( Value );
				if ( !inner ) { return null; }
				return `(ANY jsonstor_v IN ${ref} SATISFIES ${inner} END)`;
			}

			case '$exists':
			{
				if ( jsongin.ShortType( Value ) !== 'b' ) { return null; }
				// ***The question no other target in this family can answer.*** jsongin asks
				// whether the key is present, which is IS MISSING and not IS NULL. A field of
				// an array is MISSING to N1QL and present-through-its-elements to jsongin, so
				// the direct branch is guarded by the parent's type and the element branches
				// answer for the array; see path_branches. `$exists: false` arrives here as
				// `true` and is negated over the whole branch set by render_condition.
				if ( !Parent ) { return Value ? `(${ref} IS NOT MISSING)` : `(${ref} IS MISSING)`; }
				let present = `(TYPE(${Parent}) != "array" AND ${ref} IS NOT MISSING)`;
				return Value ? present : negate( present );
			}

			case '$type':
			{
				if ( jsongin.ShortType( Value ) !== 's' ) { return null; }
				let names = Object.values( TYPE_NAMES );
				if ( names.indexOf( Value ) < 0 ) { return null; }
				// ***$type resolves candidates too, and it is the surprising one.*** A field
				// holding `[ 1 ]` answers true for `$type: 'number'` - the element's type - and
				// true for `$type: 'array'` as well, which is the array's own. array_aware
				// renders exactly that pair of questions.
				let literal = render_literal( Value );
				return array_aware( ref, function ( r ) { return `(TYPE(${r}) = ${literal})`; } );
			}

			case '$eqx':
			{
				let st = jsongin.ShortType( Value );
				if ( !'ns'.includes( st ) ) { return null; }
				let literal = render_literal( String( Value ) );
				if ( literal === null ) { return null; }
				// ***The boolean disjunct is why this is broadening.*** Javascript equates
				// `true` and `'1'`; TO_STRING gives "true" and "1". Admitting every boolean is
				// the safe direction, and omitting it was measured narrowing.
				return array_aware( ref, function ( r )
				{
					return `((TO_STRING(${r}) = ${literal}) OR TYPE(${r}) = "boolean")`;
				} );
			}

			// ***The positive half of $nex, which is not the $eqx rendering.***
			//
			// $eqx is broadening - it admits every boolean - and ***negating a broadening
			// expression narrows***, which is the one direction forbidden here. So $nex negates
			// the ***certain*** half instead: a TO_STRING match is only certain over a number or
			// a string, and a rendering which misses booleans as an equality over-admits them as
			// a negation. Broadening, in the safe direction.
			//
			// ***The negation itself is applied by render_condition***, over the whole branch
			// set. See NEGATED_BY.
			case '$nexMatch':
			{
				let st = jsongin.ShortType( Value );
				if ( !'ns'.includes( st ) ) { return null; }
				let literal = render_literal( String( Value ) );
				if ( literal === null ) { return null; }
				return array_aware( ref, function ( r )
				{
					return `(TYPE(${r}) IN [ "number", "string" ] AND TO_STRING(${r}) = ${literal})`;
				} );
			}

			default:
				return null;
		}
	}


	//---------------------------------------------------------------------
	// The comparison inside an $elemMatch, over the bound element variable.
	function render_element_match( Value )
	{
		if ( !SUPPORT.IsOperatorObject( Value ) ) { return null; }
		const OPERATORS = { '$eq': '=', '$gt': '>', '$gte': '>=', '$lt': '<', '$lte': '<=', '$ne': '!=' };
		let terms = [];
		let names = Object.keys( Value );
		for ( let index = 0; index < names.length; index++ )
		{
			let operator = OPERATORS[ names[ index ] ];
			if ( !operator ) { return null; }
			let st = jsongin.ShortType( Value[ names[ index ] ] );
			if ( !'nsb'.includes( st ) ) { return null; }
			let literal = render_literal( Value[ names[ index ] ] );
			if ( literal === null ) { return null; }
			terms.push( `jsonstor_v ${operator} ${literal}` );
		}
		if ( !terms.length ) { return null; }
		return terms.join( ' AND ' );
	}


	//---------------------------------------------------------------------
	// ***$expr and $exprx, rendered only in their simplest shape.*** `{ $gt: [ '$field', value ] }`
	// is the form which reaches a pushdown; anything else is left to jsongin. Broadening, because
	// jsongin sorts booleans above numbers inside $expr and N1QL sorts them below.
	function render_expr( Value, options, FieldPrefix )
	{
		if ( !SUPPORT.IsOperatorObject( Value ) ) { return null; }
		const OPERATORS = { '$eq': '=', '$gt': '>', '$gte': '>=', '$lt': '<', '$lte': '<=', '$ne': '!=' };
		let names = Object.keys( Value );
		if ( names.length !== 1 ) { return null; }
		let operator = OPERATORS[ names[ 0 ] ];
		if ( !operator ) { return null; }
		let operands = Value[ names[ 0 ] ];
		if ( jsongin.ShortType( operands ) !== 'a' ) { return null; }
		if ( operands.length !== 2 ) { return null; }
		if ( jsongin.ShortType( operands[ 0 ] ) !== 's' ) { return null; }
		if ( !operands[ 0 ].startsWith( '$' ) ) { return null; }
		let name = operands[ 0 ].slice( 1 );
		if ( FieldPrefix ) { name = FieldPrefix + '.' + name; }
		if ( !field_is_pushable( name, options ) ) { return null; }
		let ref = field_reference( name );
		if ( !ref ) { return null; }
		let st = jsongin.ShortType( operands[ 1 ] );
		if ( !'nsb'.includes( st ) ) { return null; }
		let literal = render_literal( operands[ 1 ] );
		if ( literal === null ) { return null; }
		return `((${ref} ${operator} ${literal}) OR TYPE(${ref}) = "boolean")`;
	}


	//---------------------------------------------------------------------
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

			let clause = null;
			if ( name === '$not' )
			{
				// ***A field level $not negates the operator object under it.*** Renderable only
				// over an exact subtree - anything imprecise inside comes back out inverted, and
				// inverted broadening is narrowing.
				if ( !subtree_is_exact( Operators[ name ], options ) ) { mark_dropped( options ); continue; }
				clause = negate( render_operator_object( FieldName, Operators[ name ], options ) );
			}
			else if ( name === '$exprx' )
			{
				clause = render_expr( Operators[ name ], options, FieldName );
			}
			else
			{
				clause = render_condition( FieldName, name, Operators[ name ], inner );
			}
			if ( clause ) { clauses.push( clause ); }
			else { mark_dropped( options ); }
		}
		if ( !clauses.length ) { return null; }
		if ( clauses.length === 1 ) { return clauses[ 0 ]; }
		return `(${clauses.join( ' AND ' )})`;
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
					else if ( ( jsongin.ShortType( Value[ index ] ) !== 'o' ) || Object.keys( Value[ index ] ).length ) { mark_dropped( options ); }
				}
				if ( !clauses.length ) { return null; }
				return `(${clauses.join( ' AND ' )})`;
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
					// was there for.
					if ( !clause ) { return null; }
					clauses.push( clause );
				}
				return `(${clauses.join( ' OR ' )})`;
			}

			case '$not':
			case '$nor':
			{
				if ( !subtree_is_exact( Value, options ) ) { return null; }
				let inner = ( jsongin.ShortType( Value ) === 'a' ) ? Value : [ Value ];
				if ( !inner.length ) { return null; }
				let clauses = [];
				for ( let index = 0; index < inner.length; index++ )
				{
					let clause = render_criteria( inner[ index ], options );
					if ( !clause ) { return null; }
					clauses.push( clause );
				}
				// $nor is NOT( a OR b ); a top level $not of several is the same shape.
				return negate( clauses.length === 1 ? clauses[ 0 ] : `(${clauses.join( ' OR ' )})` );
			}

			case '$expr':
				return render_expr( Value, options, '' );

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
			else if ( ( keys[ index ] !== '$comment' ) && ( keys[ index ] !== '$options' ) ) { mark_dropped( options ); }
		}
		if ( !clauses.length ) { return null; }
		if ( clauses.length === 1 ) { return clauses[ 0 ]; }
		return `(${clauses.join( ' AND ' )})`;
	}


	//---------------------------------------------------------------------
	// ***A dropped condition is recorded, because the fidelity walk cannot see one.***
	// subtree_is_exact reads the fidelity table by operator name and the operand's shape for an
	// implicit equality only, so a condition the renderer declines for its operand - an `$all`
	// over arrays, a `$type` N1QL has no name for, an empty `$in`, a `$gte: null` - is exact to
	// the walk and absent from the clause. Alone, that condition renders an empty clause, which
	// Translate refuses to call exact; ***beside a renderable field it rendered the other field
	// and claimed the whole criteria*** - `{ session_id: x, a: { $type: 'date' } }` returned every
	// document of the session. Found by `H) Engine Parity Tests` on 8.0.2 and 5.0.1 on
	// 2026-09-12, and by nothing before it, because every probe sent one field at a time.
	//
	// Every place a condition is declined marks the call, and Translate reads the mark. This is
	// DynamoExpression's `not_exact( state )` in this file's shape. A `$comment` renders nothing
	// and constrains nothing, and an empty child of an `$and` is true, so neither is a drop.
	function mark_dropped( options )
	{
		if ( options.State ) { options.State.Dropped = true; }
	}


	//---------------------------------------------------------------------
	// Whether every operator in a subtree is exact, and every field it names is pushable.
	//
	// ***This decides two different things and they are the same question.*** Whether a negation
	// may be rendered at all, and whether the residual may be null.
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
				if ( !field_is_pushable( key, options ) ) { return false; }
				// ***A field name carrying a plain value is an implicit equality, and its
				// fidelity is what decides this subtree.*** There is no $ key to read it from,
				// so a walk which only inspects $ keys sees an empty criteria and calls it
				// exact - the defect ElasticExpression's conformance run found.
				if ( !SUPPORT.IsOperatorObject( Node[ key ] ) )
				{
					if ( options.Fidelities[ '$ImplicitEq' ] !== 'exact' ) { return false; }
					// ***An operand this renderer will not render is not exact either.*** An
					// array or object equality is dropped here, and a dropped condition settles
					// nothing however exact its operator's cell is.
					if ( !'nsbl'.includes( jsongin.ShortType( Node[ key ] ) ) ) { return false; }
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
	//   Pushdown   The WHERE clause, as a string. ***Opaque to jsonstor*** - only the adapter
	//              which chose this translator gives it meaning. Empty means the criteria could
	//              not be narrowed at all and every document must travel.
	//   Residual   The part of the criteria the pushdown does not decide exactly, or null when
	//              it decides all of it. ***Null is common here***, which is new - this is the
	//              first target whose value model agrees with jsongin's.
	//   *Absorbed  Whether the translator took responsibility for that part of the query. All
	//              false: only the criteria is implemented. N1QL can sort, page and project on
	//              the server, and saying so is a later, additive change.
	function Translate( Request )
	{
		if ( jsongin.ShortType( Request ) !== 'o' ) { throw new Error( `The Request parameter must be an object.` ); }
		let options = apply_defaults( Request.Options );
		let criteria = Request.Criteria;

		// ***A criteria which is not a criteria is never absorbed.*** Null and undefined are the
		// whole collection, which every adapter in this family agrees on; some other non-object
		// is a typo, and a typo must never be indistinguishable from an empty result. Left
		// unabsorbed it reaches jsongin, which refuses it.
		let st = jsongin.ShortType( criteria );
		if ( 'lu'.includes( st ) )
		{
			return {
				Pushdown: '',
				Residual: null,
				SortAbsorbed: false,
				ProjectionAbsorbed: false,
				LimitAbsorbed: false,
			};
		}

		let exact = ( st === 'o' ) && subtree_is_exact( criteria, options );
		// Fresh per call: whether the renderer declined any condition. See mark_dropped.
		options.State = { Dropped: false };
		let pushdown = ( st === 'o' ) ? render_criteria( criteria, options ) : null;

		return {
			Pushdown: pushdown || '',
			// ***A criteria which rendered nothing settles nothing***, however exact its
			// operators are - an empty clause admits every document, so jsongin must still see
			// them. Checked here rather than in subtree_is_exact because the two ask different
			// questions: one is about the vocabulary, this is about what came out. ***And a
			// criteria which rendered part of itself settles nothing either*** - see mark_dropped.
			Residual: ( exact && pushdown && !options.State.Dropped ) ? null : criteria,
			SortAbsorbed: false,
			ProjectionAbsorbed: false,
			LimitAbsorbed: false,
		};
	}


	// ***A translator is a plugin, the way an adapter and a filter already are.***
	// jsonstor.LoadPlugin files this under jsonstor.Translators by TranslatorName.
	return {
		TranslatorName: 'N1qlExpression',
		Translate: Translate,
		// The table above, published. It is the ceiling an adapter's OperatorFidelities is
		// clamped against, and the column OperatorMatrix reads.
		Fidelities: FIDELITIES,
	};
};
