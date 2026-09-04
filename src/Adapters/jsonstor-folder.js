'use strict';

const LIB_FS = require( 'fs' );
const LIB_PATH = require( 'path' );
const NewUniqueID = require( '../jsonstor/NewUniqueID' );
const PrimaryKey = require( '../jsonstor/PrimaryKey' )();

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
				PrimaryKey: '_id',   // the field which is the identifier.
				PrimaryKeyMutable: false,
				HostIndex: false,    // hold an index over the key, keyed to the file name.
			}
		*/
		if ( jsongin.ShortType( Settings ) !== 'o' ) { throw new Error( `This adapter requires a Settings parameter.` ); }
		if ( jsongin.ShortType( Settings.Path ) !== 's' ) { throw new Error( `This adapter requires a Settings.Path string parameter.` ); }


		//=====================================================================
		let Storage = jsonstor.StorageInterface();


		//=====================================================================
		// The key, resolved. See jsonstor-memory for why the default is applied here rather than
		// inside PrimaryKey.Resolve.
		let key_declaration = PrimaryKey.Resolve( Settings );
		if ( key_declaration.Fields.length > 1 )
		{
			throw new Error( `[${module.exports.AdapterName}] does not support a composite PrimaryKey: [${key_declaration.Fields.join( ', ' )}].` );
		}
		if ( key_declaration.Fields.length === 0 ) { key_declaration.Fields = [ PrimaryKey.DEFAULT_FIELD ]; }

		Storage.PrimaryKeyInfo = {
			Fields: key_declaration.Fields,
			// Inert here: a document file holds the whole document, so there is no separate
			// medium key which would need a declared type. The file name carries insertion order
			// and never the identifier.
			Types: [],
			Mutable: key_declaration.Mutable,
			Generated: true,
			IndexHostedBy: key_declaration.HostIndex ? 'jsonstor' : 'none',
		};

		// ***This is the built-in where HostIndex earns its keep, and the only one.***
		// jsonstor-memory owns its store outright and jsonstor-jsonfile re-reads its whole file,
		// so neither can hold an index which disagrees with the documents beside it. This adapter
		// reads each file fresh on every query, which is exactly what makes it usable against a
		// folder something else writes - and exactly what makes a cached index there a promise
		// this adapter cannot keep on its own. RefreshIndex is that promise's escape hatch.
		let Index = key_declaration.HostIndex ? PrimaryKey.NewIndex() : null;


		//=====================================================================
		// What the two stages did, for a storage which has no first stage.
		//
		// ***This adapter pushes nothing down unless it holds an index, and that is the
		// measurement.*** There is no server to ask and no clause to build, so every document is
		// handed to jsongin and the criteria is the residual entire. Reporting it makes that
		// comparable with an adapter which does push down: PushdownRows reads the same way
		// everywhere - how many rows the second stage had to look at.
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


		//=====================================================================
		// What the index did. ***PushdownRows here is a count of files opened***, which is the
		// cost this adapter actually pays and the number the index exists to move.
		function report_lookup( Options, Criteria, Scanned, Matched )
		{
			jsonstor.ReportStatistics( Options, {
				Translator: '',
				Pushdown: Criteria,
				PushdownRows: Scanned,
				Residual: {},
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
		// ***Answers the file name it wrote***, so the caller can file it in the index. The name
		// is the document's position in the natural order and is never its identifier.
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
			let basename = `${milliseconds}.${hr_seconds}.${hr_nanoseconds}.json`;
			let filename = LIB_PATH.join( Settings.Path, basename );
			let json = JSON.stringify( Document );
			LIB_FS.writeFileSync( filename, json, 'utf8' );
			return basename;
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
		// The encoded key of a document, or null when it carries none.
		function document_key( Document )
		{
			return PrimaryKey.DocumentKey( Document, Storage.PrimaryKeyInfo.Fields );
		}


		//=====================================================================
		// Rebuilds the index by opening every file in the folder.
		function rebuild_index()
		{
			if ( !Index ) { return 0; }
			Index.Clear();
			let json_files = get_json_file_list();
			for ( let index = 0; index < json_files.length; index++ )
			{
				let document = read_document( json_files[ index ] );
				if ( document === null ) { continue; }
				let value = PrimaryKey.DocumentValue( document, Storage.PrimaryKeyInfo.Fields );
				if ( value === null ) { continue; }
				let key = PrimaryKey.EncodeValue( value );
				// ***A rebuild reports what it found rather than refusing it.*** A folder written
				// by something else may already hold a duplicate, and throwing here would leave
				// the storage unusable with no way to look at what is wrong with it.
				if ( Index.Has( key ) ) { continue; }
				Index.Add( key, json_files[ index ], value );
			}
			return Index.Size();
		}

		if ( Index ) { rebuild_index(); }


		//=====================================================================
		// The file names an index can answer a criteria with, or null to ask the scan.
		//
		// ***Null and an empty array are different answers.*** Null means the index declined and
		// the caller must scan; an empty array means the index answered and there is nothing
		// there. Collapsing the two is how an index starts reporting a miss as a match.
		function index_candidates( Criteria )
		{
			if ( !Index ) { return null; }
			let key = PrimaryKey.CriteriaKey( Criteria, Storage.PrimaryKeyInfo.Fields );
			if ( key === null ) { return null; }
			let filename = Index.Lookup( key );
			if ( typeof filename === 'undefined' )
			{
				if ( Index.HasComplexKey ) { return null; }
				return [];
			}
			return [ filename ];
		}


		//=====================================================================
		// Refuses a key which is already in the collection.
		//
		// ***Without an index this opens every file, which is what a query here already does.***
		// That is the cost HostIndex buys back, and it is stated in this adapter's notes rather
		// than left for a caller to discover with a profiler.
		function require_unique( Key, ExceptFilename, PreviousKey )
		{
			if ( Key === null ) { return; }
			// ***A key which did not move cannot collide with anything it did not already
			// collide with.*** Without this, every replace of an unindexed folder reopens the
			// whole collection to prove a document still has the identifier it arrived with -
			// 100 replaces over 100 documents is 10,000 file reads, which is how this was found.
			if ( ( arguments.length > 2 ) && ( Key === PreviousKey ) ) { return; }
			if ( Index )
			{
				let found = Index.Entries.get( Key );
				if ( typeof found === 'undefined' ) { return; }
				if ( found === ExceptFilename ) { return; }
				throw new Error( `A document with this primary key already exists: ${ Key }.` );
			}
			let json_files = get_json_file_list();
			for ( let index = 0; index < json_files.length; index++ )
			{
				if ( json_files[ index ] === ExceptFilename ) { continue; }
				let test_document = read_document( json_files[ index ] );
				if ( test_document === null ) { continue; }
				if ( document_key( test_document ) !== Key ) { continue; }
				throw new Error( `A document with this primary key already exists: ${ Key }.` );
			}
			return;
		}


		//=====================================================================
		// Refuses an update or a replace which moved the key. See jsonstor-memory for why
		// refusing is the only one of the three measured behaviors which cannot mislead.
		function check_key_move( Before, After )
		{
			if ( Storage.PrimaryKeyInfo.Mutable ) { return; }
			if ( Before === After ) { return; }
			throw new Error( `The primary key [${Storage.PrimaryKeyInfo.Fields[ 0 ]}] is not mutable, and this operation would change it from [${Before}] to [${After}].` );
		}


		//=====================================================================
		function index_add( Document, Filename )
		{
			if ( !Index ) { return; }
			let value = PrimaryKey.DocumentValue( Document, Storage.PrimaryKeyInfo.Fields );
			if ( value === null ) { return; }
			Index.Add( PrimaryKey.EncodeValue( value ), Filename, value );
			return;
		}


		//=====================================================================
		function index_remove( Document )
		{
			if ( !Index ) { return; }
			if ( Document === null ) { return; }
			Index.Remove( document_key( Document ) );
			return;
		}


		//=====================================================================
		// Mints an identifier for a document which arrived without one.
		function apply_new_key( Document )
		{
			let field = Storage.PrimaryKeyInfo.Fields[ 0 ];
			let value = jsongin.GetValue( Document, field );
			if ( typeof value !== 'undefined' ) { return; }
			jsongin.SetValue( Document, field, NewUniqueID() );
			return;
		}


		//=====================================================================
		// Rewrites a document in place and moves its index entry with it.
		function apply_update( Filename, Document, Updates )
		{
			let before = document_key( Document );
			let updated = jsongin.Update( Document, Updates );
			let after = document_key( updated );
			check_key_move( before, after );
			require_unique( after, Filename, before );
			index_remove( Document );
			update_document( updated, Filename );
			index_add( updated, Filename );
			return updated;
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


		// ***Rebuilds the index by opening every file, and answers how many entries it filed.***
		// A no-op answering 0 where this storage holds no index.
		//
		// This is the escape hatch for the case this adapter exists to serve: a folder something
		// else writes. An index built when the storage opened does not return wrong rows if that
		// happens, ***it loses them silently***, which is the failure shape the family keeps
		// meeting - SQLite's missing backslash escape and PostgREST's TEXT cast answering 0 rows
		// with HTTP 200 are the same shape one layer down.
		Storage.RefreshIndex = async function ( Options )
		{
			return rebuild_index();
		};


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
						if ( Index ) { Index.Clear(); }
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
						if ( 'lu'.includes( st_Criteria ) || ( Object.keys( Criteria ).length === 0 ) ) // null, undefined, or empty criteria
						{
							let json_files = get_json_file_list();
							count = json_files.length;
							report_scan( Options, Criteria, json_files.length, count );
							resolve( count );
							return;
						}
						let candidates = index_candidates( Criteria );
						if ( candidates !== null )
						{
							for ( let index = 0; index < candidates.length; index++ )
							{
								let test_document = read_document( candidates[ index ] );
								if ( jsongin.Query( test_document, Criteria ) ) { count++; }
							}
							report_lookup( Options, Criteria, candidates.length, count );
							resolve( count );
							return;
						}
						let json_files = get_json_file_list();
						for ( let index = 0; index < json_files.length; index++ )
						{
							let test_document = read_document( json_files[ index ] );
							if ( jsongin.Query( test_document, Criteria ) )
							{
								count++;
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
						apply_new_key( document );
						require_unique( document_key( document ), null );
						let basename = insert_document( document );
						index_add( document, basename );
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
						// ***A duplicate stops the insert where it stands.*** There is no
						// transaction here and nothing to roll back to, so the files already
						// written stay written.
						for ( let index = 0; index < Documents.length; index++ )
						{
							let document = Documents[ index ];
							document = jsongin.Clone( document );
							apply_new_key( document );
							require_unique( document_key( document ), null );
							let basename = insert_document( document );
							index_add( document, basename );
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
						if ( 'lu'.includes( st_Criteria ) || ( Object.keys( Criteria ).length === 0 ) ) // null, undefined, or empty criteria
						{
							let json_files = get_json_file_list();
							if ( json_files.length > 0 )
							{
								document = read_document( json_files[ 0 ] );
								document = jsongin.Project( document, Projection );
							}
							report_scan( Options, Criteria, json_files.length, document ? 1 : 0 );
							resolve( document );
							return;
						}
						let candidates = index_candidates( Criteria );
						if ( candidates !== null )
						{
							for ( let index = 0; index < candidates.length; index++ )
							{
								let test_document = read_document( candidates[ index ] );
								if ( !jsongin.Query( test_document, Criteria ) ) { continue; }
								document = jsongin.Project( test_document, Projection );
								break;
							}
							report_lookup( Options, Criteria, candidates.length, document ? 1 : 0 );
							resolve( document );
							return;
						}
						let json_files = get_json_file_list();
						for ( let index = 0; index < json_files.length; index++ )
						{
							let test_document = read_document( json_files[ index ] );
							if ( jsongin.Query( test_document, Criteria ) )
							{
								document = jsongin.Project( test_document, Projection );
								break;
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
						let candidates = index_candidates( Criteria );
						if ( candidates !== null )
						{
							for ( let index = 0; index < candidates.length; index++ )
							{
								let document = read_document( candidates[ index ] );
								if ( !jsongin.Query( document, Criteria ) ) { continue; }
								documents.push( jsongin.Project( document, Projection ) );
							}
							report_lookup( Options, Criteria, candidates.length, documents.length );
							resolve( documents );
							return;
						}
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
						let candidates = index_candidates( Criteria );
						if ( candidates !== null )
						{
							for ( let index = 0; index < candidates.length; index++ )
							{
								let document = read_document( candidates[ index ] );
								if ( !jsongin.Query( document, Criteria ) ) { continue; }
								documents.push( jsongin.Project( document, Projection ) );
							}
							report_lookup( Options, Criteria, candidates.length, documents.length );
						}
						else
						{
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
						}
						if ( Sort ) { documents = jsongin.Sort( documents, Sort ); }
						if ( MaxCount && ( MaxCount > 0 ) && ( documents.length >= MaxCount ) ) { documents = documents.splice( 0, MaxCount ); }
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
								let document = read_document( json_files[ 0 ] );
								modified = apply_update( json_files[ 0 ], document, Updates );
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
									modified = apply_update( json_files[ index ], test_document, Updates );
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
								document = apply_update( json_files[ index ], document, Updates );
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
						let modified_count = 0;
						let modified = null;
						let key_field = Storage.PrimaryKeyInfo.Fields[ 0 ];
						let json_files = get_json_file_list();
						for ( let index = 0; index < json_files.length; index++ )
						{
							let document = read_document( json_files[ index ] );
							if ( jsongin.Query( document, Criteria ) )
							{
								modified = jsongin.Clone( Document );
								// ***A replacement with no primary key carries the matched
								// document's key over.*** This adapter used to throw here, which
								// was one of three behaviors across the family - four adapters
								// threw, three changed the key, six kept it - and the guide's own
								// documented example is the shape which threw.
								// See jsonx/.plans/primary-keys-and-indexes.md.
								if ( typeof jsongin.GetValue( modified, key_field ) === 'undefined' )
								{
									let carried = jsongin.GetValue( document, key_field );
									if ( typeof carried !== 'undefined' ) { jsongin.SetValue( modified, key_field, carried ); }
								}
								let before = document_key( document );
								let after = document_key( modified );
								check_key_move( before, after );
								require_unique( after, json_files[ index ], before );
								index_remove( document );
								update_document( modified, json_files[ index ] );
								index_add( modified, json_files[ index ] );
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
								index_remove( modified );
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
									index_remove( modified );
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
								index_remove( document );
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
