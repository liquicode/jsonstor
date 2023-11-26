'use strict';


const LIB_FS = require( 'fs' );
const LIB_PATH = require( 'path' );

const jsongin = require( '@liquicode/jsongin' )();
// const jsonstor = require( '../jsonstor' )();
const MemoryStorageAdapter = require( './jsonstor-memory' );

module.exports = {

	AdapterName: 'jsonstor-jsonfile',
	AdapterDescription: 'Documents are cached in memory and persisted to a single json file.',

	GetAdapter: function ( jsonstor, Settings )
	{


		//=====================================================================
		/*
			Settings = {
				Path: '', // Path to the file storing the json files. If the file or folder don't exist, they will be created.
				AutoFlush: true, // Flushes cached data to the storage on each insert, update, replace, or delete.
			}
		*/
		if ( jsongin.ShortType( Settings ) !== 'o' ) { throw new Error( `This adapter requires a Settings parameter.` ); }
		if ( jsongin.ShortType( Settings.Path ) !== 's' ) { throw new Error( `This adapter requires a Settings.Path parameter.` ); }
		if ( jsongin.ShortType( Settings.AutoFlush ) !== 'b' ) { Settings.AutoFlush = true; }


		//=====================================================================
		let Storage = jsonstor.StorageInterface();
		Storage.Settings = Settings;
		Storage.MemoryStorage = MemoryStorageAdapter.GetAdapter( jsonstor, Settings );
		read_storage();


		//=====================================================================
		function read_storage()
		{
			Storage.MemoryStorage.store = [];
			if ( !LIB_FS.existsSync( Settings.Path ) ) { return; }
			let json = LIB_FS.readFileSync( Settings.Path, 'utf8' );
			Storage.MemoryStorage.store = JSON.parse( json );
			return;
		}


		//=====================================================================
		function write_storage()
		{
			let folder = LIB_PATH.dirname( Settings.Path );
			if ( !LIB_FS.existsSync( folder ) ) 
			{
				LIB_FS.mkdirSync( folder, { recursive: true } );
			}
			let json = JSON.stringify( Storage.MemoryStorage.store );
			LIB_FS.writeFileSync( Settings.Path, json, 'utf8' );
			return;
		}


		//=====================================================================
		function drop_storage()
		{
			Storage.MemoryStorage.store = [];
			if ( LIB_FS.existsSync( Settings.Path ) )
			{
				LIB_FS.unlinkSync( Settings.Path );
			}
			return;
		}


		//=====================================================================
		// DropStorage
		//=====================================================================


		Storage.DropStorage = async function ( Options ) 
		{
			return new Promise(
				async ( resolve, reject ) =>
				{
					try
					{
						drop_storage();
						resolve( true );
						return;
					}
					catch ( error )
					{
						reject( error );
						return;
					}
					return;
				} );
		};


		//=====================================================================
		// FlushStorage
		//=====================================================================


		Storage.FlushStorage = async function ( Options ) 
		{
			return new Promise(
				async ( resolve, reject ) =>
				{
					try
					{
						write_storage();
						resolve( true );
						return;
					}
					catch ( error )
					{
						reject( error );
						return;
					}
					return;
				} );
		};


		//=====================================================================
		// Count
		//=====================================================================


		Storage.Count = async function ( Criteria, Options ) 
		{
			let results = await Storage.MemoryStorage.Count( Criteria, Options );
			return results;
		};


		//=====================================================================
		// InsertOne
		//=====================================================================


		Storage.InsertOne = async function ( Document, Options ) 
		{
			let results = await Storage.MemoryStorage.InsertOne( Document, Options );
			if ( Storage.MemoryStorage.is_dirty )
			{
				if ( Settings.AutoFlush ) { write_storage(); }
				Storage.MemoryStorage.is_dirty = false;
			}
			return results;
		};


		//=====================================================================
		// InsertMany
		//=====================================================================


		Storage.InsertMany = async function ( Documents, Options ) 
		{
			let results = await Storage.MemoryStorage.InsertMany( Documents, Options );
			if ( Storage.MemoryStorage.is_dirty )
			{
				if ( Settings.AutoFlush ) { write_storage(); }
				Storage.MemoryStorage.is_dirty = false;
			}
			return results;
		};


		//=====================================================================
		// FindOne
		//=====================================================================


		Storage.FindOne = async function FindOne( Criteria, Projection, Options ) 
		{
			let results = await Storage.MemoryStorage.FindOne( Criteria, Projection, Options );
			return results;
		};


		//=====================================================================
		// FindMany
		//=====================================================================


		Storage.FindMany = async function FindMany( Criteria, Projection, Options ) 
		{
			let results = await Storage.MemoryStorage.FindMany( Criteria, Projection, Options );
			return results;
		};


		//=====================================================================
		// UpdateOne
		//=====================================================================


		Storage.UpdateOne = async function UpdateOne( Criteria, Update, Options ) 
		{
			let results = await Storage.MemoryStorage.UpdateOne( Criteria, Update, Options );
			if ( Storage.MemoryStorage.is_dirty )
			{
				if ( Settings.AutoFlush ) { write_storage(); }
				Storage.MemoryStorage.is_dirty = false;
			}
			return results;
		};


		//=====================================================================
		// UpdateMany
		//=====================================================================


		Storage.UpdateMany = async function UpdateMany( Criteria, Update, Options ) 
		{
			let results = await Storage.MemoryStorage.UpdateMany( Criteria, Update, Options );
			if ( Storage.MemoryStorage.is_dirty )
			{
				if ( Settings.AutoFlush ) { write_storage(); }
				Storage.MemoryStorage.is_dirty = false;
			}
			return results;
		};


		//=====================================================================
		// ReplaceOne
		//=====================================================================


		Storage.ReplaceOne = async function ReplaceOne( Criteria, Document, Options ) 
		{
			let results = await Storage.MemoryStorage.ReplaceOne( Criteria, Document, Options );
			if ( Storage.MemoryStorage.is_dirty )
			{
				if ( Settings.AutoFlush ) { write_storage(); }
				Storage.MemoryStorage.is_dirty = false;
			}
			return results;
		};


		//=====================================================================
		// DeleteOne
		//=====================================================================


		Storage.DeleteOne = async function DeleteOne( Criteria, Options ) 
		{
			let results = await Storage.MemoryStorage.DeleteOne( Criteria, Options );
			if ( Storage.MemoryStorage.is_dirty )
			{
				if ( Settings.AutoFlush ) { write_storage(); }
				Storage.MemoryStorage.is_dirty = false;
			}
			return results;
		};


		//=====================================================================
		// DeleteMany
		//=====================================================================


		Storage.DeleteMany = async function DeleteMany( Criteria, Options ) 
		{
			let results = await Storage.MemoryStorage.DeleteMany( Criteria, Options );
			if ( Storage.MemoryStorage.is_dirty )
			{
				if ( Settings.AutoFlush ) { write_storage(); }
				Storage.MemoryStorage.is_dirty = false;
			}
			return results;
		};


		//=====================================================================
		return Storage;
	},

};


