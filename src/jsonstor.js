'use strict';

const LIB_FS = require( 'fs' );
const LIB_PATH = require( 'path' );

const jsongin = require( '@liquicode/jsongin' )();

module.exports = function ( AdapterName, Settings, Filters )
{
	let jsonstor = {


		//---------------------------------------------------------------------
		Adapters: {},
		Filters: {},


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
			return storage;
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
	jsonstor.SqlExpression = require( './jsonstor/SqlExpression' )( jsonstor );


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


