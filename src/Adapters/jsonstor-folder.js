'use strict';

const LIB_FS = require( 'fs' );
const LIB_PATH = require( 'path' );
const LIB_UUID = require( 'uuid' );

const jsongin = require( '@liquicode/jsongin' );
// const jsonstor = require( '../jsonstor' )();

module.exports = {

	AdapterName: 'jsonstor-folder',
	AdapterDescription: 'Each document is stored in its own file in a single folder.',

	GetAdapter: function ( jsonstor, Settings )
	{


		//=====================================================================
		/*
			Settings = {
				Path: '', // Path to the folder storing the json files. If the folder doesn't exist, it will be created.
			}
		*/
		if ( jsongin.ShortType( Settings ) !== 'o' ) { throw new Error( `This adapter requires a Settings parameter.` ); }
		if ( jsongin.ShortType( Settings.Path ) !== 's' ) { throw new Error( `This adapter requires a Settings.Path string parameter.` ); }


		//=====================================================================
		let Storage = jsonstor.StorageInterface();
		Storage.Settings = Settings;


		//=====================================================================
		function get_json_file_list()
		{
			if ( !LIB_FS.existsSync( Settings.Path ) )
			{
				return [];
			}
			let files = LIB_FS.readdirSync( Settings.Path );
			files = files.filter( ( e ) => { return LIB_PATH.extname( e ).toLowerCase() === '.json'; } );
			return files;
		}


		//=====================================================================
		function read_document( Filename )
		{
			let filename = LIB_PATH.join( Settings.Path, Filename );
			if ( !LIB_FS.existsSync( filename ) ) 
			{
				return null;
			}
			let json = LIB_FS.readFileSync( filename, 'utf8' );
			let document = JSON.parse( json );
			return document;
		}


		//=====================================================================
		function insert_document( Document )
		{
			if ( !LIB_FS.existsSync( Settings.Path ) )
			{
				LIB_FS.mkdirSync( Settings.Path, { recursive: true } );
			}
			// let filename = LIB_PATH.join( Settings.Path, `${( new Date() ).getTime()}.json` );
			let hr_time = process.hrtime();
			let filename = LIB_PATH.join( Settings.Path, `${( new Date() ).getTime()}.${hr_time[ 0 ]}.${hr_time[ 1 ]}.json` );
			let json = JSON.stringify( Document );
			LIB_FS.writeFileSync( filename, json, 'utf8' );
			return;
		}


		//=====================================================================
		function update_document( Document, Filename )
		{
			if ( !LIB_FS.existsSync( Settings.Path ) ) { return; }
			let filename = LIB_PATH.join( Settings.Path, Filename );
			let json = JSON.stringify( Document );
			LIB_FS.writeFileSync( filename, json, 'utf8' );
			return;
		}


		//=====================================================================
		function remove_document( Filename )
		{
			if ( !LIB_FS.existsSync( Settings.Path ) ) { return; }
			let filename = LIB_PATH.join( Settings.Path, Filename );
			if ( !LIB_FS.existsSync( filename ) ) { return; }
			LIB_FS.unlinkSync( filename );
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
						if ( LIB_FS.existsSync( Settings.Path ) )
						{
							// LIB_FS.rmdirSync( Settings.Path, { recursive: true, force: true } );
							if ( process.version >= 'v14.14.0' )
							{
								LIB_FS.rmSync( Settings.Path, { recursive: true, force: true } );
							}
							else
							{
								LIB_FS.rmdirSync( Settings.Path, { recursive: true, force: true } );
							}
						}
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
						let json_files = get_json_file_list();
						if ( 'lu'.includes( st_Criteria ) || ( Object.keys( Criteria ).length === 0 ) ) // null, undefined, or empty criteria
						{
							count = json_files.length;
						}
						else
						{
							for ( let index = 0; index < json_files.length; index++ )
							{
								let test_document = read_document( json_files[ index ] );
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
						insert_document( document );
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
							let document = Documents[ index ];
							document = jsongin.Clone( document );
							if ( typeof document._id === 'undefined' ) { document._id = LIB_UUID.v4(); }
							insert_document( document );
							modified_count++;
							if ( Options.ReturnDocuments ) { modified.push( document ); }
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
						let json_files = get_json_file_list();
						if ( 'lu'.includes( st_Criteria ) || ( Object.keys( Criteria ).length === 0 ) ) // null, undefined, or empty criteria
						{
							if ( json_files.length > 0 )
							{
								document = read_document( json_files[ 0 ] );
								document = jsongin.Project( document, Projection );
							}
						}
						else
						{
							for ( let index = 0; index < json_files.length; index++ )
							{
								let test_document = read_document( json_files[ index ] );
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
						let json_files = get_json_file_list();
						for ( let index = 0; index < json_files.length; index++ )
						{
							let document = read_document( json_files[ index ] );
							if ( 'lu'.includes( st_Criteria )
								|| ( Object.keys( Criteria ).length === 0 )
								|| jsongin.Query( document, Criteria )
							)
							{
								document = jsongin.Project( document, Projection );
								documents.push( document );
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
		// FindMany2
		//=====================================================================


		Storage.FindMany2 = async function FindMany2( Criteria, Projection, Sort, MaxCount, Options ) 
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
						let json_files = get_json_file_list();
						for ( let index = 0; index < json_files.length; index++ )
						{
							let document = read_document( json_files[ index ] );
							if ( 'lu'.includes( st_Criteria )
								|| ( Object.keys( Criteria ).length === 0 )
								|| jsongin.Query( document, Criteria )
							)
							{
								document = jsongin.Project( document, Projection );
								documents.push( document );
							}
							if ( MaxCount && ( MaxCount > 0 ) && ( documents.length >= MaxCount ) ) { break; }
						}
						if ( Sort ) { documents = jsongin.Sort( documents, Sort ); }
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
						let json_files = get_json_file_list();
						if ( 'lu'.includes( st_Criteria ) || ( Object.keys( Criteria ).length === 0 ) ) // null, undefined, or empty criteria
						{
							if ( json_files.length > 0 )
							{
								modified = read_document( json_files[ 0 ] );
								modified = jsongin.Update( modified, Updates );
								update_document( modified, json_files[ 0 ] );
								modified_count++;
							}
						}
						else
						{
							for ( let index = 0; index < json_files.length; index++ )
							{
								let test_document = read_document( json_files[ index ] );
								if ( jsongin.Query( test_document, Criteria ) )
								{
									modified = jsongin.Update( test_document, Updates );
									update_document( modified, json_files[ index ] );
									modified_count++;
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
						let json_files = get_json_file_list();
						for ( let index = 0; index < json_files.length; index++ )
						{
							let document = read_document( json_files[ index ] );
							if ( 'lu'.includes( st_Criteria )
								|| ( Object.keys( Criteria ).length === 0 )
								|| jsongin.Query( document, Criteria )
							)
							{
								document = jsongin.Update( document, Updates );
								update_document( document, json_files[ index ] );
								modified_count++;
								if ( Options.ReturnDocuments ) { modified.push( document ); }
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
						if ( jsongin.ShortType( Document ) !== 'o' ) { throw new Error( `Document must be an object.` ); }
						if ( jsongin.ShortType( Document._id ) === 'u' ) { throw new Error( `Document must contain an _id field.` ); }
						let modified_count = 0;
						let modified = null;
						let json_files = get_json_file_list();
						for ( let index = 0; index < json_files.length; index++ )
						{
							let document = read_document( json_files[ index ] );
							if ( jsongin.Query( document, Criteria ) )
							{
								modified = jsongin.Clone( Document );
								update_document( modified, json_files[ index ] );
								modified_count++;
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
						let json_files = get_json_file_list();
						if ( 'lu'.includes( st_Criteria ) || ( Object.keys( Criteria ).length === 0 ) ) // null, undefined, or empty criteria
						{
							if ( json_files.length > 0 )
							{
								modified = read_document( json_files[ 0 ] );
								remove_document( json_files[ 0 ] );
								modified_count++;
							}
						}
						else
						{
							for ( let index = 0; index < json_files.length; index++ )
							{
								let test_document = read_document( json_files[ index ] );
								if ( jsongin.Query( test_document, Criteria ) )
								{
									modified = test_document;
									remove_document( json_files[ index ] );
									modified_count++;
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
						let json_files = get_json_file_list();
						for ( let index = 0; index < json_files.length; index++ )
						{
							let document = read_document( json_files[ index ] );
							if ( 'lu'.includes( st_Criteria )
								|| ( Object.keys( Criteria ).length === 0 )
								|| jsongin.Query( document, Criteria )
							)
							{
								remove_document( json_files[ index ] );
								modified_count++;
								if ( Options.ReturnDocuments ) { modified.push( document ); }
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


