'use strict';

const LIB_FS = require( 'fs' );
const LIB_PATH = require( 'path' );

const jsongin = require( '@liquicode/jsongin' );

// ***Per-call measurement of the two stage model.*** It depends on nothing in jsonstor, so it
// is built once here rather than per instance. See src/jsonstor/Statistics.js.
const STATISTICS = require( './jsonstor/Statistics' )();


//---------------------------------------------------------------------
// ***Compares two version arrays, shortest-first and element by element.***
//
// A missing element is a zero, so `[ 21, 3 ]` and `[ 21, 3, 0, 0, 0 ]` are the same version -
// which they are, and which matters because a server states as many components as it likes and
// a floor is written with as few as say what it means.
function compare_versions( Left, Right )
{
	let length = Math.max( Left.length, Right.length );
	for ( let index = 0; index < length; index++ )
	{
		let left = ( index < Left.length ) ? Left[ index ] : 0;
		let right = ( index < Right.length ) ? Right[ index ] : 0;
		if ( left !== right ) { return ( left < right ) ? -1 : 1; }
	}
	return 0;
}


//---------------------------------------------------------------------
// ***The floor of the prime a storage is actually rendering with.***
//
// The check compares the profile a server ought to be using against the one in force, and
// which of the two is newer is what decides between an error and a warning. A dialect which
// names no prime in this family answers the lowest floor, so an unrecognized name is treated
// as the oldest profile rather than as a crossing nobody can act on.
function dialect_floor( Primes, DialectName )
{
	for ( let index = 0; index < Primes.length; index++ )
	{
		if ( Primes[ index ].AdapterName === DialectName ) { return Primes[ index ].Version; }
	}
	return Primes[ 0 ].Version;
}


//---------------------------------------------------------------------
// ***A crossed boundary is tagged so a caller can tell it from a connection failure.***
//
// The distinction matters wherever the check is remembered: a crossed boundary is a permanent
// fact about this storage and worth caching, and a server which simply did not answer is not.
function boundary_error( Message )
{
	let error = new Error( Message );
	error.DialectBoundary = true;
	return error;
}

