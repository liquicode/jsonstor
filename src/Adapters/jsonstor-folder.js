'use strict';

const LIB_FS = require( 'fs' );
const LIB_PATH = require( 'path' );
const NewUniqueID = require( '../jsonstor/NewUniqueID' );

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

		//=====================================================================
		// What the two stages did, for a storage which has no first stage.
		//
		// ***This adapter pushes nothing down, and that is the measurement.*** There is no
		// server to ask and no clause to build, so every document is handed to jsongin and the
		// criteria is the residual entire. Reporting it makes that comparable with an adapter
		// which does push down: PushdownRows reads the same way everywhere - how many rows the
		// second stage had to look at.
		//
		// Scanned is the size of the collection rather than the number of documents actually
		// examined, because a read which stops early stopped by luck rather than by a clause.
		// A no-op unless the caller asked for statistics.
		function report_scan( Options, Criteria, Scanned, Matched )
		{
			jsonstor.ReportStatistics( Options, {
				Translator: '',
				Pushdown: null,
				PushdownRows: Scanned,
				Residual: ( jsongin.ShortType( Criteria ) === 'o' ) ? Criteria : {},
				ResidualRows: Matched,
			} );
			return;
		}

		Storage.Settings = Settings;


		//=====================================================================
		function get_json_file_list()
		{
			if ( !LIB_FS.existsSync( Settings.Path ) )
			{
				return [];
			}
			let files = LIB_FS.readdirSync( Settings.Path );
			files = files.filter( function ( e ) { return LIB_PATH.extname( e ).toLowerCase() === '.json'; } );
			// This listing is the collection's natural order. readdirSync returns entries in
			// whatever order the filesystem holds them, which is not guaranteed to be any
			// order at all, so it is sorted here rather than trusted.
			files.sort();
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
			// The file name carries the document's position in the natural order, so every
			// component is padded to a fixed width. A variable width nanosecond field sorts
			// lexicographically in a different order than it was written in - '9000000' lands
			// after '564003000' - which made the order documents came back in depend on which
			// nanosecond each one happened to be written in.
			let hr_time = process.hrtime();
			let milliseconds = String( ( new Date() ).getTime() ).padStart( 14, '0' );
			let hr_seconds = String( hr_time[ 0 ] ).padStart( 10, '0' );
			let hr_nanoseconds = String( hr_time[ 1 ] ).padStart( 9, '0' );
			let filename = LIB_PATH.join( Settings.Path, `${milliseconds}.${hr_seconds}.${hr_nanoseconds}.json` );
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
				async function ( resolve, reject )
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
				async function ( resolve, reject )
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
				async function ( resolve, reject )
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
						report_scan( Options, Criteria, json_files.length, count );
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
				async function ( resolve, reject )
				{
					try
					{
						if ( jsongin.ShortType( Options ) !== 'o' ) { Options = {}; }
						if ( jsongin.ShortType( Document ) !== 'o' ) { throw new Error( `Document must be an object.` ); }
						let document = jsongin.Clone( Document );
						if ( typeof document._id === 'undefined' ) { document._id = NewUniqueID(); }
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
				async function ( resolve, reject )
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
							if ( typeof document._id === 'undefined' ) { document._id = NewUniqueID(); }
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
				async function ( resolve, reject )
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
						report_scan( Options, Criteria, json_files.length, document ? 1 : 0 );
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
				async function ( resolve, reject )
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
						report_scan( Options, Criteria, json_files.length, documents.length );
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
				async function ( resolve, reject )
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
						if ( Sort ) { documents = jsongin.Sort( documents, Sort ); }
						if ( MaxCount && ( MaxCount > 0 ) && ( documents.length >= MaxCount ) ) { documents = documents.splice( 0, MaxCount ); }
						report_scan( Options, Criteria, json_files.length, documents.length );
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
				async function ( resolve, reject )
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
				async function ( resolve, reject )
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
				async function ( resolve, reject )
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
				async function ( resolve, reject )
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
				async function ( resolve, reject )
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


