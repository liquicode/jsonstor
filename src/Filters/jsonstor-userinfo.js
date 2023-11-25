"use strict";


const LIB_UUID = require( 'uuid' );

const jsongin = require( '@liquicode/jsongin' )();
const StorageBase = require( '../StorageBase' );


module.exports = {

	FilterName: 'jsonstor-userinfo',
	FilterDescription: 'Adds user ownership and document sharing to an existing storage.',

	GetFilter: function ( Storage, Settings )
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
		let Filter = StorageBase( null, Settings );
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
				id: LIB_UUID.v4(),
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
			if ( typeof Options === 'undefined' ) { Options = {}; }
			Options = jsongin.Clone( Options );
			Options.ReturnDocuments = true;
			delete Options.User;
			return Options;
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
					async ( resolve, reject ) =>
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
					async ( resolve, reject ) =>
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
		// Count
		//---------------------------------------------------------------------
		// Returns the number of objects specified by Criteria.
		// Only objects that allow the user read or write access are counted.
		//=====================================================================


		Filter.Count =
			async function Count( Criteria, Options )
			{
				return new Promise(
					async ( resolve, reject ) =>
					{
						try
						{
							if ( jsongin.ShortType( Options ) !== 'o' ) { throw PARAMETER_ERROR( 'Options', 'object' ); }
							if ( jsongin.ShortType( Options.User ) !== 'o' ) { throw PARAMETER_ERROR( 'Options.User', 'object' ); }
							let User = Options.User;
							let criteria = Filter.User( User ).Criteria( Criteria );
							let count = await Storage.Count( criteria, get_storage_options( Options ) );
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
					async ( resolve, reject ) =>
					{
						try
						{
							if ( jsongin.ShortType( Document ) !== 'o' ) { throw PARAMETER_ERROR( 'Document', 'object' ); }
							if ( jsongin.ShortType( Options ) !== 'o' ) { throw PARAMETER_ERROR( 'Options', 'object' ); }
							if ( jsongin.ShortType( Options.User ) !== 'o' ) { throw PARAMETER_ERROR( 'Options.User', 'object' ); }
							let User = Options.User;
							let user_info = new_user_info( User );
							let document = jsongin.Clone( Document );
							document[ Settings.UserInfoField ] = user_info;
							let modified = await Storage.InsertOne( document, get_storage_options( Options ) );
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
					async ( resolve, reject ) =>
					{
						try
						{
							if ( jsongin.ShortType( Documents ) !== 'a' ) { throw PARAMETER_ERROR( 'Documents', 'array' ); }
							if ( jsongin.ShortType( Options ) !== 'o' ) { throw PARAMETER_ERROR( 'Options', 'object' ); }
							if ( jsongin.ShortType( Options.User ) !== 'o' ) { throw PARAMETER_ERROR( 'Options.User', 'object' ); }
							let User = Options.User;
							let user_info = new_user_info( User );
							let modified = [];
							for ( let index = 0; index < Documents.length; index++ )
							{
								let document = jsongin.Clone( Documents[ index ] );
								document[ Settings.UserInfoField ] = user_info;
								modified.push( document );
							}
							modified = await Storage.InsertMany( modified, get_storage_options( Options ) );
							if ( Options.ReturnDocuments )
							{
								modified.forEach( document => clean_document( document ) );
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
					async ( resolve, reject ) =>
					{
						try
						{
							if ( jsongin.ShortType( Options ) !== 'o' ) { throw PARAMETER_ERROR( 'Options', 'object' ); }
							if ( jsongin.ShortType( Options.User ) !== 'o' ) { throw PARAMETER_ERROR( 'Options.User', 'object' ); }
							let User = Options.User;
							let criteria = Filter.User( User ).Criteria( Criteria );
							let document = await Storage.FindOne( criteria, Projection, get_storage_options( Options ) );
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
					async ( resolve, reject ) =>
					{
						try
						{
							if ( jsongin.ShortType( Options ) !== 'o' ) { throw PARAMETER_ERROR( 'Options', 'object' ); }
							if ( jsongin.ShortType( Options.User ) !== 'o' ) { throw PARAMETER_ERROR( 'Options.User', 'object' ); }
							let User = Options.User;
							let criteria = Filter.User( User ).Criteria( Criteria );
							let documents = await Storage.FindMany( criteria, Projection, get_storage_options( Options ) );
							documents.forEach( document => clean_document( document ) );
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
		// UpdateOne
		//---------------------------------------------------------------------
		// Modifies a single document.
		// User must have write permissions to the updated document.
		//=====================================================================


		Filter.UpdateOne =
			async function UpdateOne( Criteria, Updates, Options )
			{
				return new Promise(
					async ( resolve, reject ) =>
					{
						try
						{
							if ( jsongin.ShortType( Updates ) !== 'o' ) { Updates = {}; }
							if ( jsongin.ShortType( Options ) !== 'o' ) { throw PARAMETER_ERROR( 'Options', 'object' ); }
							if ( jsongin.ShortType( Options.User ) !== 'o' ) { throw PARAMETER_ERROR( 'Options.User', 'object' ); }
							let User = Options.User;
							if ( !Updates.$set ) { Updates.$set = {}; }
							Updates.$set[ `${Settings.UserInfoField}.updated_at` ] = zulu_timestamp();
							let criteria = Filter.User( User ).Criteria( Criteria );
							let document = await Storage.FindOne( criteria, null, get_storage_options( Options ) );
							let error = null;
							if ( !document ) { error = READ_ACCESS_ERROR(); }
							else if ( !Filter.User( User ).CanWrite( document ) ) { error = WRITE_ACCESS_ERROR(); }
							if ( error )
							{
								if ( Settings.ThrowPermissionErrors ) { throw error; }
								resolve( null );
								return;
							}
							let modified = await Storage.UpdateOne( criteria, Updates, get_storage_options( Options ) );
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
					async ( resolve, reject ) =>
					{
						try
						{
							if ( jsongin.ShortType( Updates ) !== 'o' ) { Updates = {}; }
							if ( jsongin.ShortType( Options ) !== 'o' ) { throw PARAMETER_ERROR( 'Options', 'object' ); }
							if ( jsongin.ShortType( Options.User ) !== 'o' ) { throw PARAMETER_ERROR( 'Options.User', 'object' ); }
							let User = Options.User;
							if ( !Updates.$set ) { Updates.$set = {}; }
							Updates.$set[ `${Settings.UserInfoField}.updated_at` ] = zulu_timestamp();
							let criteria = Filter.User( User ).Criteria( Criteria );
							let modified_ids = await Storage.FindMany( criteria, { _id: 1 }, get_storage_options( Options ) );
							let modified = [];
							for ( let index = 0; index < modified_ids.length; index++ )
							{
								let document_id = modified_ids[ index ]._id;
								let document = await Storage.FindOne( { _id: document_id }, null, get_storage_options( Options ) );
								let error = null;
								if ( !document ) { error = READ_ACCESS_ERROR(); }
								else if ( !Filter.User( User ).CanWrite( document ) ) { error = WRITE_ACCESS_ERROR(); }
								if ( error )
								{
									if ( Settings.ThrowPermissionErrors ) { throw error; }
									continue;
								}
								document = await Storage.UpdateOne( { _id: document_id }, Updates, get_storage_options( Options ) );
								modified.push( document );
							}
							if ( Options.ReturnDocuments )
							{
								modified.forEach( document => clean_document( document ) );
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
					async ( resolve, reject ) =>
					{
						try
						{
							if ( jsongin.ShortType( Document ) !== 'o' ) { throw PARAMETER_ERROR( 'Document', 'object' ); }
							if ( jsongin.ShortType( Options ) !== 'o' ) { throw PARAMETER_ERROR( 'Options', 'object' ); }
							if ( jsongin.ShortType( Options.User ) !== 'o' ) { throw PARAMETER_ERROR( 'Options.User', 'object' ); }
							let User = Options.User;
							let criteria = Filter.User( User ).Criteria( Criteria );
							let storage_options = get_storage_options( Options );
							let document = await Storage.FindOne( criteria, null, storage_options );
							let error = null;
							if ( !document ) { error = READ_ACCESS_ERROR(); }
							else if ( !Filter.User( User ).CanWrite( document ) ) { error = WRITE_ACCESS_ERROR(); }
							if ( error )
							{
								if ( Settings.ThrowPermissionErrors ) { throw error; }
								resolve( null );
								return;
							}
							let modified = await Storage.ReplaceOne( criteria, Document, storage_options );
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
					async ( resolve, reject ) =>
					{
						try
						{
							if ( jsongin.ShortType( Options ) !== 'o' ) { throw PARAMETER_ERROR( 'Options', 'object' ); }
							if ( jsongin.ShortType( Options.User ) !== 'o' ) { throw PARAMETER_ERROR( 'Options.User', 'object' ); }
							let User = Options.User;
							let criteria = Filter.User( User ).Criteria( Criteria );
							let document = await Storage.FindOne( criteria, null, get_storage_options( Options ) );
							let error = null;
							if ( !document ) { error = READ_ACCESS_ERROR(); }
							else if ( !Filter.User( User ).CanWrite( document ) ) { error = WRITE_ACCESS_ERROR(); }
							if ( error )
							{
								if ( Settings.ThrowPermissionErrors ) { throw error; }
								resolve( null );
								return;
							}
							let modified = await Storage.DeleteOne( criteria, get_storage_options( Options ) );
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
					async ( resolve, reject ) =>
					{
						try
						{
							if ( jsongin.ShortType( Options ) !== 'o' ) { throw PARAMETER_ERROR( 'Options', 'object' ); }
							if ( jsongin.ShortType( Options.User ) !== 'o' ) { throw PARAMETER_ERROR( 'Options.User', 'object' ); }
							let User = Options.User;
							let criteria = Filter.User( User ).Criteria( Criteria );
							let modified_ids = await Storage.FindMany( criteria, { _id: 1 }, get_storage_options( Options ) );
							let modified = [];
							for ( let index = 0; index < modified_ids.length; index++ )
							{
								let document_id = modified_ids[ index ]._id;
								let document = await Storage.FindOne( { _id: document_id }, null, get_storage_options( Options ) );
								let error = null;
								if ( !document ) { error = READ_ACCESS_ERROR(); }
								else if ( !Filter.User( User ).CanRead( document ) ) { error = READ_ACCESS_ERROR(); }
								else if ( !Filter.User( User ).CanWrite( document ) ) { error = WRITE_ACCESS_ERROR(); }
								if ( error )
								{
									if ( Settings.ThrowPermissionErrors ) { throw error; }
									continue;
								}
								document = await Storage.DeleteOne( { _id: document_id }, get_storage_options( Options ) );
								modified.push( document );
							}
							if ( Options.ReturnDocuments )
							{
								modified.forEach( document => clean_document( document ) );
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


		Filter.User = function ( User )
		{
			let ThisUser = {};

			//---------------------------------------------------------------------
			if ( jsongin.ShortType( User ) !== 'o' ) { throw PARAMETER_ERROR( 'User', 'object' ); }
			if ( jsongin.ShortType( User.user_id ) !== 's' ) { throw PARAMETER_ERROR( 'User.user_id', 'string' ); }
			if ( jsongin.ShortType( User.user_role ) !== 's' ) { throw PARAMETER_ERROR( 'User.user_role', 'string' ); }
			// if ( ![ 'admin', 'super', 'user' ].includes( User.user_role ) ) { throw new Error( `Unknown value for User.user_role: [${User.user_role}]` ); }


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
					async ( resolve, reject ) =>
					{
						try
						{
							let criteria = ThisUser.Criteria( Criteria );
							let documents = await Storage.FindMany( criteria, null, { ReturnDocuments: true } );
							let modified = [];
							for ( let index = 0; index < documents.length; index++ )
							{
								let document = documents[ index ];
								if ( ThisUser.CanShare( document ) )
								{
									// Set the new owner.
									document[ Settings.UserInfoField ].owner_id = SetOwnerID;
									document[ Settings.UserInfoField ].updated_at = zulu_timestamp();
									document = await Storage.ReplaceOne( { _id: document._id }, document, { ReturnDocuments: true } );
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
					async ( resolve, reject ) =>
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
							let documents = await Storage.FindMany( criteria, null, { ReturnDocuments: true } );
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
									document = await Storage.ReplaceOne( { _id: document._id }, document, { ReturnDocuments: true } );
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
					async ( resolve, reject ) =>
					{
						try
						{
							Readers = Readers || [];
							Writers = Writers || [];
							let criteria = ThisUser.Criteria( Criteria );
							let modified = [];
							let timestamp = zulu_timestamp();
							let documents = await Storage.FindMany( criteria, null, { ReturnDocuments: true } );
							for ( let index = 0; index < documents.length; index++ )
							{
								let document = documents[ index ];
								if ( !ThisUser.CanShare( document ) ) { continue; }
								// Update the document.
								document[ Settings.UserInfoField ].readers = Readers;
								document[ Settings.UserInfoField ].writers = Writers;
								document[ Settings.UserInfoField ].public = !!MakePublic;
								document[ Settings.UserInfoField ].updated_at = timestamp;
								document = await Storage.ReplaceOne( { _id: document._id }, document, { ReturnDocuments: true } );
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
					async ( resolve, reject ) =>
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
							let documents = await Storage.FindMany( criteria, null, { ReturnDocuments: true } );
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
									document = await Storage.ReplaceOne( document );
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

