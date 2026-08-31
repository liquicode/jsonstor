'use strict';

const LIB_FS = require( 'fs' );
const LIB_PATH = require( 'path' );

const jsongin = require( '@liquicode/jsongin' );

// ***Per-call measurement of the two stage model.*** It depends on nothing in jsonstor, so it
// is built once here rather than per instance. See src/jsonstor/Statistics.js.
const STATISTICS = require( './jsonstor/Statistics' )();

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
					if ( typeof jsonstor.Adapters[ Plugin.AdapterName ] !== 'undefined' )
					{
						throw new Error( `Storage adapter [${Plugin.AdapterName}] already exists.` );
					}
					jsonstor.Adapters[ Plugin.AdapterName ] = Plugin;
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
			storage.AdapterName = AdapterName;
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
			};
			return storage;
		},


	};


	//---------------------------------------------------------------------
	// Load Translators
	jsonstor.LoadPlugin( require( './jsonstor/SqlExpression' )( jsonstor ) );
	// ***Mango is not MongoDB's alone.*** CouchDB and PouchDB speak a narrower dialect of it
	// and narrow this translator with an option rather than writing another one, which is why
	// it ships here beside SqlExpression instead of inside jsonstor-mongodb.
	jsonstor.LoadPlugin( require( './jsonstor/MangoExpression' )( jsonstor ) );
	// ***Named for convenience; the registry is the authority.*** An adapter reaches its
	// translator by name either way, and a third party translator has only the registry.
	jsonstor.SqlExpression = jsonstor.Translators[ 'SqlExpression' ];
	jsonstor.MangoExpression = jsonstor.Translators[ 'MangoExpression' ];

	// ***What every registered translator does with every jsongin query operator.***
	// Built from jsongin's operator list and whatever is registered above, so neither the
	// rows nor the columns are written down twice.
	jsonstor.OperatorMatrix = require( './jsonstor/OperatorMatrix' )( jsonstor );

	// ***A unique identifier, without a dependency.*** The adapters cannot reach this
	// instance - requiring it from one would be circular - so they require the module
	// directly and this is the same function under a public name.
	jsonstor.NewUniqueID = require( './jsonstor/NewUniqueID' );

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


