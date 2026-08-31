'use strict';

const jsongin = require( '@liquicode/jsongin' );

/*
	Per-call measurement of the two stage model.

	***Every storage call is two filters, and this is what makes that visible.*** A criteria is
	split into a Pushdown - the part the backend can be asked, as a SQL WHERE clause or a Mango
	criteria - and a Residual, which is what jsongin still has to decide about each row that
	came back. The architecture rests on the first stage never excluding a row the second one
	would keep, and until now nothing reported whether the first stage did anything at all.

	***Six engines once reported 120/120 with the pre-filter entirely unmeasured***, because the
	conformance configuration declares no columns, so no WHERE clause was ever built and every
	row travelled. The tests were green about a code path they never entered. A number here is
	what turns that from a thing to remember into a thing to assert.

	***The measurement is per call and never on the storage.*** A counter living on the Storage
	would blend two overlapping calls into one meaningless pair of numbers, and could not say
	which call it described. The collector travels on the Options of the call it belongs to.

	***Only the outermost layer changes its return shape.*** Wrap() strips the caller's
	Statistics flag before forwarding and replaces it with a private collector, so every filter
	and adapter beneath sees an ordinary call and returns an ordinary value. Nothing inside can
	hand a caller { Result } where it expected documents.
*/

module.exports = function ()
{


	//---------------------------------------------------------------------
	// The private channel a call's measurements travel back on.
	//
	// ***A Symbol rather than a name.*** Options is the caller's object and this is not the
	// caller's field: a string key could collide with a setting some adapter already reads, and
	// would show up in anything which enumerated or serialized the options.
	const COLLECTOR = Symbol( 'jsonstor.Statistics' );


	//---------------------------------------------------------------------
	// Which argument of each storage function is the Options.
	//
	// ***Declared rather than derived.*** The position differs per function - Options is the
	// first argument of DropStorage and the fifth of FindMany2 - and reading the last argument
	// instead would guess wrongly the moment a caller omitted an optional one. FindMany2 is
	// listed here although StorageInterface() does not declare it, because the adapters do.
	const STORAGE_FUNCTIONS = {
		DropStorage: 0,
		FlushStorage: 0,
		Count: 1,
		InsertOne: 1,
		InsertMany: 1,
		FindOne: 2,
		FindMany: 2,
		FindMany2: 4,
		UpdateOne: 2,
		UpdateMany: 2,
		ReplaceOne: 2,
		DeleteOne: 1,
		DeleteMany: 1,
	};


	//---------------------------------------------------------------------
	// What a call reports before anything has measured it.
	//
	// ***Measured is the honest half.*** A call which pushed nothing down and a call whose
	// adapter never reported both leave zeroes behind, and those are different facts: the first
	// scanned no rows, the second was not measured at all. A caller which cannot tell them
	// apart would read an uninstrumented adapter as a perfectly selective one.
	function new_statistics( AdapterName )
	{
		return {
			Adapter: AdapterName || '',
			Measured: false,
			Translator: '',
			Pushdown: null,
			PushdownRows: 0,
			Residual: null,
			ResidualRows: 0,
		};
	}


	//---------------------------------------------------------------------
	// An adapter reporting what one criteria evaluation did.
	//
	// ***A no-op when nobody asked***, which is what lets an adapter call it unconditionally on
	// its query path rather than testing first. The values it reports are already locals there.
	function Report( Options, Statistics )
	{
		if ( jsongin.ShortType( Options ) !== 'o' ) { return false; }
		let collector = Options[ COLLECTOR ];
		if ( !collector ) { return false; }
		if ( jsongin.ShortType( Statistics ) === 'o' )
		{
			let names = Object.keys( Statistics );
			for ( let index = 0; index < names.length; index++ )
			{
				collector[ names[ index ] ] = Statistics[ names[ index ] ];
			}
		}
		collector.Measured = true;
		return true;
	}


	//---------------------------------------------------------------------
	// What has been reported for this call so far, or null.
	//
	// ***For an adapter which learns the two halves in two places.*** jsonstor-mongodb knows
	// the Pushdown and the Residual where it translates the criteria, and knows how many rows
	// travelled only on the branch which resolves them to _ids - on its other branch the
	// server answers exactly and the count is not known until the caller has the documents.
	// Reading back what is already there is what lets the second report complete the first
	// without overwriting a number which was already true.
	//
	// A copy, so a caller cannot edit the collector except through Report.
	function Read( Options )
	{
		if ( jsongin.ShortType( Options ) !== 'o' ) { return null; }
		let collector = Options[ COLLECTOR ];
		if ( !collector ) { return null; }
		return Object.assign( {}, collector );
	}


	//---------------------------------------------------------------------
	// Whether this call is being measured, for an adapter which would have to do real work to
	// answer. Nothing needs it today; the SQL adapters already hold their numbers as locals.
	function IsMeasuring( Options )
	{
		if ( jsongin.ShortType( Options ) !== 'o' ) { return false; }
		return !!Options[ COLLECTOR ];
	}


	//---------------------------------------------------------------------
	function wrapped_function( Storage, Name, OptionsIndex, AdapterName )
	{
		let original = Storage[ Name ];
		return async function ()
		{
			let args = Array.prototype.slice.call( arguments );
			let options = args[ OptionsIndex ];

			// Not asked for, so this call is exactly what it was before.
			if ( jsongin.ShortType( options ) !== 'o' ) { return await original.apply( Storage, args ); }
			if ( !options.Statistics ) { return await original.apply( Storage, args ); }

			// ***The flag is stripped and the collector takes its place.*** What travels inward
			// is an ordinary Options, so no filter and no adapter beneath this point changes
			// what it returns.
			let statistics = new_statistics( AdapterName );
			let forwarded = Object.assign( {}, options );
			delete forwarded.Statistics;
			forwarded[ COLLECTOR ] = statistics;
			args[ OptionsIndex ] = forwarded;

			let result = await original.apply( Storage, args );
			return { Result: result, Statistics: statistics };
		};
	}


	//---------------------------------------------------------------------
	// Installs the measurement on a storage, in place.
	//
	// ***Applied once, at the outermost layer.*** GetStorage calls this after the filters have
	// wrapped the adapter, so the flag is stripped before it can reach either.
	function Wrap( Storage, AdapterName )
	{
		if ( jsongin.ShortType( Storage ) !== 'o' ) { return Storage; }
		let names = Object.keys( STORAGE_FUNCTIONS );
		for ( let index = 0; index < names.length; index++ )
		{
			let name = names[ index ];
			if ( typeof Storage[ name ] !== 'function' ) { continue; }
			Storage[ name ] = wrapped_function( Storage, name, STORAGE_FUNCTIONS[ name ], AdapterName );
		}
		return Storage;
	}


	//---------------------------------------------------------------------
	return {
		Wrap: Wrap,
		Report: Report,
		Read: Read,
		IsMeasuring: IsMeasuring,
	};

};
