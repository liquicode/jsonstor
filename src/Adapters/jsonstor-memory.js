'use strict';

const NewUniqueID = require( '../jsonstor/NewUniqueID' );
const PrimaryKey = require( '../jsonstor/PrimaryKey' )();

const jsongin = require( '@liquicode/jsongin' );
// const jsonstor = require( '../jsonstor' )();

module.exports = {

	AdapterName: 'jsonstor-memory',
	AdapterDescription: 'Documents are stored in memory and are not persisted to disk.',

	GetAdapter: function ( jsonstor, Settings )
	{


		//=====================================================================
		/*
			Settings = {
				PrimaryKey,          the field which is the identifier. Default '_id'.
				PrimaryKeyMutable,   may an update or a replace change it. Default false.
				HostIndex,           hold an index over it. Default false.
			}
		*/
		let Storage = jsonstor.StorageInterface();
		Storage.Settings = Settings;
		Storage.Store = [];
		Storage.IsDirty = false;


		//=====================================================================
		// The key, resolved.
		//
		// ***The default is applied here rather than in PrimaryKey.Resolve***, because an omitted
		// declaration means different things to different adapters: a SQL adapter discovers its
		// key from the catalog and this one has no catalog to discover from. Same shape as
		// jsonstor-sqlite's `Settings.IdField || DEFAULT_ID_FIELD`.
		let key_declaration = PrimaryKey.Resolve( Storage.Settings );
		if ( key_declaration.Fields.length > 1 )
		{
			// ***Declared, not built.*** Every by-key statement in this family locates a document
			// by a single value, so an adapter which cannot honor a composite key refuses it with
			// the reason stated rather than silently keying on the first field.
			throw new Error( `[${module.exports.AdapterName}] does not support a composite PrimaryKey: [${key_declaration.Fields.join( ', ' )}].` );
		}
		if ( key_declaration.Fields.length === 0 ) { key_declaration.Fields = [ PrimaryKey.DEFAULT_FIELD ]; }

		Storage.PrimaryKeyInfo = {
			Fields: key_declaration.Fields,
			// ***Inert here, and that is worth saying.*** PrimaryKeyType describes what the
			// *medium's* key column holds, so that a medium which can only key on a string still
			// carries the true typed value in a payload. This store holds real documents, so
			// there is no second place for the key to live and no coercion to declare.
			Types: [],
			Mutable: key_declaration.Mutable,
			// jsonstor mints the identifier when a document arrives without one, and here
			// jsonstor is the store.
			Generated: true,
			IndexHostedBy: key_declaration.HostIndex ? 'jsonstor' : 'none',
		};

		// ***Uniqueness is enforced whether or not there is an index.*** Without one it costs a
		// scan per insert, on an adapter which is already a scan per query. A primary key a
		// caller cannot rely on is not one.
		let Index = key_declaration.HostIndex ? PrimaryKey.NewIndex() : null;


		//=====================================================================
		// What the two stages did, for a storage which has no first stage.
		//
		// ***This adapter pushes nothing down unless it holds an index, and that is the
		// measurement.*** With no index there is no clause to build, so every document is handed
		// to jsongin and the criteria is the residual entire. Reporting it makes that comparable
		// with an adapter which does push down: PushdownRows reads the same way everywhere - how
		// many rows the second stage had to look at.
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
		// What the index did.
		//
		// ***An index is a pushdown for an adapter with no server to push down to***, so it
		// reports in the same pair of numbers a WHERE clause does. PushdownRows is one or zero
		// rather than the size of the collection, and that difference is the whole assertion:
		// an index which is never entered reports the collection and looks exactly like no index
		// at all. See jsonx/.plans/primary-keys-and-indexes.md.
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


		//=====================================================================
		// The encoded key of a document, or null when it carries none.
		function document_key( Document )
		{
			return PrimaryKey.DocumentKey( Document, Storage.PrimaryKeyInfo.Fields );
		}


		//=====================================================================
		// The documents an index can answer a criteria with, or null to ask the scan.
		//
		// ***Null and an empty array are different answers.*** Null means the index declined and
		// the caller must scan; an empty array means the index answered and there is nothing
		// there. Collapsing the two is how an index starts reporting a miss as a match.
		function index_candidates( Criteria )
		{
			if ( !Index ) { return null; }
			let key = PrimaryKey.CriteriaKey( Criteria, Storage.PrimaryKeyInfo.Fields );
			if ( key === null ) { return null; }
			let document = Index.Lookup( key );
			if ( typeof document === 'undefined' )
			{
				// Either the key is not there, or the collection holds a non-scalar key and the
				// index has withdrawn. Has() separates them: it answers the first honestly and
				// the second is the case which must fall through to the scan.
				if ( Index.HasComplexKey ) { return null; }
				return [];
			}
			return [ document ];
		}


		//=====================================================================
		// Refuses a key which is already in the collection.
		//
		// Except names the document allowed to hold it, for an update or a replace which is
		// rewriting the document that key already belongs to.
		function require_unique( Key, Except, PreviousKey )
		{
			if ( Key === null ) { return; }
			// ***A key which did not move cannot collide with anything it did not already
			// collide with.*** Free here and not free at all in jsonstor-folder, where the same
			// scan reopens every file in the collection - so the rule lives in both adapters
			// rather than in the one where it happened to be measured.
			if ( ( arguments.length > 2 ) && ( Key === PreviousKey ) ) { return; }
			if ( Index )
			{
				let found = Index.Entries.get( Key );
				if ( typeof found === 'undefined' ) { return; }
				if ( found === Except ) { return; }
				throw new Error( `A document with this primary key already exists: ${ Key }.` );
			}
			for ( let index = 0; index < Storage.Store.length; index++ )
			{
				let test_document = Storage.Store[ index ];
				if ( test_document === Except ) { continue; }
				if ( document_key( test_document ) !== Key ) { continue; }
				throw new Error( `A document with this primary key already exists: ${ Key }.` );
			}
			return;
		}


		//=====================================================================
		// Refuses an update or a replace which moved the key.
		//
		// ***The three behaviors this replaces were all defensible and none of them agreed.***
		// Five SQL adapters accepted a $set on the identifier and silently discarded it, seven
		// adapters honored it, and MongoDB refuses. Refusing is the only one of the three which
		// cannot mislead a caller. See jsonx/.plans/primary-keys-and-indexes.md.
		function check_key_move( Before, After )
		{
			if ( Storage.PrimaryKeyInfo.Mutable ) { return; }
			if ( Before === After ) { return; }
			throw new Error( `The primary key [${Storage.PrimaryKeyInfo.Fields[ 0 ]}] is not mutable, and this operation would change it from [${Before}] to [${After}].` );
		}


		//=====================================================================
		// Files a document under its key. The locator is the document itself, which is stable
		// across the splices an array store does and an array position is not.
		function index_add( Document )
		{
			if ( !Index ) { return; }
			let value = PrimaryKey.DocumentValue( Document, Storage.PrimaryKeyInfo.Fields );
			if ( value === null ) { return; }
			Index.Add( PrimaryKey.EncodeValue( value ), Document, value );
			return;
		}


		//=====================================================================
		function index_remove( Document )
		{
			if ( !Index ) { return; }
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
		// DropStorage
		//=====================================================================


		// ***What this storage is actually talking to.*** An in-process adapter reports the
		// version of whatever implements it, which here is the engine every one of these
		// adapters is built on. Uniform, so no caller has to special-case a storage with no
		// server to ask.
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


		// ***Rebuilds the index from a full scan, and answers how many entries it filed.***
		// A no-op answering 0 where this storage holds no index. Nothing else writes an in
		// memory store, so this is here for uniformity and for the adapters built on it -
		// jsonstor-jsonfile and jsonstor-excel re-read their file and then rebuild.
		//
		// ***The synchronous half is not decoration.*** jsonstor-jsonfile and jsonstor-excel
		// replace Storage.Store wholesale from a constructor and from a synchronous read_storage,
		// where there is nothing to await into. An index built by a promise nobody waits for is
		// an index which is empty exactly as often as the event loop says, which is the kind of
		// fact that passes a test suite and fails in a program.
		Storage.RebuildIndex = function ()
		{
			if ( !Index ) { return 0; }
			Index.Clear();
			for ( let index = 0; index < Storage.Store.length; index++ )
			{
				let document = Storage.Store[ index ];
				let value = PrimaryKey.DocumentValue( document, Storage.PrimaryKeyInfo.Fields );
				if ( value === null ) { continue; }
				let key = PrimaryKey.EncodeValue( value );
				// ***A rebuild reports what it found rather than refusing it.*** A store written
				// by something else may already hold a duplicate, and throwing here would leave
				// the storage unusable with no way to look at what is wrong with it.
				if ( Index.Has( key ) ) { continue; }
				Index.Add( key, document, value );
			}
			return Index.Size();
		};


		Storage.RefreshIndex = async function ( Options )
		{
			return Storage.RebuildIndex();
		};


		Storage.DropStorage = async function ( Options )
		{
			return new Promise(
				async function ( resolve, reject )
				{
					try
					{
						Storage.Store = [];
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
							count = Storage.Store.length;
							report_scan( Options, Criteria, Storage.Store.length, count );
							resolve( count );
							return;
						}
						let candidates = index_candidates( Criteria );
						if ( candidates !== null )
						{
							for ( let index = 0; index < candidates.length; index++ )
							{
								if ( jsongin.Query( candidates[ index ], Criteria ) ) { count++; }
							}
							report_lookup( Options, Criteria, candidates.length, count );
							resolve( count );
							return;
						}
						for ( let index = 0; index < Storage.Store.length; index++ )
						{
							let test_document = Storage.Store[ index ];
							if ( jsongin.Query( test_document, Criteria ) )
							{
								count++;
							}
						}
						report_scan( Options, Criteria, Storage.Store.length, count );
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
						Storage.Store.push( document );
						index_add( document );
						Storage.IsDirty = true;
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
						// transaction here and there is nothing to roll back to, so the documents
						// already written stay written - which is what a non-transactional store
						// does and what MongoDB's own unordered insert reports.
						for ( let index = 0; index < Documents.length; index++ )
						{
							let document = jsongin.Clone( Documents[ index ] );
							apply_new_key( document );
							require_unique( document_key( document ), null );
							Storage.Store.push( document );
							index_add( document );
							modified_count++;
							if ( Options.ReturnDocuments ) { modified.push( document ); }
							Storage.IsDirty = true;
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
							if ( Storage.Store.length > 0 )
							{
								document = Storage.Store[ 0 ];
								document = jsongin.Project( document, Projection );
							}
							report_scan( Options, Criteria, Storage.Store.length, document ? 1 : 0 );
							resolve( document );
							return;
						}
						let candidates = index_candidates( Criteria );
						if ( candidates !== null )
						{
							for ( let index = 0; index < candidates.length; index++ )
							{
								if ( !jsongin.Query( candidates[ index ], Criteria ) ) { continue; }
								document = jsongin.Project( candidates[ index ], Projection );
								break;
							}
							report_lookup( Options, Criteria, candidates.length, document ? 1 : 0 );
							resolve( document );
							return;
						}
						for ( let index = 0; index < Storage.Store.length; index++ )
						{
							let test_document = Storage.Store[ index ];
							if ( jsongin.Query( test_document, Criteria ) )
							{
								document = jsongin.Project( test_document, Projection );
								break;
							}
						}
						report_scan( Options, Criteria, Storage.Store.length, document ? 1 : 0 );
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
								if ( !jsongin.Query( candidates[ index ], Criteria ) ) { continue; }
								documents.push( jsongin.Project( candidates[ index ], Projection ) );
							}
							report_lookup( Options, Criteria, candidates.length, documents.length );
							resolve( documents );
							return;
						}
						for ( let index = 0; index < Storage.Store.length; index++ )
						{
							let test_document = Storage.Store[ index ];
							if ( 'lu'.includes( st_Criteria )
								|| ( Object.keys( Criteria ).length === 0 )
								|| jsongin.Query( test_document, Criteria )
							)
							{
								test_document = jsongin.Project( test_document, Projection );
								documents.push( test_document );
							}
						}
						report_scan( Options, Criteria, Storage.Store.length, documents.length );
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
								if ( !jsongin.Query( candidates[ index ], Criteria ) ) { continue; }
								documents.push( jsongin.Project( candidates[ index ], Projection ) );
							}
							report_lookup( Options, Criteria, candidates.length, documents.length );
						}
						else
						{
							for ( let index = 0; index < Storage.Store.length; index++ )
							{
								let test_document = Storage.Store[ index ];
								if ( 'lu'.includes( st_Criteria )
									|| ( Object.keys( Criteria ).length === 0 )
									|| jsongin.Query( test_document, Criteria )
								)
								{
									test_document = jsongin.Project( test_document, Projection );
									documents.push( test_document );
								}
							}
							report_scan( Options, Criteria, Storage.Store.length, documents.length );
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


		// ***An update rewrites the document in place, so the index entry follows it.***
		// jsongin.Update answers a new object rather than mutating the one it was given, which is
		// why the old entry is removed by its old key and the new one filed by its new one.
		function apply_update( Position, Document, Updates )
		{
			let before = document_key( Document );
			let updated = jsongin.Update( Document, Updates );
			let after = document_key( updated );
			check_key_move( before, after );
			require_unique( after, Document, before );
			index_remove( Document );
			Storage.Store[ Position ] = updated;
			index_add( updated );
			Storage.IsDirty = true;
			return updated;
		}


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
						if ( 'lu'.includes( st_Criteria ) || ( Object.keys( Criteria ).length === 0 ) ) // null, undefined, or empty criteria
						{
							if ( Storage.Store.length > 0 )
							{
								modified = apply_update( 0, Storage.Store[ 0 ], Updates );
								modified_count++;
							}
						}
						else
						{
							for ( let index = 0; index < Storage.Store.length; index++ )
							{
								let test_document = Storage.Store[ index ];
								if ( jsongin.Query( test_document, Criteria ) )
								{
									modified = apply_update( index, test_document, Updates );
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
						for ( let index = 0; index < Storage.Store.length; index++ )
						{
							let document = Storage.Store[ index ];
							if ( 'lu'.includes( st_Criteria )
								|| ( Object.keys( Criteria ).length === 0 )
								|| jsongin.Query( document, Criteria )
							)
							{
								document = apply_update( index, document, Updates );
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
						if ( jsongin.ShortType( Criteria ) !== 'o' ) { throw new Error( `Criteria must be an object.` ); }
						if ( jsongin.ShortType( Document ) !== 'o' ) { throw new Error( 'Document must be an object.' ); }
						let modified_count = 0;
						let modified = null;
						let key_field = Storage.PrimaryKeyInfo.Fields[ 0 ];
						for ( let index = 0; index < Storage.Store.length; index++ )
						{
							let document = Storage.Store[ index ];
							if ( jsongin.Query( document, Criteria ) )
							{
								modified = jsongin.Clone( Document );
								// ***A replacement with no primary key carries the matched
								// document's key over.*** This closed a three way split - four
								// adapters threw, three changed the key, six kept it - and the
								// guide's own documented example is the shape which diverged.
								// See jsonx/.plans/primary-keys-and-indexes.md.
								if ( typeof jsongin.GetValue( modified, key_field ) === 'undefined' )
								{
									let carried = jsongin.GetValue( document, key_field );
									if ( typeof carried !== 'undefined' ) { jsongin.SetValue( modified, key_field, carried ); }
								}
								let before = document_key( document );
								let after = document_key( modified );
								check_key_move( before, after );
								require_unique( after, document, before );
								index_remove( document );
								Storage.Store[ index ] = modified;
								index_add( modified );
								modified_count++;
								Storage.IsDirty = true;
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
						if ( 'lu'.includes( st_Criteria )
							|| ( Object.keys( Criteria ).length === 0 ) ) // null, undefined, or empty criteria
						{
							if ( Storage.Store.length > 0 )
							{
								modified = Storage.Store[ 0 ];
								Storage.Store.splice( 0, 1 );
								index_remove( modified );
								modified_count++;
								Storage.IsDirty = true;
							}
						}
						else
						{
							for ( let index = 0; index < Storage.Store.length; index++ )
							{
								let test_document = Storage.Store[ index ];
								if ( jsongin.Query( test_document, Criteria ) )
								{
									modified = test_document;
									Storage.Store.splice( index, 1 );
									index_remove( modified );
									modified_count++;
									Storage.IsDirty = true;
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
						for ( let index = 0; index < Storage.Store.length; /* index++ */ )
						{
							let document = Storage.Store[ index ];
							if ( 'lu'.includes( st_Criteria )
								|| ( Object.keys( Criteria ).length === 0 )
								|| jsongin.Query( document, Criteria )
							)
							{
								Storage.Store.splice( index, 1 );
								index_remove( document );
								modified_count++;
								if ( Options.ReturnDocuments ) { modified.push( document ); }
								Storage.IsDirty = true;
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

