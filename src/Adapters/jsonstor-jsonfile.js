'use strict';


const LIB_FS = require( 'fs' );
const LIB_PATH = require( 'path' );

const jsongin = require( '@liquicode/jsongin' );
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
		// ***The key is the memory storage's, because the memory storage is where it is enforced.***
		// This adapter forwards every document function to it and persists what comes back, so a
		// second resolution here would be a second description of one fact.
		Storage.PrimaryKeyInfo = Storage.MemoryStorage.PrimaryKeyInfo;

		read_storage();


		//=====================================================================
		// ***Every read of the file rebuilds the index***, because the read replaces the whole
		// store rather than adding to it. An index left over from the previous contents does not
		// return wrong rows, it ***loses them silently***, which is the failure shape this design
		// exists to close. Synchronous, because there is nothing here to await into.
		function read_storage()
		{
			Storage.MemoryStorage.Store = [];
			if ( LIB_FS.existsSync( Settings.Path ) )
			{
				let json = LIB_FS.readFileSync( Settings.Path, 'utf8' );
				Storage.MemoryStorage.Store = JSON.parse( json );
			}
			Storage.MemoryStorage.RebuildIndex();
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
			let json = JSON.stringify( Storage.MemoryStorage.Store );
			LIB_FS.writeFileSync( Settings.Path, json, 'utf8' );
			return;
		}


		//=====================================================================
		function drop_storage()
		{
			Storage.MemoryStorage.Store = [];
			Storage.MemoryStorage.RebuildIndex();
			if ( LIB_FS.existsSync( Settings.Path ) )
			{
				LIB_FS.unlinkSync( Settings.Path );
			}
			return;
		}


		//=====================================================================
		// DropStorage
		//=====================================================================


		// ***What this storage is actually talking to.*** An in-process adapter reports the
		// version of whatever implements it, which here is the engine every one of these
		// adapters is built on.
		Storage.StorageInfo = async function ( Options )
		{
			return jsonstor.BuildStorageInfo( Storage, {
				Product: 'jsongin',
				Version: jsongin.Library.version,
				InProcess: true,
			} );
		};


		//=====================================================================
		// RefreshIndex
		//=====================================================================


		// ***Re-reads the file and rebuilds the index from what is in it.***
		//
		// ***This adapter caches the whole collection, so a foreign write makes the documents
		// stale and not only the index.*** Refreshing an index without re-reading the file would
		// answer a caller who knows something else wrote by rebuilding an index over contents
		// which are equally out of date - a repair which repairs the smaller half of the problem
		// and reports success. So the file is read first, which is the escape hatch a caller
		// pointing this adapter at a shared file actually needs.
		Storage.RefreshIndex = async function ( Options )
		{
			read_storage();
			return await Storage.MemoryStorage.RefreshIndex( Options );
		};


		Storage.DropStorage = async function ( Options )
		{
			return new Promise(
				async function ( resolve, reject )
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
				async function ( resolve, reject )
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
			if ( Storage.MemoryStorage.IsDirty )
			{
				if ( Settings.AutoFlush ) { write_storage(); }
				Storage.MemoryStorage.IsDirty = false;
			}
			return results;
		};


		//=====================================================================
		// InsertMany
		//=====================================================================


		Storage.InsertMany = async function ( Documents, Options ) 
		{
			let results = await Storage.MemoryStorage.InsertMany( Documents, Options );
			if ( Storage.MemoryStorage.IsDirty )
			{
				if ( Settings.AutoFlush ) { write_storage(); }
				Storage.MemoryStorage.IsDirty = false;
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
		// FindMany2
		//=====================================================================


		Storage.FindMany2 = async function FindMany2( Criteria, Projection, Sort, MaxCount, Options ) 
		{
			let results = await Storage.MemoryStorage.FindMany2( Criteria, Projection, Sort, MaxCount, Options );
			return results;
		};


		//=====================================================================
		// UpdateOne
		//=====================================================================


		Storage.UpdateOne = async function UpdateOne( Criteria, Update, Options ) 
		{
			let results = await Storage.MemoryStorage.UpdateOne( Criteria, Update, Options );
			if ( Storage.MemoryStorage.IsDirty )
			{
				if ( Settings.AutoFlush ) { write_storage(); }
				Storage.MemoryStorage.IsDirty = false;
			}
			return results;
		};


		//=====================================================================
		// UpdateMany
		//=====================================================================


		Storage.UpdateMany = async function UpdateMany( Criteria, Update, Options ) 
		{
			let results = await Storage.MemoryStorage.UpdateMany( Criteria, Update, Options );
			if ( Storage.MemoryStorage.IsDirty )
			{
				if ( Settings.AutoFlush ) { write_storage(); }
				Storage.MemoryStorage.IsDirty = false;
			}
			return results;
		};


		//=====================================================================
		// ReplaceOne
		//=====================================================================


		Storage.ReplaceOne = async function ReplaceOne( Criteria, Document, Options ) 
		{
			let results = await Storage.MemoryStorage.ReplaceOne( Criteria, Document, Options );
			if ( Storage.MemoryStorage.IsDirty )
			{
				if ( Settings.AutoFlush ) { write_storage(); }
				Storage.MemoryStorage.IsDirty = false;
			}
			return results;
		};


		//=====================================================================
		// DeleteOne
		//=====================================================================


		Storage.DeleteOne = async function DeleteOne( Criteria, Options ) 
		{
			let results = await Storage.MemoryStorage.DeleteOne( Criteria, Options );
			if ( Storage.MemoryStorage.IsDirty )
			{
				if ( Settings.AutoFlush ) { write_storage(); }
				Storage.MemoryStorage.IsDirty = false;
			}
			return results;
		};


		//=====================================================================
		// DeleteMany
		//=====================================================================


		Storage.DeleteMany = async function DeleteMany( Criteria, Options ) 
		{
			let results = await Storage.MemoryStorage.DeleteMany( Criteria, Options );
			if ( Storage.MemoryStorage.IsDirty )
			{
				if ( Settings.AutoFlush ) { write_storage(); }
				Storage.MemoryStorage.IsDirty = false;
			}
			return results;
		};


		//=====================================================================
		return Storage;
	},

};


