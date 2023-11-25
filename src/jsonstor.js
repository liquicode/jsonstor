'use strict';

const LIB_FS = require( 'fs' );
const LIB_PATH = require( 'path' );

const jsongin = require( '@liquicode/jsongin' )();

module.exports = function ( AdapterName, Settings, Filters )
{
	let Storages = {


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
					if ( typeof Storages.Adapters[ Plugin.AdapterName ] !== 'undefined' )
					{
						throw new Error( `Storage adapter [${Plugin.AdapterName}] already exists.` );
					}
					Storages.Adapters[ Plugin.AdapterName ] = Plugin;
				}
				else if ( Plugin.FilterName )
				{
					if ( typeof Storages.Filters[ Plugin.FilterName ] !== 'undefined' )
					{
						throw new Error( `Storage filter [${Plugin.FilterName}] already exists.` );
					}
					Storages.Filters[ Plugin.FilterName ] = Plugin;
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
					Storages.LoadPlugins( LIB_PATH.join( Path, entry.name ), true );
				}
				else if ( entry.isFile() )
				{
					try
					{
						let filename = LIB_PATH.join( Path, entry.name );
						let plugin = Storages.LoadPlugin( require( filename ) );
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
			if ( typeof Storages.Adapters[ AdapterName ] === 'undefined' ) { throw new Error( `Storage adapter [${AdapterName}] is not loaded.` ); }
			let storage = Storages.Adapters[ AdapterName ].GetAdapter( Settings );
			storage.AdapterName = AdapterName;
			if ( Array.isArray( Filters ) )
			{
				for ( let index = 0; index < Filters.length; index++ )
				{
					let item = Filters[ index ];
					if ( jsongin.ShortType( item ) !== 'o' ) { throw new Error( `The Filters parameter must be an array of filter entries: { FilterName: '...', Settings: {...} }.` ); }
					if ( typeof item.FilterName === 'undefined' ) { throw new Error( `The FilterName field is required.` ); }
					if ( typeof Storages.Filters[ item.FilterName ] === 'undefined' ) { throw new Error( `Storage filter [${item.FilterName}] is not loaded.` ); }
					storage = Storages.Filters[ item.FilterName ].GetFilter( storage, item.Settings );
					storage.FilterName = item.FilterName;
				}
			}
			return storage;
		},


	};


	//---------------------------------------------------------------------
	// Storages.LoadPlugins( __dirname, true );
	// Load Adapters
	Storages.LoadPlugin( require( './Adapters/jsonstor-memory' ) );
	Storages.LoadPlugin( require( './Adapters/jsonstor-jsonfile' ) );
	Storages.LoadPlugin( require( './Adapters/jsonstor-folder' ) );
	Storages.LoadPlugin( require( './Adapters/jsonstor-mongodb' ) );
	Storages.LoadPlugin( require( './Adapters/jsonstor-excel' ) );
	// Load Filters
	Storages.LoadPlugin( require( './Filters/jsonstor-oplog' ) );
	Storages.LoadPlugin( require( './Filters/jsonstor-userinfo' ) );


	//---------------------------------------------------------------------
	if ( typeof AdapterName === 'string' )
	{
		let storage = Storages.GetStorage( AdapterName, Settings, Filters );
		return storage;
	}


	return Storages;
};


