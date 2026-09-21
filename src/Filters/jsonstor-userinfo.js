"use strict";


const NewUniqueID = require( '../jsonstor/NewUniqueID' );

const jsongin = require( '@liquicode/jsongin' );
// const jsonstor = require( '../jsonstor' )();


module.exports = {

	FilterName: 'jsonstor-userinfo',
	FilterDescription: 'Adds user ownership and document sharing to an existing storage.',

	GetFilter: function ( jsonstor, Storage, Settings )
	{

		//=====================================================================
		/*
			Settings = {
				UserInfoField: '_user',
				AdminRoles: [ 'admin', 'super' ],
				ThrowPermissionErrors: false,
				HideUserInfo: false,
				HideDocumentID: false,
			}
		*/
		if ( jsongin.ShortType( Storage ) !== 'o' ) { throw new Error( `jsonstor-userinfo requires a Storage object parameter.` ); }
		if ( jsongin.ShortType( Settings ) !== 'o' ) { throw new Error( `jsonstor-userinfo requires a Settings object parameter.` ); }
		if ( jsongin.ShortType( Settings.UserInfoField ) !== 's' ) { Settings.UserInfoField = 'userinfo'; }
		if ( jsongin.ShortType( Settings.AdminRoles ) !== 'a' ) { Settings.AdminRoles = [ 'admin', 'super' ]; }
		if ( jsongin.ShortType( Settings.ThrowPermissionErrors ) !== 'b' ) { Settings.ThrowPermissionErrors = false; }
		if ( jsongin.ShortType( Settings.HideUserInfo ) !== 'b' ) { Settings.HideUserInfo = false; }
		if ( jsongin.ShortType( Settings.HideDocumentID ) !== 'b' ) { Settings.HideDocumentID = false; }


		//=====================================================================
		let Filter = jsonstor.StorageInterface();
		Filter.Settings = Settings;
		Filter.Storage = Storage;


		//=====================================================================
		// Storage Administrators
		//=====================================================================

		Filter.Administrator = {
			name: 'Storage Administrator',
			user_id: 'admin@storage',
			user_role: 'admin',
		};

		Filter.Supervisor = {
			name: 'Storage Supervisor',
			user_id: 'super@storage',
			user_role: 'super',
		};


		//=====================================================================
		//=====================================================================
		//
		//		Internal Functions
		//
		//=====================================================================
		//=====================================================================


		//---------------------------------------------------------------------
		function PARAMETER_ERROR( Name, Type ) { return new Error( `The required parameter is missing: [${Name}] of type [${Type}].` ); };
		function READ_ACCESS_ERROR() { return new Error( `User does not have read access to this object or the object does not exist.` ); };
		function WRITE_ACCESS_ERROR() { return new Error( `User does not have write access to this object.` ); };
		function SHARE_ACCESS_ERROR() { return new Error( `User does not have permission to change the ownership or sharing of this object.` ); };


		//---------------------------------------------------------------------
		// What a write answers when it was refused or matched nothing: the count or the document
		// the interface promises, not a null in place of a count.
		function nothing_written( Options )
		{
			if ( Options.ReturnDocuments ) { return null; }
			return 0;
		};


		//---------------------------------------------------------------------
		// ***Whether an update writes to the user info sub-document.***
		//
		// Ownership and sharing are the owner's and an admin's to change, and a writer may change
		// only the document. Without this a writer could `$set` themselves the owner, or edit the
		// readers, writers and public flag, through an ordinary update (2026-09-13).
		function updates_user_info( Updates )
		{
			let prefix = Settings.UserInfoField + '.';
			function names_user_info( Name )
			{
				if ( jsongin.ShortType( Name ) !== 's' ) { return false; }
				return ( Name === Settings.UserInfoField ) || Name.startsWith( prefix );
			}
			let operators = Object.keys( Updates );
			for ( let index = 0; index < operators.length; index++ )
			{
				let operator = operators[ index ];
				let operands = Updates[ operator ];
				if ( jsongin.ShortType( operands ) !== 'o' ) { continue; }
				let fields = Object.keys( operands );
				for ( let field_index = 0; field_index < fields.length; field_index++ )
				{
					let field = fields[ field_index ];
					if ( names_user_info( field ) ) { return true; }
					// $rename names its destination as the value.
					if ( ( operator === '$rename' ) && names_user_info( operands[ field ] ) ) { return true; }
				}
			}
			return false;
		};


		//---------------------------------------------------------------------
		function zulu_timestamp()
		{
			return ( new Date() ).toISOString();
		};


		//---------------------------------------------------------------------
		function add_to_set( Set, Values )
		{
			let modified = false;
			for ( let index = 0; index < Values.length; index++ )
			{
				let value = Values[ index ];
				if ( !Set.includes( value ) )	
				{
					Set.push( value );
					modified = true;
				}
			}
			return modified;
		}


		//---------------------------------------------------------------------
		function remove_from_set( Set, Values )
		{
			let modified = false;
			for ( let index = ( Set.length - 1 ); index >= 0; index-- )
			{
				let value = Set[ index ];
				if ( !Values.includes( value ) )	
				{
					Set.splice( index, 1 );
					modified = true;
				}
			}
			return modified;
		}


		//---------------------------------------------------------------------
		function new_user_info( User ) 
		{
			if ( jsongin.ShortType( User ) !== 'o' ) { throw PARAMETER_ERROR( 'User', 'object' ); }
			if ( jsongin.ShortType( User.user_id ) !== 's' ) { throw PARAMETER_ERROR( 'User.user_id', 'string' ); }
			let user_info = {
				id: NewUniqueID(),
				created_at: zulu_timestamp(),
				updated_at: zulu_timestamp(),
				owner_id: User.user_id,
				readers: [],
				writers: [],
				public: false,
			};
			return user_info;
		};


		//---------------------------------------------------------------------
		function get_storage_options( Options ) 
		{
			if ( jsongin.ShortType( Options ) !== 'o' ) { Options = {}; }
			let storage_options = JSON.parse( JSON.stringify( Options ) );
			storage_options.ReturnDocuments = true;
			// delete storage_options.User;
			if ( jsongin.ShortType( storage_options.User ) !== 'o' ) { throw PARAMETER_ERROR( 'Options.User', 'object' ); }
			return storage_options;
		};


		//---------------------------------------------------------------------
		function clean_document( Document ) 
		{
			if ( Settings.HideUserInfo ) { delete Document[ Settings.UserInfoField ]; }
			if ( Settings.HideDocumentID ) { delete Document._id; }
			return;
		};


		//=====================================================================
		// DropStorage
		//=====================================================================


		Filter.DropStorage =
			async function DropStorage( Options )
			{
				return new Promise(
					async function ( resolve, reject )
					{
						try
						{
							let result = await Storage.DropStorage( get_storage_options( Options ) );
							resolve( result );
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


		Filter.FlushStorage =
			async function FlushStorage( Options )
			{
				return new Promise(
					async function ( resolve, reject )
					{
						try
						{
							let result = await Storage.FlushStorage( get_storage_options( Options ) );
							resolve( result );
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
		// StorageInfo
		//---------------------------------------------------------------------
		// Reports what the underlying storage is talking to.
		//=====================================================================


		// ***The two which ask about the storage rather than about the documents in it, and
		// neither of them takes a user.***
		//
		// ***This list had stopped at twelve and nothing was watching.*** StorageInfo was never
		// forwarded here or in jsonstor-oplog, so a storage with either filter in front of it
		// answered `StorageInfo is not implemented` - the stub, reached because the filter never
		// replaced it. Invisible because no test puts a filter in front of that call. Measured
		// 2026-09-04, while adding the fourteenth. See jsonx/.plans/primary-keys-and-indexes.md.
		//
		// ***get_storage_options is deliberately not used.*** It demands an Options.User, which
		// is the right question of a call that reads or writes a document and the wrong one of a
		// call that asks which server this is - and D) Engine Contract Tests asks StorageInfo()
		// with no arguments at all. Neither call can leak a document, because neither returns
		// one: RefreshIndex rebuilds the storage's own index, which every later read still
		// reaches through this filter's permission criteria.
		Filter.StorageInfo =
			async function StorageInfo( Options )
			{
				return await Storage.StorageInfo( Options );
			};


		Filter.RefreshIndex =
			async function RefreshIndex( Options )
			{
				return await Storage.RefreshIndex( Options );
			};


		//=====================================================================
		// FindMany2
		//---------------------------------------------------------------------
		// Returns the documents specified by Criteria, sorted and limited.
		// Only documents that allow the user read or write access are returned.
		//=====================================================================


		// ***Absent until now, and not merely unforwarded - it was not a function at all.***
		// The permission criteria goes in the same slot it goes in for FindMany, so the page
		// is taken over the documents this user may see rather than over the collection and then
		// filtering, which would return fewer documents than asked for and look like a shortage.
		Filter.FindMany2 =
			async function FindMany2( Criteria, Projection, Sort, Paging, Options )
			{
				return new Promise(
					async function ( resolve, reject )
					{
						try
						{
							if ( jsongin.ShortType( Options ) !== 'o' ) { throw PARAMETER_ERROR( 'Options', 'object' ); }
							if ( jsongin.ShortType( Options.User ) !== 'o' ) { throw PARAMETER_ERROR( 'Options.User', 'object' ); }
							let storage_options = JSON.parse( JSON.stringify( Options ) );
							storage_options.ReturnDocuments = true;
							let criteria = Filter.User( storage_options ).Criteria( Criteria );
							let documents = await Storage.FindMany2( criteria, Projection, Sort, Paging, storage_options );
							documents.forEach( function ( document ) { clean_document( document ); } );
							resolve( documents );
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
		//---------------------------------------------------------------------
		// Returns the number of objects specified by Criteria.
		// Only objects that allow the user read or write access are counted.
		//=====================================================================


		Filter.Count =
			async function Count( Criteria, Options )
			{
				return new Promise(
					async function ( resolve, reject )
					{
						try
						{
							if ( jsongin.ShortType( Options ) !== 'o' ) { throw PARAMETER_ERROR( 'Options', 'object' ); }
							if ( jsongin.ShortType( Options.User ) !== 'o' ) { throw PARAMETER_ERROR( 'Options.User', 'object' ); }
							let storage_options = JSON.parse( JSON.stringify( Options ) );
							storage_options.ReturnDocuments = true;
							// let User = Options.User;
							let criteria = Filter.User( storage_options ).Criteria( Criteria );
							let count = await Storage.Count( criteria, storage_options );
							resolve( count );
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
		// InsertOne
		//---------------------------------------------------------------------
		// Inserts a single document into the storage.
		// Inserted documents will be owned by the user.
		//=====================================================================


		Filter.InsertOne =
			async function InsertOne( Document, Options )
			{
				return new Promise(
					async function ( resolve, reject )
					{
						try
						{
							if ( jsongin.ShortType( Document ) !== 'o' ) { throw PARAMETER_ERROR( 'Document', 'object' ); }
							if ( jsongin.ShortType( Options ) !== 'o' ) { throw PARAMETER_ERROR( 'Options', 'object' ); }
							if ( jsongin.ShortType( Options.User ) !== 'o' ) { throw PARAMETER_ERROR( 'Options.User', 'object' ); }
							let storage_options = JSON.parse( JSON.stringify( Options ) );
							storage_options.ReturnDocuments = true;
							// let User = Options.User;
							let user_info = new_user_info( storage_options.User );
							let document = jsongin.Clone( Document );
							document[ Settings.UserInfoField ] = user_info;
							let modified = await Storage.InsertOne( document, storage_options );
							if ( Options.ReturnDocuments )
							{
								clean_document( modified );
								resolve( modified );
								return;
							}
							else
							{
								resolve( 1 );
								return;
							}
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
		// InsertMany
		//---------------------------------------------------------------------
		// Inserts an array of documents into the storage.
		// Inserted documents will be owned by the user.
		//=====================================================================


		Filter.InsertMany =
			async function InsertMany( Documents, Options )
			{
				return new Promise(
					async function ( resolve, reject )
					{
						try
						{
							if ( jsongin.ShortType( Documents ) !== 'a' ) { throw PARAMETER_ERROR( 'Documents', 'array' ); }
							if ( jsongin.ShortType( Options ) !== 'o' ) { throw PARAMETER_ERROR( 'Options', 'object' ); }
							if ( jsongin.ShortType( Options.User ) !== 'o' ) { throw PARAMETER_ERROR( 'Options.User', 'object' ); }
							let storage_options = JSON.parse( JSON.stringify( Options ) );
							storage_options.ReturnDocuments = true;
							// let User = Options.User;
							let user_info = new_user_info( storage_options.User );
							let modified = [];
							for ( let index = 0; index < Documents.length; index++ )
							{
								let document = jsongin.Clone( Documents[ index ] );
								document[ Settings.UserInfoField ] = user_info;
								modified.push( document );
							}
							modified = await Storage.InsertMany( modified, storage_options );
							if ( Options.ReturnDocuments )
							{
								modified.forEach( function ( document ) { clean_document( document ); } );
								resolve( modified );
								return;
							}
							else
							{
								resolve( modified.length );
								return;
							}
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
		// FindOne
		//---------------------------------------------------------------------
		// Finds a single object.
		// If multiple objects are found, then the first one is returned.
		// Only objects that permit the user read or write access are returned.
		//=====================================================================


		Filter.FindOne =
			async function FindOne( Criteria, Projection, Options )
			{
				return new Promise(
					async function ( resolve, reject )
					{
						try
						{
							if ( jsongin.ShortType( Options ) !== 'o' ) { throw PARAMETER_ERROR( 'Options', 'object' ); }
							if ( jsongin.ShortType( Options.User ) !== 'o' ) { throw PARAMETER_ERROR( 'Options.User', 'object' ); }
							let storage_options = JSON.parse( JSON.stringify( Options ) );
							storage_options.ReturnDocuments = true;
							let criteria = Filter.User( storage_options ).Criteria( Criteria );
							let document = await Storage.FindOne( criteria, Projection, storage_options );
							if ( document ) { clean_document( document ); }
							resolve( document );
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
		// FindMany
		//---------------------------------------------------------------------
		// Finds a number of objects.
		// Only objects that permit the user read or write access are returned.
		//=====================================================================


		Filter.FindMany =
			async function FindMany( Criteria, Projection, Options )
			{
				return new Promise(
					async function ( resolve, reject )
					{
						try
						{
							if ( jsongin.ShortType( Options ) !== 'o' ) { throw PARAMETER_ERROR( 'Options', 'object' ); }
							if ( jsongin.ShortType( Options.User ) !== 'o' ) { throw PARAMETER_ERROR( 'Options.User', 'object' ); }
							let storage_options = JSON.parse( JSON.stringify( Options ) );
							storage_options.ReturnDocuments = true;
							let criteria = Filter.User( storage_options ).Criteria( Criteria );
							let documents = await Storage.FindMany( criteria, Projection, storage_options );
							documents.forEach( function ( document ) { clean_document( document ); } );
							resolve( documents );
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
		// ***Whether the caller's own update, or replacement, would change the document.***
		//
		// A storage answers what an update changed, not what it matched, and leaves a document
		// alone when the update leaves it as it was (jsonx/.plans/update-answers-changed.md).
		// This filter stamps `updated_at` into every write it passes down, so a storage under it
		// always saw a change: a document set to the value it held was rewritten, counted and
		// returned, and its `updated_at` said an update had happened. ***So the filter asks first,
		// leaving its own stamp out of the question*** *(user, 2026-09-19)*, and a write which
		// would change nothing answers as nothing written and is never sent down. An update
		// which touches the user info alone - sharing with a reader - is a change like any other.
		//
		// ***The primary key is left out of the comparison.*** jsongin.Update works on a
		// SafeClone, and SafeClone left a driver value such as MongoDB's ObjectId a broken
		// copy which could be neither compared ("Cannot compare values of type [f]") nor written as
		// JSON - measured 2026-09-19, when the first version of this failed half of this filter's
		// suite on MongoDB and nowhere else. jsongin passes a BSON value through untouched since
		// 2026-09-21, and the key stays out anyway: a key cannot move, so nothing is lost by not
		// asking, and a write which names another key is sent down, where the storage refuses it.
		//
		// ***A document which cannot be compared is treated as changed***, which is what this
		// filter did for every document before: a driver value deeper in a document costs a
		// stamp and a write, never a refusal.
		//=====================================================================


		function without_key( Document )
		{
			let copy = Object.assign( {}, Document );
			delete copy._id;
			return copy;
		};


		function update_names_key( Updates )
		{
			let operators = Object.keys( Updates );
			for ( let index = 0; index < operators.length; index++ )
			{
				let operands = Updates[ operators[ index ] ];
				if ( jsongin.ShortType( operands ) !== 'o' ) { continue; }
				if ( typeof operands._id !== 'undefined' ) { return true; }
			}
			return false;
		};


		function update_changes( Document, Updates )
		{
			// An update which names the key is the storage's to refuse.
			if ( update_names_key( Updates ) ) { return true; }
			let before = without_key( Document );
			let after = jsongin.Update( before, Updates );
			try { return !jsongin.StrictEquals( jsongin.SafeClone( before ), after ); }
			catch ( error ) { return true; }
		};


		function replacement_changes( Document, Replacement )
		{
			if ( ( typeof Replacement._id !== 'undefined' ) && ( String( Replacement._id ) !== String( Document._id ) ) ) { return true; }
			// As the storage will see it: with the stored ownership, whatever the caller sent.
			let candidate = without_key( Replacement );
			candidate[ Settings.UserInfoField ] = Document[ Settings.UserInfoField ];
			try { return !jsongin.StrictEquals( jsongin.SafeClone( without_key( Document ) ), jsongin.SafeClone( candidate ) ); }
			catch ( error ) { return true; }
		};


		//=====================================================================
		// UpdateOne
		//---------------------------------------------------------------------
		// Modifies a single document.
		// User must have write permissions to the updated document.
		//=====================================================================


		Filter.UpdateOne =
			async function UpdateOne( Criteria, Updates, Options )
			{
				return new Promise(
					async function ( resolve, reject )
					{
						try
						{
							if ( jsongin.ShortType( Updates ) !== 'o' ) { Updates = {}; }
							if ( jsongin.ShortType( Options ) !== 'o' ) { throw PARAMETER_ERROR( 'Options', 'object' ); }
							if ( jsongin.ShortType( Options.User ) !== 'o' ) { throw PARAMETER_ERROR( 'Options.User', 'object' ); }
							let storage_options = JSON.parse( JSON.stringify( Options ) );
							storage_options.ReturnDocuments = true;
							let writes_user_info = updates_user_info( Updates );
							// Copied, so the timestamp is not written into the caller's own object. Only
							// the two levels the timestamp touches are copied, since SafeClone broke a driver value
							// such as an ObjectId until jsongin passed BSON values through (2026-09-21).
							let updates = Object.assign( {}, Updates );
							updates.$set = Object.assign( {}, Updates.$set );
							updates.$set[ `${Settings.UserInfoField}.updated_at` ] = zulu_timestamp();
							let criteria = Filter.User( storage_options ).Criteria( Criteria );
							let document = await Storage.FindOne( criteria, null, storage_options );
							let error = null;
							if ( !document ) { error = READ_ACCESS_ERROR(); }
							else if ( !Filter.User( storage_options ).CanWrite( document ) ) { error = WRITE_ACCESS_ERROR(); }
							else if ( writes_user_info && !Filter.User( storage_options ).CanShare( document ) ) { error = SHARE_ACCESS_ERROR(); }
							if ( error )
							{
								if ( Settings.ThrowPermissionErrors ) { throw error; }
								resolve( nothing_written( Options ) );
								return;
							}
							if ( !update_changes( document, Updates ) )
							{
								resolve( nothing_written( Options ) );
								return;
							}
							// ***The answer is the storage's.*** This resolved a 1 whatever came back.
							let modified = await Storage.UpdateOne( criteria, updates, storage_options );
							if ( !modified )
							{
								resolve( nothing_written( Options ) );
								return;
							}
							if ( Options.ReturnDocuments )
							{
								clean_document( modified );
								resolve( modified );
								return;
							}
							else
							{
								resolve( 1 );
								return;
							}
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
		// UpdateMany
		//---------------------------------------------------------------------
		// Modifies multiple documents.
		// User must have write permissions to the updated documents.
		//=====================================================================


		Filter.UpdateMany =
			async function UpdateMany( Criteria, Updates, Options )
			{
				return new Promise(
					async function ( resolve, reject )
					{
						try
						{
							if ( jsongin.ShortType( Updates ) !== 'o' ) { Updates = {}; }
							if ( jsongin.ShortType( Options ) !== 'o' ) { throw PARAMETER_ERROR( 'Options', 'object' ); }
							if ( jsongin.ShortType( Options.User ) !== 'o' ) { throw PARAMETER_ERROR( 'Options.User', 'object' ); }
							let storage_options = JSON.parse( JSON.stringify( Options ) );
							storage_options.ReturnDocuments = true;
							let writes_user_info = updates_user_info( Updates );
							// Copied, so the timestamp is not written into the caller's own object. Only
							// the two levels the timestamp touches are copied, since SafeClone broke a driver value
							// such as an ObjectId until jsongin passed BSON values through (2026-09-21).
							let updates = Object.assign( {}, Updates );
							updates.$set = Object.assign( {}, Updates.$set );
							updates.$set[ `${Settings.UserInfoField}.updated_at` ] = zulu_timestamp();
							let criteria = Filter.User( storage_options ).Criteria( Criteria );
							let modified_ids = await Storage.FindMany( criteria, { _id: 1 }, storage_options );
							let modified = [];
							for ( let index = 0; index < modified_ids.length; index++ )
							{
								let document_id = modified_ids[ index ]._id;
								let document = await Storage.FindOne( { _id: document_id }, null, storage_options );
								let error = null;
								if ( !document ) { error = READ_ACCESS_ERROR(); }
								else if ( !Filter.User( storage_options ).CanWrite( document ) ) { error = WRITE_ACCESS_ERROR(); }
								else if ( writes_user_info && !Filter.User( storage_options ).CanShare( document ) ) { error = SHARE_ACCESS_ERROR(); }
								if ( error )
								{
									if ( Settings.ThrowPermissionErrors ) { throw error; }
									continue;
								}
								if ( !update_changes( document, Updates ) ) { continue; }
								document = await Storage.UpdateOne( { _id: document_id }, updates, storage_options );
								if ( document ) { modified.push( document ); }
							}
							if ( Options.ReturnDocuments )
							{
								modified.forEach( function ( document ) { clean_document( document ); } );
								resolve( modified );
								return;
							}
							else
							{
								resolve( modified.length );
								return;
							}
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
		// ReplaceOne
		//---------------------------------------------------------------------
		// Replaces a single document.
		// User must have read/write access to this document.
		// The new document is owned by the user.
		//=====================================================================


		Filter.ReplaceOne =
			async function ReplaceOne( Criteria, Document, Options )
			{
				return new Promise(
					async function ( resolve, reject )
					{
						try
						{
							if ( jsongin.ShortType( Document ) !== 'o' ) { throw PARAMETER_ERROR( 'Document', 'object' ); }
							if ( jsongin.ShortType( Options ) !== 'o' ) { throw PARAMETER_ERROR( 'Options', 'object' ); }
							if ( jsongin.ShortType( Options.User ) !== 'o' ) { throw PARAMETER_ERROR( 'Options.User', 'object' ); }
							let storage_options = JSON.parse( JSON.stringify( Options ) );
							storage_options.ReturnDocuments = true;
							let criteria = Filter.User( storage_options ).Criteria( Criteria );
							let document = await Storage.FindOne( criteria, null, storage_options );
							let error = null;
							if ( !document ) { error = READ_ACCESS_ERROR(); }
							else if ( !Filter.User( storage_options ).CanWrite( document ) ) { error = WRITE_ACCESS_ERROR(); }
							if ( error )
							{
								if ( Settings.ThrowPermissionErrors ) { throw error; }
								resolve( nothing_written( Options ) );
								return;
							}
							// ***The replacement keeps the ownership the stored document had.*** It used
							// to be passed down as given, so a replacement without the sub-document -
							// the ordinary case - left a document nobody owned and its owner could not
							// find, and a writer could replace the sub-document with one of their own.
							// Ownership and sharing change through Share, SetOwner, or an owner's update.
							//
							// ***A shallow copy.*** SafeClone broke a driver value such as MongoDB's ObjectId
							// until jsongin passed BSON values through (2026-09-21), and a replacement whose _id
							// changed that way was refused by the server as an attempt to alter it.
							if ( !replacement_changes( document, Document ) )
							{
								resolve( nothing_written( Options ) );
								return;
							}
							let replacement = Object.assign( {}, Document );
							replacement[ Settings.UserInfoField ] = jsongin.SafeClone( document[ Settings.UserInfoField ] );
							replacement[ Settings.UserInfoField ].updated_at = zulu_timestamp();
							let modified = await Storage.ReplaceOne( criteria, replacement, storage_options );
							if ( !modified )
							{
								resolve( nothing_written( Options ) );
								return;
							}
							if ( Options.ReturnDocuments )
							{
								clean_document( modified );
								resolve( modified );
								return;
							}
							else
							{
								resolve( 1 );
								return;
							}
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
		// DeleteOne
		//---------------------------------------------------------------------
		// Deletes a single object.
		// User must have write permissions.
		//=====================================================================


		Filter.DeleteOne =
			async function DeleteOne( Criteria, Options )
			{
				return new Promise(
					async function ( resolve, reject )
					{
						try
						{
							if ( jsongin.ShortType( Options ) !== 'o' ) { throw PARAMETER_ERROR( 'Options', 'object' ); }
							if ( jsongin.ShortType( Options.User ) !== 'o' ) { throw PARAMETER_ERROR( 'Options.User', 'object' ); }
							let storage_options = JSON.parse( JSON.stringify( Options ) );
							storage_options.ReturnDocuments = true;
							let criteria = Filter.User( storage_options ).Criteria( Criteria );
							let document = await Storage.FindOne( criteria, null, storage_options );
							let error = null;
							if ( !document ) { error = READ_ACCESS_ERROR(); }
							else if ( !Filter.User( storage_options ).CanWrite( document ) ) { error = WRITE_ACCESS_ERROR(); }
							if ( error )
							{
								if ( Settings.ThrowPermissionErrors ) { throw error; }
								resolve( nothing_written( Options ) );
								return;
							}
							let modified = await Storage.DeleteOne( criteria, storage_options );
							if ( Options.ReturnDocuments )
							{
								clean_document( modified );
								resolve( modified );
								return;
							}
							else
							{
								resolve( 1 );
								return;
							}
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
		// DeleteMany
		//---------------------------------------------------------------------
		// Deletes a number of objects.
		// User must have write permissions.
		//=====================================================================


		Filter.DeleteMany =
			async function DeleteMany( Criteria, Options )
			{
				return new Promise(
					async function ( resolve, reject )
					{
						try
						{
							if ( jsongin.ShortType( Options ) !== 'o' ) { throw PARAMETER_ERROR( 'Options', 'object' ); }
							if ( jsongin.ShortType( Options.User ) !== 'o' ) { throw PARAMETER_ERROR( 'Options.User', 'object' ); }
							let storage_options = JSON.parse( JSON.stringify( Options ) );
							storage_options.ReturnDocuments = true;
							let criteria = Filter.User( storage_options ).Criteria( Criteria );
							let modified_ids = await Storage.FindMany( criteria, { _id: 1 }, storage_options );
							let modified = [];
							for ( let index = 0; index < modified_ids.length; index++ )
							{
								let document_id = modified_ids[ index ]._id;
								let document = await Storage.FindOne( { _id: document_id }, null, storage_options );
								let error = null;
								if ( !document ) { error = READ_ACCESS_ERROR(); }
								else if ( !Filter.User( storage_options ).CanRead( document ) ) { error = READ_ACCESS_ERROR(); }
								else if ( !Filter.User( storage_options ).CanWrite( document ) ) { error = WRITE_ACCESS_ERROR(); }
								if ( error )
								{
									if ( Settings.ThrowPermissionErrors ) { throw error; }
									continue;
								}
								document = await Storage.DeleteOne( { _id: document_id }, storage_options );
								modified.push( document );
							}
							if ( Options.ReturnDocuments )
							{
								modified.forEach( function ( document ) { clean_document( document ); } );
								resolve( modified );
								return;
							}
							else
							{
								resolve( modified.length );
								return;
							}
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
		//=====================================================================


		Filter.User = function ( UserOptions )
		{
			let ThisUser = {};

			//---------------------------------------------------------------------
			if ( jsongin.ShortType( UserOptions ) !== 'o' ) { throw PARAMETER_ERROR( 'UserOptions', 'object' ); }

			//---------------------------------------------------------------------
			let User = UserOptions.User;
			if ( jsongin.ShortType( User ) !== 'o' ) { throw PARAMETER_ERROR( 'UserOptions.User', 'object' ); }
			if ( jsongin.ShortType( User.user_id ) !== 's' ) { throw PARAMETER_ERROR( 'User.user_id', 'string' ); }
			if ( jsongin.ShortType( User.user_role ) !== 's' ) { throw PARAMETER_ERROR( 'User.user_role', 'string' ); }
			// if ( ![ 'admin', 'super', 'user' ].includes( User.user_role ) ) { throw new Error( `Unknown value for User.user_role: [${User.user_role}]` ); }


			// //---------------------------------------------------------------------
			// function get_user_options() 
			// {
			// 	if ( jsongin.ShortType( Options ) !== 'o' ) { Options = {}; }
			// 	let user_options = jsongin.SafeClone( Options );
			// 	user_options.ReturnDocuments = true;
			// 	user_options.User = User;
			// 	return user_options;
			// };

			//---------------------------------------------------------------------
			ThisUser.CanShare = function CanShare( Document )
			{
				// Validate the document.
				// ValidateDocument( Document );
				if ( jsongin.ShortType( Document ) !== 'o' ) { throw PARAMETER_ERROR( 'Document', 'object' ); }
				if ( jsongin.ShortType( Document[ Settings.UserInfoField ] ) !== 'o' ) { throw PARAMETER_ERROR( 'UserInfo', 'object' ); }
				if ( jsongin.ShortType( Document[ Settings.UserInfoField ].id ) !== 's' ) { throw PARAMETER_ERROR( 'UserInfo.id', 'string' ); }
				if ( jsongin.ShortType( Document[ Settings.UserInfoField ].owner_id ) !== 's' ) { throw PARAMETER_ERROR( 'UserInfo.owner_id', 'string' ); }
				if ( jsongin.ShortType( Document[ Settings.UserInfoField ].readers ) !== 'a' ) { throw PARAMETER_ERROR( 'UserInfo.readers', 'array' ); }
				if ( jsongin.ShortType( Document[ Settings.UserInfoField ].writers ) !== 'a' ) { throw PARAMETER_ERROR( 'UserInfo.writers', 'array' ); }
				if ( jsongin.ShortType( Document[ Settings.UserInfoField ].public ) !== 'b' ) { throw PARAMETER_ERROR( 'UserInfo.public', 'boolean' ); }
				// Must be an admin or owner.
				if ( Settings.AdminRoles.includes( User.user_role ) ) { return true; }
				if ( User.user_id === Document[ Settings.UserInfoField ].owner_id ) { return true; }
				// Cannot share.
				return false;
			};


			//---------------------------------------------------------------------
			ThisUser.CanWrite = function CanWrite( Document )
			{
				if ( ThisUser.CanShare( Document ) ) { return true; }
				if ( Document[ Settings.UserInfoField ].writers.includes( User.user_id ) ) { return true; }
				return false;
			};


			//---------------------------------------------------------------------
			ThisUser.CanRead = function CanRead( Document )
			{
				if ( ThisUser.CanWrite( Document ) ) { return true; }
				if ( Document[ Settings.UserInfoField ].readers.includes( User.user_id ) ) { return true; }
				if ( Document[ Settings.UserInfoField ].public ) { return true; }
				return false;
			};


			//---------------------------------------------------------------------
			ThisUser.Criteria = function Criteria( Criteria )
			{

				let st_Criteria = jsongin.ShortType( Criteria );
				if ( !'olu'.includes( st_Criteria ) ) { throw new Error( `Unknown parameter type [${st_Criteria}] for [Criteria]. Must be an object, null, or undefined.` ); }
				if ( 'lu'.includes( st_Criteria ) ) { Criteria = {}; }

				// Construct the query criteria.
				let user_criteria = jsongin.SafeClone( Criteria, [ '_id' ] );

				// //NOTE: Remove this after upgrading to the latest jsongin.
				// if ( typeof Criteria._id !== 'undefined' )
				// {
				// 	// SafeClone mangles the object when { _id: new ObjectId(...) }
				// 	// SafeClone needs a parameter to prevent this i.e. SafeClone( Value, AssginValue[ fieldnames, ...] )
				// 	user_criteria._id = Criteria._id;
				// }

				// Apply role based restrictions on object reading.
				if ( !Settings.AdminRoles.includes( User.user_role ) )
				{
					let expressions = [];
					{
						// Return objects owned by this user.
						let expression = {};
						expression[ Settings.UserInfoField + '.owner_id' ] = User.user_id;
						expressions.push( expression );
					}
					{
						// Return objects shared to this user.
						let expression = {};
						expression[ Settings.UserInfoField + '.readers' ] = { $in: [ User.user_id ] };
						expressions.push( expression );
					}
					{
						// Return objects shared to this user.
						let expression = {};
						expression[ Settings.UserInfoField + '.writers' ] = { $in: [ User.user_id ] };
						expressions.push( expression );
					}
					{
						// Return public objects.
						let expression = {};
						expression[ Settings.UserInfoField + '.public' ] = true;
						expressions.push( expression );
					}

					if ( typeof user_criteria.$or === 'undefined' ) 
					{
						user_criteria.$or = expressions;
					}
					else
					{
						user_criteria.$and = [
							{ $or: user_criteria.$or },
							{ $or: expressions },
						];
						delete user_criteria.$or;
					}
				}

				return user_criteria;
			};


			//=====================================================================
			// SetOwner
			//---------------------------------------------------------------------
			// Sets the ownership of a number of documents.
			// User must be an admin or owner of the document.
			//=====================================================================


			ThisUser.SetOwner = async function ( Criteria, SetOwnerID ) 
			{
				return new Promise(
					async function ( resolve, reject )
					{
						try
						{
							let criteria = ThisUser.Criteria( Criteria );
							let documents = await Storage.FindMany( criteria, null, UserOptions );
							let modified = [];
							for ( let index = 0; index < documents.length; index++ )
							{
								let document = documents[ index ];
								if ( ThisUser.CanShare( document ) )
								{
									// Set the new owner.
									document[ Settings.UserInfoField ].owner_id = SetOwnerID;
									document[ Settings.UserInfoField ].updated_at = zulu_timestamp();
									document = await Storage.ReplaceOne( { _id: document._id }, document, UserOptions );
									clean_document( document );
									modified.push( document );
								}
							}
							resolve( modified );
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
			// Share
			//---------------------------------------------------------------------
			// Modifies the sharing permissions of a number of documents.
			// User must have sharing permissions on the document.
			//=====================================================================


			ThisUser.Share = async function ( Criteria, Readers, Writers, MakePublic )
			{
				return new Promise(
					async function ( resolve, reject )
					{
						try
						{
							if ( 'lu'.includes( jsongin.ShortType( Readers ) ) ) { Readers = []; }
							if ( jsongin.ShortType( Readers ) === 's' ) { Readers = [ Readers ]; }
							if ( jsongin.ShortType( Readers ) !== 'a' ) { throw new Error( 'Readers must be a string or an array of strings.' ); }
							if ( 'lu'.includes( jsongin.ShortType( Writers ) ) ) { Writers = []; }
							if ( jsongin.ShortType( Writers ) === 's' ) { Writers = [ Writers ]; }
							if ( jsongin.ShortType( Writers ) !== 'a' ) { throw new Error( 'Writers must be a string or an array of strings.' ); }

							let criteria = ThisUser.Criteria( Criteria );
							let modified = [];
							let timestamp = zulu_timestamp();
							let documents = await Storage.FindMany( criteria, null, UserOptions );
							for ( let index = 0; index < documents.length; index++ )
							{
								let document = documents[ index ];
								if ( !ThisUser.CanShare( document ) ) { continue; }

								// Update the document.
								let is_modified = false;
								if ( Readers.length )
								{
									if ( add_to_set( document[ Settings.UserInfoField ].readers, Readers ) )
									{
										is_modified = true;
									}
								}
								if ( Writers.length )
								{
									if ( add_to_set( document[ Settings.UserInfoField ].writers, Writers ) )
									{
										is_modified = true;
									}
								}
								if ( MakePublic
									&& !document[ Settings.UserInfoField ].public
									&& ( jsongin.ShortType( MakePublic ) === 'b' ) )
								{
									document[ Settings.UserInfoField ].public = true;
									is_modified = true;
								}

								// Replace the document.
								if ( is_modified )
								{
									document[ Settings.UserInfoField ].updated_at = timestamp;
									document = await Storage.ReplaceOne( { _id: document._id }, document, UserOptions );
									clean_document( document );
									modified.push( document );
								}
							}
							resolve( modified );
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
			// SetSharing
			//---------------------------------------------------------------------
			// Sets the sharing permissions of a number of documents.
			// User must have sharing permissions on the document.
			//=====================================================================


			ThisUser.SetSharing = async function ( Criteria, SetReaders, SetWriters, SetPublic ) 
			{
				return new Promise(
					async function ( resolve, reject )
					{
						try
						{
							Readers = Readers || [];
							Writers = Writers || [];
							let criteria = ThisUser.Criteria( Criteria );
							let modified = [];
							let timestamp = zulu_timestamp();
							let documents = await Storage.FindMany( criteria, null, UserOptions );
							for ( let index = 0; index < documents.length; index++ )
							{
								let document = documents[ index ];
								if ( !ThisUser.CanShare( document ) ) { continue; }
								// Update the document.
								document[ Settings.UserInfoField ].readers = Readers;
								document[ Settings.UserInfoField ].writers = Writers;
								document[ Settings.UserInfoField ].public = !!MakePublic;
								document[ Settings.UserInfoField ].updated_at = timestamp;
								document = await Storage.ReplaceOne( { _id: document._id }, document, UserOptions );
								clean_document( document );
								modified.push( document );
							}
							resolve( modified );
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
			// UnsetSharing
			//---------------------------------------------------------------------
			// Modifies the sharing permissions of a number of documents.
			// User must have sharing permissions on the document.
			//=====================================================================


			ThisUser.UnsetSharing = async function ( Criteria, UnsetReaders, UnsetWriters, UnsetPublic ) 
			{
				return new Promise(
					async function ( resolve, reject )
					{
						try
						{
							if ( 'lu'.includes( jsongin.ShortType( UnsetReaders ) ) ) { UnsetReaders = []; }
							if ( jsongin.ShortType( UnsetReaders ) === 's' ) { UnsetReaders = [ UnsetReaders ]; }
							if ( jsongin.ShortType( UnsetReaders ) !== 'a' ) { throw new Error( 'UnsetReaders must be a string or an array of strings.' ); }
							if ( 'lu'.includes( jsongin.ShortType( UnsetWriters ) ) ) { UnsetWriters = []; }
							if ( jsongin.ShortType( UnsetWriters ) === 's' ) { UnsetWriters = [ UnsetWriters ]; }
							if ( jsongin.ShortType( UnsetWriters ) !== 'a' ) { throw new Error( 'UnsetWriters must be a string or an array of strings.' ); }

							let criteria = ThisUser.Criteria( Criteria );
							let modified = [];
							let timestamp = zulu_timestamp();
							let documents = await Storage.FindMany( criteria, null, UserOptions );
							for ( let index = 0; index < documents.length; index++ )
							{
								let document = documents[ index ];
								if ( !ThisUser.CanShare( document ) ) { continuel; }

								// Update the document.
								let is_modified = false;
								if ( UnsetReaders.length )
								{
									if ( remove_from_set( document[ Settings.UserInfoField ].readers, UnsetReaders ) )
									{
										is_modified = true;
									}
								}
								if ( UnsetWriters.length )
								{
									if ( remove_from_set( document[ Settings.UserInfoField ].writers, UnsetWriters ) )
									{
										is_modified = true;
									}
								}
								if ( UnsetPublic
									&& document[ Settings.UserInfoField ].public
									&& ( jsongin.ShortType( UnsetPublic ) === 'b' ) )
								{
									document[ Settings.UserInfoField ].public = false;
									is_modified = true;
								}

								// Replace the document.
								if ( is_modified )
								{
									document[ Settings.UserInfoField ].updated_at = timestamp;
									document = await Storage.ReplaceOne( { _id: document._id }, document, UserOptions );
									clean_document( document );
									modified.push( document );
								}
							}
							resolve( modified );
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


			return ThisUser;
		};


		return Filter;
	},

};

