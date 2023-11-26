'use strict';

const LIB_UUID = require( 'uuid' );

const jsongin = require( '@liquicode/jsongin' )();
// const jsonstor = require( '../jsonstor' )();

module.exports = {

	AdapterName: 'jsonstor-memory',
	AdapterDescription: 'Documents are stored in memory and are not persisted to disk.',

	GetAdapter: function ( jsonstor, Settings )
	{


		//=====================================================================
		/*
			Settings = {}
		*/
		let Storage = jsonstor.StorageInterface();
		Storage.Settings = Settings;
		Storage.store = [];
		Storage.is_dirty = false;


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
						Storage.store = [];
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
			return new Promise(
				async ( resolve, reject ) =>
				{
					try
					{
						if ( jsongin.ShortType( Options ) !== 'o' ) { Options = {}; }
						let st_Criteria = jsongin.ShortType( Criteria );
						if ( !'olu'.includes( st_Criteria ) ) { throw new Error( `Criteria must be an object, null, or undefined.` ); }
						let count = 0;
						if ( 'lu'.includes( st_Criteria ) || ( Object.keys( Criteria ).length === 0 ) ) // null, undefined, or empty criteria
						{
							count = Storage.store.length;
						}
						else
						{
							for ( let index = 0; index < Storage.store.length; index++ )
							{
								let test_document = Storage.store[ index ];
								if ( jsongin.Query( test_document, Criteria ) )
								{
									count++;
								}
							}
						}
						resolve( count );
					}
					catch ( error )
					{
						reject( error );
					}
					return;
				} );
		};


		//=====================================================================
		// InsertOne
		//=====================================================================


		Storage.InsertOne = async function ( Document, Options ) 
		{
			return new Promise(
				async ( resolve, reject ) =>
				{
					try
					{
						if ( jsongin.ShortType( Options ) !== 'o' ) { Options = {}; }
						if ( jsongin.ShortType( Document ) !== 'o' ) { throw new Error( `Document must be an object.` ); }
						let document = jsongin.Clone( Document );
						if ( typeof document._id === 'undefined' ) { document._id = LIB_UUID.v4(); }
						Storage.store.push( document );
						Storage.is_dirty = true;
						if ( Options.ReturnDocuments )
						{
							resolve( document );
						}
						else
						{
							resolve( 1 );
						}
					}
					catch ( error )
					{
						reject( error );
					}
					return;
				} );
		};


		//=====================================================================
		// InsertMany
		//=====================================================================


		Storage.InsertMany = async function ( Documents, Options ) 
		{
			return new Promise(
				async ( resolve, reject ) =>
				{
					try
					{
						if ( jsongin.ShortType( Options ) !== 'o' ) { Options = {}; }
						if ( jsongin.ShortType( Documents ) !== 'a' ) { throw new Error( `Documents must be an array of objects.` ); }
						let modified_count = 0;
						let modified = [];
						for ( let index = 0; index < Documents.length; index++ )
						{
							let document = jsongin.Clone( Documents[ index ] );
							if ( typeof document._id === 'undefined' ) { document._id = LIB_UUID.v4(); }
							Storage.store.push( document );
							modified_count++;
							if ( Options.ReturnDocuments ) { modified.push( document ); }
							Storage.is_dirty = true;
						}
						if ( Options.ReturnDocuments )
						{
							resolve( modified );
						}
						else
						{
							resolve( modified_count );
						}
					}
					catch ( error )
					{
						reject( error );
					}
					return;
				} );
		};


		//=====================================================================
		// FindOne
		//=====================================================================


		Storage.FindOne = async function FindOne( Criteria, Projection, Options ) 
		{
			return new Promise(
				async ( resolve, reject ) =>
				{
					try
					{
						if ( jsongin.ShortType( Options ) !== 'o' ) { Options = {}; }
						let st_Criteria = jsongin.ShortType( Criteria );
						if ( !'olu'.includes( st_Criteria ) ) { throw new Error( `Criteria must be an object, null, or undefined.` ); }
						let document = null;
						if ( 'lu'.includes( st_Criteria ) || ( Object.keys( Criteria ).length === 0 ) ) // null, undefined, or empty criteria
						{
							if ( Storage.store.length > 0 )
							{
								document = Storage.store[ 0 ];
								document = jsongin.Project( document, Projection );
							}
						}
						else
						{
							for ( let index = 0; index < Storage.store.length; index++ )
							{
								let test_document = Storage.store[ index ];
								if ( jsongin.Query( test_document, Criteria ) )
								{
									document = jsongin.Project( test_document, Projection );
									break;
								}
							}
						}
						resolve( document );
					}
					catch ( error )
					{
						reject( error );
					}
					return;
				} );
		};


		//=====================================================================
		// FindMany
		//=====================================================================


		Storage.FindMany = async function FindMany( Criteria, Projection, Options ) 
		{
			return new Promise(
				async ( resolve, reject ) =>
				{
					try
					{
						if ( jsongin.ShortType( Options ) !== 'o' ) { Options = {}; }
						let st_Criteria = jsongin.ShortType( Criteria );
						if ( !'olu'.includes( st_Criteria ) ) { throw new Error( `Criteria must be an object, null, or undefined.` ); }
						let documents = [];
						for ( let index = 0; index < Storage.store.length; index++ )
						{
							let test_document = Storage.store[ index ];
							if ( 'lu'.includes( st_Criteria )
								|| ( Object.keys( Criteria ).length === 0 )
								|| jsongin.Query( test_document, Criteria )
							)
							{
								test_document = jsongin.Project( test_document, Projection );
								documents.push( test_document );
							}
						}
						resolve( documents );
					}
					catch ( error )
					{
						reject( error );
					}
					return;
				} );
		};


		//=====================================================================
		// UpdateOne
		//=====================================================================


		Storage.UpdateOne = async function UpdateOne( Criteria, Updates, Options ) 
		{
			return new Promise(
				async ( resolve, reject ) =>
				{
					try
					{
						if ( jsongin.ShortType( Options ) !== 'o' ) { Options = {}; }
						let st_Criteria = jsongin.ShortType( Criteria );
						if ( !'olu'.includes( st_Criteria ) ) { throw new Error( `Criteria must be an object, null, or undefined.` ); }
						let modified_count = 0;
						let modified = null;
						if ( 'lu'.includes( st_Criteria ) || ( Object.keys( Criteria ).length === 0 ) ) // null, undefined, or empty criteria
						{
							if ( Storage.store.length > 0 )
							{
								modified = Storage.store[ 0 ];
								modified = jsongin.Update( modified, Updates );
								Storage.store[ 0 ] = modified;
								modified_count++;
								Storage.is_dirty = true;
							}
						}
						else
						{
							for ( let index = 0; index < Storage.store.length; index++ )
							{
								let test_document = Storage.store[ index ];
								if ( jsongin.Query( test_document, Criteria ) )
								{
									modified = jsongin.Update( test_document, Updates );
									Storage.store[ index ] = modified;
									modified_count++;
									Storage.is_dirty = true;
									break;
								}
							}
						}
						if ( Options.ReturnDocuments )
						{
							resolve( modified );
						}
						else
						{
							resolve( modified_count );
						}
					}
					catch ( error )
					{
						reject( error );
					}
					return;
				} );
		};


		//=====================================================================
		// UpdateMany
		//=====================================================================


		Storage.UpdateMany = async function UpdateMany( Criteria, Updates, Options ) 
		{
			return new Promise(
				async ( resolve, reject ) =>
				{
					try
					{
						if ( jsongin.ShortType( Options ) !== 'o' ) { Options = {}; }
						let st_Criteria = jsongin.ShortType( Criteria );
						if ( !'olu'.includes( st_Criteria ) ) { throw new Error( `Criteria must be an object, null, or undefined.` ); }
						let modified_count = 0;
						let modified = [];
						for ( let index = 0; index < Storage.store.length; index++ )
						{
							let document = Storage.store[ index ];
							if ( 'lu'.includes( st_Criteria )
								|| ( Object.keys( Criteria ).length === 0 )
								|| jsongin.Query( document, Criteria )
							)
							{
								document = jsongin.Update( document, Updates );
								Storage.store[ index ] = document;
								modified_count++;
								if ( Options.ReturnDocuments ) { modified.push( document ); }
								Storage.is_dirty = true;
							}
						}
						if ( Options.ReturnDocuments )
						{
							resolve( modified );
						}
						else
						{
							resolve( modified_count );
						}
					}
					catch ( error )
					{
						reject( error );
					}
					return;
				} );
		};


		//=====================================================================
		// ReplaceOne
		//=====================================================================


		Storage.ReplaceOne = async function ReplaceOne( Criteria, Document, Options ) 
		{
			return new Promise(
				async ( resolve, reject ) =>
				{
					try
					{
						if ( jsongin.ShortType( Options ) !== 'o' ) { Options = {}; }
						if ( jsongin.ShortType( Criteria ) !== 'o' ) { throw new Error( `Criteria must be an object.` ); }
						if ( jsongin.ShortType( Document ) !== 'o' ) { throw new Error( 'Document must be an object.' ); }
						// if ( jsongin.ShortType( Document._id ) === 'u' ) { throw new Error( `Document must contain an _id field.` ); }
						let modified_count = 0;
						let modified = null;
						for ( let index = 0; index < Storage.store.length; index++ )
						{
							let document = Storage.store[ index ];
							if ( jsongin.Query( document, Criteria ) )
							{
								modified = jsongin.Clone( Document );
								Storage.store[ index ] = modified;
								modified_count++;
								Storage.is_dirty = true;
								break;
							}
						}
						if ( Options.ReturnDocuments )
						{
							resolve( modified );
						}
						else
						{
							resolve( modified_count );
						}
					}
					catch ( error )
					{
						reject( error );
					}
					return;
				} );
		};


		//=====================================================================
		// DeleteOne
		//=====================================================================


		Storage.DeleteOne = async function DeleteOne( Criteria, Options ) 
		{
			return new Promise(
				async ( resolve, reject ) =>
				{
					try
					{
						if ( jsongin.ShortType( Options ) !== 'o' ) { Options = {}; }
						let st_Criteria = jsongin.ShortType( Criteria );
						if ( !'olu'.includes( st_Criteria ) ) { throw new Error( `Criteria must be an object, null, or undefined.` ); }
						let modified_count = 0;
						let modified = null;
						if ( 'lu'.includes( st_Criteria )
							|| ( Object.keys( Criteria ).length === 0 ) ) // null, undefined, or empty criteria
						{
							if ( Storage.store.length > 0 )
							{
								modified = Storage.store[ 0 ];
								Storage.store.splice( 0, 1 );
								modified_count++;
								Storage.is_dirty = true;
							}
						}
						else
						{
							for ( let index = 0; index < Storage.store.length; index++ )
							{
								let test_document = Storage.store[ index ];
								if ( jsongin.Query( test_document, Criteria ) )
								{
									modified = test_document;
									Storage.store.splice( index, 1 );
									modified_count++;
									Storage.is_dirty = true;
									break;
								}
							}
						}
						if ( Options.ReturnDocuments )
						{
							resolve( modified );
						}
						else
						{
							resolve( modified_count );
						}
					}
					catch ( error )
					{
						reject( error );
					}
					return;
				} );
		};


		//=====================================================================
		// DeleteMany
		//=====================================================================


		Storage.DeleteMany = async function DeleteMany( Criteria, Options ) 
		{
			return new Promise(
				async ( resolve, reject ) =>
				{
					try
					{
						if ( jsongin.ShortType( Options ) !== 'o' ) { Options = {}; }
						let st_Criteria = jsongin.ShortType( Criteria );
						if ( !'olu'.includes( st_Criteria ) ) { throw new Error( `Criteria must be an object, null, or undefined.` ); }
						let modified_count = 0;
						let modified = [];
						for ( let index = 0; index < Storage.store.length; /* index++ */ )
						{
							let document = Storage.store[ index ];
							if ( 'lu'.includes( st_Criteria )
								|| ( Object.keys( Criteria ).length === 0 )
								|| jsongin.Query( document, Criteria )
							)
							{
								Storage.store.splice( index, 1 );
								modified_count++;
								if ( Options.ReturnDocuments ) { modified.push( document ); }
								Storage.is_dirty = true;
							}
							else
							{
								index++;
							}
						}
						if ( Options.ReturnDocuments )
						{
							resolve( modified );
						}
						else
						{
							resolve( modified_count );
						}
					}
					catch ( error )
					{
						reject( error );
					}
					return;
				} );
		};


		//=====================================================================
		return Storage;
	},

};