module.exports = function ( AdapterName, Settings, Filters )
{
	let _package = require( '../package.json' );
	let jsonstor = {


		//---------------------------------------------------------------------
		// Library
		Library: {
			name: _package.name,
			url: _package.homepage,
			version: _package.version,
		},

		//---------------------------------------------------------------------
		Adapters: {},
		// ***Which registered names are aliases, and what each one resolves to.*** A name in
		// `Adapters` and not in here is a ***prime***: it carries a dialect profile of its own.
		// A name in both is an alias onto a prime, and shares that prime's adapter. This is what
		// lets documentation say whether a name carries a profile or resolves to one, and it is
		// where `DialectVersion` comes from. See jsonx/.plans/versioned-adapters.md.
		AdapterAliases: {},
		// ***Every registered name of a family, mapped to that family's prime names.*** The
		// boundary check needs to know which profiles a package has in order to say whether a
		// server landed in the wrong one, and a prime on its own does not know its siblings.
		AdapterFamilies: {},
		Filters: {},
		// ***A criteria translator is the third kind of plugin.*** It turns a jsongin
		// criteria into whatever its target backend can be asked, and reports what it
		// could not absorb. See jsonx/.plans/criteria-translation-layer.md.
		Translators: {},


		//---------------------------------------------------------------------
		LoadPlugin: function ( Plugin )
		{
			if ( jsongin.ShortType( Plugin ) === 'o' )
			{
				if ( Plugin.AdapterName )
				{
					// ***A package may carry a family of adapters rather than one.*** `Adapters`
					// holds its ***primes*** - the versions which differ in behavior, each with a
					// dialect profile of its own - and `Aliases` names everything else, including
					// the bare name. So `jsonstor-mysql-v5.7` is a prime beside
					// `jsonstor-mysql-v8.0` only if the two actually render differently;
					// otherwise one is an alias onto the other. A package declaring neither
					// registers exactly what it always did, so nothing which is not a family
					// changes. See jsonx/.plans/versioned-adapters.md.
					// ***The bare name is an alias whenever the package says it is.*** A family
					// names its default in `Aliases` rather than serving it from the plugin
					// object, so that `GetStorage( 'jsonstor-mysql' )` reports the prime it
					// resolved to instead of reporting itself. The plugin then registers only its
					// siblings, and the alias pass below claims the bare name. A package which
					// does not do this keeps registering the plugin under its own name, which is
					// every package written so far.
					let bare_is_alias =
						( jsongin.ShortType( Plugin.Aliases ) === 'o' )
						&& ( typeof Plugin.Aliases[ Plugin.AdapterName ] !== 'undefined' );
					let adapters = bare_is_alias ? [] : [ Plugin ];
					if ( jsongin.ShortType( Plugin.Adapters ) === 'a' )
					{
						adapters = adapters.concat( Plugin.Adapters );
					}
					for ( let index = 0; index < adapters.length; index++ )
					{
						let adapter = adapters[ index ];
						// ***A sibling which names itself nothing would register under `undefined`
						// and be found by no caller***, so it is refused rather than stored.
						if ( jsongin.ShortType( adapter.AdapterName ) !== 's' )
						{
							throw new Error( `Storage adapter [${Plugin.AdapterName}] has an entry in [Adapters] with no [AdapterName].` );
						}
						if ( typeof jsonstor.Adapters[ adapter.AdapterName ] !== 'undefined' )
						{
							throw new Error( `Storage adapter [${adapter.AdapterName}] already exists.` );
						}
						jsonstor.Adapters[ adapter.AdapterName ] = adapter;
					}
					// ***Aliases register last, because every one of them names a prime which
					// must already be there.*** An alias carries no dialect profile of its own -
					// it shares the prime's adapter - so this loop stores the same object under
					// a second name and records the resolution.
					if ( jsongin.ShortType( Plugin.Aliases ) === 'o' )
					{
						let alias_names = Object.keys( Plugin.Aliases );
						for ( let index = 0; index < alias_names.length; index++ )
						{
							let alias_name = alias_names[ index ];
							let prime_name = Plugin.Aliases[ alias_name ];
							if ( jsongin.ShortType( prime_name ) !== 's' )
							{
								throw new Error( `Storage adapter [${Plugin.AdapterName}] has an alias [${alias_name}] which names no adapter.` );
							}
							// ***An unknown target is refused at load time*** rather than at the
							// GetStorage which happens to ask for it, because a typo here is a
							// mistake in the package and not in the caller.
							if ( typeof jsonstor.Adapters[ prime_name ] === 'undefined' )
							{
								throw new Error( `Storage adapter [${Plugin.AdapterName}] has an alias [${alias_name}] naming [${prime_name}], which is not registered.` );
							}
							// ***An alias names a prime and never another alias.*** Chaining
							// would make the resolution order-dependent and would let
							// `DialectVersion` report a name which carries no profile.
							if ( typeof jsonstor.AdapterAliases[ prime_name ] !== 'undefined' )
							{
								throw new Error( `Storage adapter [${Plugin.AdapterName}] has an alias [${alias_name}] naming [${prime_name}], which is itself an alias. An alias must name a prime.` );
							}
							if ( typeof jsonstor.Adapters[ alias_name ] !== 'undefined' )
							{
								throw new Error( `Storage adapter [${alias_name}] already exists.` );
							}
							jsonstor.Adapters[ alias_name ] = jsonstor.Adapters[ prime_name ];
							jsonstor.AdapterAliases[ alias_name ] = prime_name;
						}
					}
					// ***Every name of a family remembers the whole family.*** A prime knows its
					// own floor and not its siblings', so the boundary check could not otherwise
					// ask which profile a measured server ought to be using.
					if ( ( jsongin.ShortType( Plugin.Adapters ) === 'a' ) && ( Plugin.Adapters.length > 0 ) )
					{
						let prime_names = Plugin.Adapters.map( function ( Prime ) { return Prime.AdapterName; } );
						let every_name = prime_names.slice();
						if ( !bare_is_alias ) { every_name.push( Plugin.AdapterName ); }
						if ( jsongin.ShortType( Plugin.Aliases ) === 'o' )
						{
							every_name = every_name.concat( Object.keys( Plugin.Aliases ) );
						}
						for ( let index = 0; index < every_name.length; index++ )
						{
							jsonstor.AdapterFamilies[ every_name[ index ] ] = prime_names;
						}
					}
				}
				else if ( Plugin.FilterName )
				{
					if ( typeof jsonstor.Filters[ Plugin.FilterName ] !== 'undefined' )
					{
						throw new Error( `Storage filter [${Plugin.FilterName}] already exists.` );
					}
					jsonstor.Filters[ Plugin.FilterName ] = Plugin;
				}
				else if ( Plugin.TranslatorName )
				{
					if ( typeof jsonstor.Translators[ Plugin.TranslatorName ] !== 'undefined' )
					{
						throw new Error( `Criteria translator [${Plugin.TranslatorName}] already exists.` );
					}
					jsonstor.Translators[ Plugin.TranslatorName ] = Plugin;
				}
				else { return null; }
			}
			return Plugin;
		},


		//---------------------------------------------------------------------
		LoadPlugins: function ( Path, Recurse )
		{
			if ( !LIB_FS.existsSync( Path ) ) { throw new Error( `The path [${Path}] does not exist.` ); }
			let dir_entries = LIB_FS.readdirSync( Path, { withFileTypes: true } );
			for ( let index = 0; index < dir_entries.length; index++ )
			{
				let entry = dir_entries[ index ];
				if ( entry.isDirectory() && Recurse )
				{
					jsonstor.LoadPlugins( LIB_PATH.join( Path, entry.name ), true );
				}
				else if ( entry.isFile() )
				{
					try
					{
						let filename = LIB_PATH.join( Path, entry.name );
						let plugin = jsonstor.LoadPlugin( require( filename ) );
					}
					catch ( error )
					{
						console.error( error );
					}
				}
			}
			return;
		},


		//---------------------------------------------------------------------
		GetStorage: function ( AdapterName, Settings, Filters )
		{
			if ( !'olu'.includes( jsongin.ShortType( Settings ) ) ) { throw new Error( `The Settings parameter must be an object, null, or undefined.` ); }
			if ( 'lu'.includes( jsongin.ShortType( Settings ) ) ) { Settings = {}; }
			if ( typeof jsonstor.Adapters[ AdapterName ] === 'undefined' ) { throw new Error( `Storage adapter [${AdapterName}] is not loaded.` ); }
			let storage = jsonstor.Adapters[ AdapterName ].GetAdapter( jsonstor, Settings );
			// ***Two names, because a caller asks for one and gets the behavior of another.***
			// `AdapterName` is what was asked for and `DialectVersion` is the prime it resolved
			// to, which is the name that says which dialect profile is actually running. They are
			// the same string whenever the caller named a prime directly.
			storage.AdapterName = AdapterName;
			storage.DialectVersion = jsonstor.AdapterAliases[ AdapterName ] || AdapterName;
			if ( Array.isArray( Filters ) )
			{
				for ( let index = 0; index < Filters.length; index++ )
				{
					let item = Filters[ index ];
					if ( jsongin.ShortType( item ) !== 'o' ) { throw new Error( `The Filters parameter must be an array of filter entries: { FilterName: '...', Settings: {...} }.` ); }
					if ( typeof item.FilterName === 'undefined' ) { throw new Error( `The FilterName field is required.` ); }
					if ( typeof jsonstor.Filters[ item.FilterName ] === 'undefined' ) { throw new Error( `Storage filter [${item.FilterName}] is not loaded.` ); }
					storage = jsonstor.Filters[ item.FilterName ].GetFilter( jsonstor, storage, item.Settings );
					storage.FilterName = item.FilterName;
				}
			}
			// ***Last, so that it is outermost.*** Options.Statistics is stripped here and a
			// private collector forwarded in its place, which is what keeps every filter and
			// the adapter beneath returning the value they always returned.
			STATISTICS.Wrap( storage, AdapterName );
			return storage;
		},


		//---------------------------------------------------------------------
		GetFilter: function ( FilterName, Storage, Settings )
		{
			if ( jsongin.ShortType( FilterName ) !== 's' ) { throw new Error( `The FilterName field must be a string.` ); }
			if ( !'olu'.includes( jsongin.ShortType( Settings ) ) ) { throw new Error( `The Settings parameter must be an object, null, or undefined.` ); }
			if ( 'lu'.includes( jsongin.ShortType( Settings ) ) ) { Settings = {}; }
			if ( typeof jsonstor.Filters[ FilterName ] === 'undefined' ) { throw new Error( `Storage filter [${FilterName}] is not loaded.` ); }
			let storage = jsonstor.Filters[ FilterName ].GetFilter( jsonstor, Storage, Settings );
			storage.FilterName = FilterName;
			// ***This is a second entry point and it needs the same wrapper.*** A storage built
			// here never passed through GetStorage, so without this a filtered storage would
			// accept Options.Statistics and silently answer without any.
			STATISTICS.Wrap( storage, ( Storage && Storage.AdapterName ) || '' );
			return storage;
		},


		//---------------------------------------------------------------------
		// What an adapter calls to report one criteria evaluation. A no-op unless this call
		// was made with Options.Statistics, so it is called unconditionally.
		ReportStatistics: function ( Options, Statistics )
		{
			return STATISTICS.Report( Options, Statistics );
		},


		//---------------------------------------------------------------------
		// What has already been reported for this call, or null. For an adapter which learns
		// the pushdown and its row count in two different places.
		ReadStatistics: function ( Options )
		{
			return STATISTICS.Read( Options );
		},


		//---------------------------------------------------------------------
		IsMeasuringStatistics: function ( Options )
		{
			return STATISTICS.IsMeasuring( Options );
		},


		//---------------------------------------------------------------------
		StorageInterface: function ()
		{
			let storage = {
				// Storage Interface
				DropStorage: async function ( Options ) { throw new Error( 'DropStorage is not implemeted.' ); },
				FlushStorage: async function ( Options ) { throw new Error( 'FlushStorage is not implemeted.' ); },
				Count: async function ( Criteria, Options ) { throw new Error( 'Count is not implemeted.' ); },
				InsertOne: async function ( Document, Options ) { throw new Error( 'InsertOne is not implemeted.' ); },
				InsertMany: async function ( Documents, Options ) { throw new Error( 'InsertMany is not implemeted.' ); },
				FindOne: async function ( Criteria, Projection, Options ) { throw new Error( 'FindOne is not implemeted.' ); },
				FindMany: async function ( Criteria, Projection, Options ) { throw new Error( 'FindMany is not implemeted.' ); },
				UpdateOne: async function ( Criteria, Updates, Options ) { throw new Error( 'UpdateOne is not implemeted.' ); },
				UpdateMany: async function ( Criteria, Updates, Options ) { throw new Error( 'UpdateMany is not implemeted.' ); },
				ReplaceOne: async function ( Criteria, Document, Options ) { throw new Error( 'ReplaceOne is not implemeted.' ); },
				DeleteOne: async function ( Criteria, Options ) { throw new Error( 'DeleteOne is not implemeted.' ); },
				DeleteMany: async function ( Criteria, Options ) { throw new Error( 'DeleteMany is not implemeted.' ); },
				// ***The thirteenth method, and the only one which asks about the storage rather
				// than about the documents in it.*** A developer chooses which adapter to use and
				// nothing in this family checks a version and refuses, so the family owes them
				// the fact instead of the judgement. Spelled correctly, unlike its twelve
				// siblings. See jsonx/.plans/versioned-adapters.md.
				StorageInfo: async function ( Options ) { throw new Error( 'StorageInfo is not implemented.' ); },
				// ***The fourteenth method, and the second one which asks about the storage
				// rather than about the documents in it.*** An adapter which holds its own index
				// has to be told when something else wrote the store it is pointed at, and
				// jsonstor-folder, -jsonfile and -excel exist precisely to be pointed at such a
				// store. A stale index does not return wrong rows, ***it loses them silently***,
				// which is the failure shape this family keeps meeting.
				//
				// ***It is a stub rather than a default no-op*** so that an adapter which forgets
				// it fails loudly instead of quietly doing nothing, which is what this list is
				// for. An adapter whose database hosts the index answers 0 and means it.
				// See jsonx/.plans/primary-keys-and-indexes.md.
				RefreshIndex: async function ( Options ) { throw new Error( 'RefreshIndex is not implemented.' ); },
			};
			return storage;
		},


		//---------------------------------------------------------------------
		// ***Assembles the thirteenth method's answer so that ten adapters do not each do it.***
		//
		// An adapter knows what its server said and nothing else here: the names come from the
		// storage, and the parse comes from the raw string. ***The raw string survives beside the
		// parse*** because Oracle answers `21.3.0.0.0` and PostgreSql answers
		// `16.15 (Debian 16.15-1.pgdg13+2)`, parsing either can be wrong, and a developer who
		// needs to see what the server really said should not have to take our word for it.
		BuildStorageInfo: function ( Storage, Facts )
		{
			if ( jsongin.ShortType( Facts ) !== 'o' ) { Facts = {}; }
			let version = ( jsongin.ShortType( Facts.Version ) === 's' ) ? Facts.Version : '';

			// ***An adapter which has not declared a key still answers this call.*** The empty
			// shape says there is no primary key here, which is a fact rather than a gap, and it
			// is what an adapter written before these fields existed honestly has to report.
			let primary_key_info = {
				Fields: [],
				Types: [],
				Mutable: false,
				Generated: false,
				IndexHostedBy: 'none',
			};
			if ( jsongin.ShortType( Storage ) === 'o' )
			{
				if ( jsongin.ShortType( Storage.PrimaryKeyInfo ) === 'o' )
				{
					let declared = Storage.PrimaryKeyInfo;
					if ( Array.isArray( declared.Fields ) ) { primary_key_info.Fields = declared.Fields; }
					if ( Array.isArray( declared.Types ) ) { primary_key_info.Types = declared.Types; }
					primary_key_info.Mutable = ( declared.Mutable === true );
					primary_key_info.Generated = ( declared.Generated === true );
					if ( jsongin.ShortType( declared.IndexHostedBy ) === 's' ) { primary_key_info.IndexHostedBy = declared.IndexHostedBy; }
				}
			}
			let info = {
				// ***Two names, because a caller asks for one and gets the behavior of another.***
				Requested: Storage.AdapterName || '',
				Dialect: Storage.DialectVersion || Storage.AdapterName || '',
				Product: ( jsongin.ShortType( Facts.Product ) === 's' ) ? Facts.Product : '',
				Version: version,
				VersionParts: jsonstor.VersionParts( version ),
				Banner: ( jsongin.ShortType( Facts.Banner ) === 's' ) ? Facts.Banner : version,
				// ***Empty when in-process***, so no caller has to special-case an adapter which
				// is not talking to anything over a socket.
				Endpoint: ( jsongin.ShortType( Facts.Endpoint ) === 's' ) ? Facts.Endpoint : '',
				InProcess: ( Facts.InProcess === true ),
				// ***What the identity settings turned out to mean.*** Settings in, resolved fact
				// out - the same shape Requested and Dialect have two lines up, and the only
				// adapter-agnostic way a caller can ask what the key actually is. That matters
				// most where it was discovered rather than declared: a SQL adapter attached to a
				// foreign table reads its key out of the DDL, so the setting a caller passed and
				// the key in force are different facts and only one of them is here.
				//
				// ***Always arrays, because a composite key is declared even where no adapter
				// honors one yet.*** A caller written against a string would have to be rewritten
				// the day one does. Same reasoning as VersionParts beside Version.
				PrimaryKey: primary_key_info.Fields.slice(),
				PrimaryKeyType: primary_key_info.Types.slice(),
				PrimaryKeyMutable: primary_key_info.Mutable,
				PrimaryKeyGenerated: primary_key_info.Generated,
				// 'database' where the store enforces the key and answers a lookup, 'jsonstor'
				// where this library holds the index, 'none' where uniqueness costs a scan.
				IndexHostedBy: primary_key_info.IndexHostedBy,
				Warnings: Array.isArray( Facts.Warnings ) ? Facts.Warnings.slice() : [],
			};
			// ***Assembling the answer is where the boundary is checked***, so every adapter
			// gets it by building its info and none of them has to remember to ask.
			info.Warnings = info.Warnings.concat( jsonstor.CheckDialectBoundary( info ) );
			return info;
		},


		//---------------------------------------------------------------------
		// ***Did this server land in a different prime's range than the dialect in force?***
		//
		// A prime is a floor: it covers every version from its own upward until the next prime.
		// So the profile a measured server *ought* to be using is the highest floor at or below
		// it, and anything else means the storage is rendering SQL this server will not accept.
		// ***That is an error and not a warning***, because the alternative is a sheet of
		// failures which name a clause instead of naming the cause.
		//
		// ***A disagreement inside one prime's range is silent***, which is what makes the floor
		// model do real work: a `-v14.24` name against a 14.25 server crosses no boundary, and
		// that is the case which would otherwise break on every image pull.
		//
		// Returns warnings. Throws when a boundary is crossed. Answers nothing at all for a
		// package with no primes, which is every package but one today.
		CheckDialectBoundary: function ( Info )
		{
			let warnings = [];
			let family = jsonstor.AdapterFamilies[ Info.Requested ];
			if ( !Array.isArray( family ) ) { return warnings; }
			if ( Info.VersionParts.length === 0 ) { return warnings; }

			// ***Only the primes which declare a floor take part.*** A family may register names
			// before anyone has measured what they cover, and guessing a floor would be worse
			// than not checking.
			let primes = [];
			for ( let index = 0; index < family.length; index++ )
			{
				let prime = jsonstor.Adapters[ family[ index ] ];
				if ( prime && Array.isArray( prime.Version ) && prime.Version.length ) { primes.push( prime ); }
			}
			if ( primes.length === 0 ) { return warnings; }
			primes.sort( function ( Left, Right ) { return compare_versions( Left.Version, Right.Version ); } );

			// ***Below every floor is its own failure***, and a clearer one than picking the
			// lowest profile and letting the server refuse it.
			if ( compare_versions( Info.VersionParts, primes[ 0 ].Version ) < 0 )
			{
				throw boundary_error( `[${Info.Requested}] was requested, but the connected server reports [${Info.Version}], which is older than [${primes[ 0 ].AdapterName}] - the oldest version this package supports.` );
			}

			let expected = primes[ 0 ];
			for ( let index = 0; index < primes.length; index++ )
			{
				if ( compare_versions( Info.VersionParts, primes[ index ].Version ) >= 0 ) { expected = primes[ index ]; }
			}

			// ***The two directions are not the same failure, and only one of them is one.***
			//
			// A dialect ***newer*** than the server renders SQL the server will refuse, and that
			// is an error: Oracle 18.0 answers ORA-00933 to the 23c spelling, and the
			// alternative is a sheet of failures which name a clause instead of the cause.
			//
			// ***A dialect older than the server is merely slow.*** Every option a profile
			// declines to render is a predicate `jsongin` decides instead, so the answer is the
			// same one and fewer rows are pre-filtered - which is `SqlExpression.apply_defaults`
			// in one sentence: declaring nothing is always correct, and merely slow. ***Measured
			// on 2026-09-01***, the `jsonstor-oracle-v18.0` profile against the 23.26 server
			// answered every case correctly, including against a table holding a real `BOOLEAN`
			// column it does not understand. Refusing that would refuse something which works.
			//
			// *(User, 2026-09-01, on the measurement. This narrows the rule of the same day that
			// any crossing is an error; it stands for the direction which is actually broken.)*
			let expected_is_newer = ( compare_versions( expected.Version, dialect_floor( primes, Info.Dialect ) ) > 0 );
			if ( ( expected.AdapterName !== Info.Dialect ) && expected_is_newer )
			{
				warnings.push( `The connected server reports [${Info.Version}], which is newer than the range [${Info.Dialect}] covers. [${expected.AdapterName}] is the profile for it; this one answers correctly and pre-filters less.` );
				return warnings;
			}
			if ( expected.AdapterName !== Info.Dialect )
			{
				throw boundary_error( `[${Info.Requested}] was requested and uses the [${Info.Dialect}] dialect, but the connected server reports [${Info.Version}], which requires [${expected.AdapterName}].` );
			}

			// ***Past everything anyone has run is a warning and not an error.*** There is no
			// boundary above it, so the profile is very likely right - but it is also a version
			// nobody has measured, and staying silent would make the support claim this family
			// is careful not to make.
			//
			// ***So a prime records the ceiling at the precision it was measured at.*** The
			// comparison zero-pads, which means `MeasuredTo: [ 21, 3 ]` covers a server
			// reporting 21.3.0.0.0 and `[ 8, 4 ]` does ***not*** cover one reporting 8.4.11 -
			// and the second is right, because 8.4.11 is a version somebody ran rather than a
			// line somebody claimed. A prime which declares less than it measured warns about
			// its own test server, which is how this was found.
			if ( Array.isArray( expected.MeasuredTo ) && expected.MeasuredTo.length
				&& ( compare_versions( Info.VersionParts, expected.MeasuredTo ) > 0 ) )
			{
				warnings.push( `The connected server reports [${Info.Version}], which is newer than [${expected.MeasuredTo.join( '.' )}] - the newest version [${expected.AdapterName}] has been measured against. It is untested here.` );
			}
			return warnings;
		},


		//---------------------------------------------------------------------
		// ***The leading run of dotted integers, and nothing after it.***
		//
		// Every server in this family states its version differently and several bury it in
		// prose. This takes what can be compared and leaves the rest to `Banner`.
		VersionParts: function ( Version )
		{
			if ( jsongin.ShortType( Version ) !== 's' ) { return []; }
			let found = Version.match( /(\d+(?:\.\d+)*)/ );
			if ( found === null ) { return []; }
			return found[ 1 ].split( '.' ).map( function ( Part ) { return parseInt( Part, 10 ); } );
		},


	};


	//---------------------------------------------------------------------
	// Load Translators
	jsonstor.LoadPlugin( require( './jsonstor/SqlExpression' )( jsonstor ) );
	// ***Mango is not MongoDB's alone.*** CouchDB and PouchDB speak a narrower dialect of it
	// and narrow this translator with an option rather than writing another one, which is why
	// it ships here beside SqlExpression instead of inside jsonstor-mongodb.
	jsonstor.LoadPlugin( require( './jsonstor/MangoExpression' )( jsonstor ) );
	// ***Query DSL is not Elasticsearch's alone either.*** OpenSearch answered every one of
	// the thirty one operators identically on 2026-09-05, so one translator serves the fork -
	// the same reason Mango sits here rather than inside jsonstor-mongodb.
	jsonstor.LoadPlugin( require( './jsonstor/ElasticExpression' )( jsonstor ) );
	// ***Named for convenience; the registry is the authority.*** An adapter reaches its
	// translator by name either way, and a third party translator has only the registry.
	jsonstor.SqlExpression = jsonstor.Translators[ 'SqlExpression' ];
	jsonstor.MangoExpression = jsonstor.Translators[ 'MangoExpression' ];
	jsonstor.ElasticExpression = jsonstor.Translators[ 'ElasticExpression' ];

	// ***What every registered translator does with every jsongin query operator.***
	// Built from jsongin's operator list and whatever is registered above, so neither the
	// rows nor the columns are written down twice.
	jsonstor.OperatorMatrix = require( './jsonstor/OperatorMatrix' )( jsonstor );

	// ***A unique identifier, without a dependency.*** The adapters cannot reach this
	// instance - requiring it from one would be circular - so they require the module
	// directly and this is the same function under a public name.
	jsonstor.NewUniqueID = require( './jsonstor/NewUniqueID' );

	// ***The primary key, and the index underneath it.*** The built-in adapters require the
	// module directly for the same reason NewUniqueID exists twice, and this is how the eleven
	// external adapters reach it - they are separate packages and `../jsonstor/PrimaryKey` is
	// not a path any of them has. See jsonx/.plans/primary-keys-and-indexes.md.
	jsonstor.PrimaryKey = require( './jsonstor/PrimaryKey' )();

	// ***The target-agnostic half of a translator, for whoever writes the next one.***
	// The criteria-shape and allowlist questions, with no target in them. See the module.
	jsonstor.TranslatorSupport = require( './jsonstor/TranslatorSupport' )();


	//---------------------------------------------------------------------
	// Storages.LoadPlugins( __dirname, true );
	// Load Adapters
	jsonstor.LoadPlugin( require( './Adapters/jsonstor-memory' ) );
	jsonstor.LoadPlugin( require( './Adapters/jsonstor-jsonfile' ) );
	jsonstor.LoadPlugin( require( './Adapters/jsonstor-folder' ) );
	// Storages.LoadPlugin( require( './Adapters/jsonstor-mongodb' ) );
	// Storages.LoadPlugin( require( './Adapters/jsonstor-excel' ) );
	// Load Filters
	jsonstor.LoadPlugin( require( './Filters/jsonstor-oplog' ) );
	jsonstor.LoadPlugin( require( './Filters/jsonstor-userinfo' ) );


	//---------------------------------------------------------------------
	if ( typeof AdapterName === 'string' )
	{
		let storage = jsonstor.GetStorage( AdapterName, Settings, Filters );
		return storage;
	}


	return jsonstor;
};


