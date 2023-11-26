'use strict';

const assert = require( 'assert' );
const jsonstor = require( '../../src/jsonstor' )();


module.exports = function ( Storage, TestOptions )
{

	if ( typeof TestOptions === 'undefined' ) { TestOptions = {}; }
	TestOptions.ReturnDocuments = true;
	const UserStorage = jsonstor.GetFilter( 'jsonstor-userinfo', Storage, {} );
	// TestOptions.User = UserStorage.Administrator;


	describe( 'C) UserInfo Permissions Tests', () =>
	{

		// //---------------------------------------------------------------------
		// before(
		// 	async function ()
		// 	{
		// 		let result = await UserStorage.DropStorage( TestOptions );
		// 		assert.ok( result );
		// 		return;
		// 	} );


		//---------------------------------------------------------------------
		describe( `Alice, Bob, and Eve scenario`,
			function ()
			{

				// Make some test users.
				let Alice = { user_id: 'alice@fake.com', user_role: 'admin' };
				let Bob = { user_id: 'bob@fake.com', user_role: 'user' };
				let Eve = { user_id: 'eve@fake.com', user_role: 'user' };


				//---------------------------------------------------------------------
				function GetOptions( User )
				{
					let user_options = JSON.parse( JSON.stringify( TestOptions ) );
					user_options.User = User;
					return user_options;
				}


				//---------------------------------------------------------------------
				async function _TestUserReadAccess( User, DocumentNames )
				{
					// Test the number of objects accessible.
					{
						let count = await UserStorage.Count( {}, GetOptions( User ) );
						assert.strictEqual( count, DocumentNames.length );
					}

					// Test the results of FindOne.
					{
						for ( let index = 0; index < DocumentNames.length; index++ )
						{
							let document_name = DocumentNames[ index ];
							let document = await UserStorage.FindOne( { name: document_name }, null, GetOptions( User ) );
							assert.ok( document !== null );
							assert.strictEqual( document.name, document_name );
						}
					}

					// Test the results of FindMany.
					{
						let documents = await UserStorage.FindMany( {}, null, GetOptions( User ) );
						assert.strictEqual( documents.length, DocumentNames.length );
						for ( let index = 0; index < documents.length; index++ )
						{
							let object = documents[ index ];
							assert.ok( DocumentNames.includes( object.name ) );
						}
					}

					return;
				}


				//---------------------------------------------------------------------
				async function _TestUserWriteAccess( User, DocumentNames )
				{
					// Test the results of WriteOne.
					{
						for ( let index = 0; index < DocumentNames.length; index++ )
						{
							let document_name = DocumentNames[ index ];
							let document = await UserStorage.FindOne( { name: document_name }, null, GetOptions( User ) );
							assert.ok( document );
							assert.strictEqual( document.name, document_name );
							document.text = "I overwrote your message.";
							document = UserStorage.ReplaceOne( { _id: document._id }, document, GetOptions( User ) );
							assert.ok( document );
						}
					}
					return;
				}


				//---------------------------------------------------------------------
				async function _RebuildTestEnvironment()
				{
					try
					{
						let document = null;
						let documents = null;
						let alice_options = GetOptions( Alice );

						// await UserStorage.DeleteMany( {}, alice_options );
						await UserStorage.DropStorage( alice_options );

						// Create some documents for Alice.
						document = await UserStorage.InsertOne( { name: 'Public Document', text: 'This is a public document.' }, alice_options );
						assert.ok( document );
						documents = await UserStorage.User( alice_options ).Share( { _id: document._id }, null, null, true ); // Share this doc with everyone.
						assert.ok( documents.length === 1 );

						document = await UserStorage.InsertOne( { name: 'Internal Document', text: 'This is an internal document.' }, alice_options );
						assert.ok( document );
						documents = await UserStorage.User( alice_options ).Share( { _id: document._id }, null, Bob.user_id ); // Give read and write access to Bob.
						assert.ok( documents.length === 1 );
						documents = await UserStorage.User( alice_options ).Share( { _id: document._id }, Eve.user_id ); // Give read-only access to Eve.
						assert.ok( documents.length === 1 );

						document = await UserStorage.InsertOne( { name: 'Secret Document', text: 'This is a secret document.' }, alice_options );
						assert.ok( document );
						documents = await UserStorage.User( alice_options ).Share( { _id: document._id }, Bob.user_id ); // Give read-only access to Bob.
						assert.ok( documents.length === 1 );

						// Create some documents for Bob.
						document = await UserStorage.InsertOne( { name: 'My Document', text: 'This is my document.' }, GetOptions( Bob ) );
						assert.ok( document );
						document = await UserStorage.InsertOne( { name: 'My Document 2', text: 'This is my other document.' }, GetOptions( Bob ) );
						assert.ok( document );

						// Create a document for Eve.
						document = await UserStorage.InsertOne( { name: 'Evil Plans', text: 'Step 1: Take over the world.' }, GetOptions( Eve ) );
						assert.ok( document );
					}
					catch ( error )
					{
						console.error( error );
					}
					return;
				}


				//---------------------------------------------------------------------
				it( `Should add documents and set permissions`,
					async function ()
					{
						await _RebuildTestEnvironment();
						return;
					} );


				//---------------------------------------------------------------------
				it( `Alice should read all documents and write all documents`,
					async function ()
					{
						await _RebuildTestEnvironment();
						await _TestUserReadAccess(
							Alice,
							[
								'Public Document',
								'Internal Document',
								'Secret Document',
								'My Document',
								'My Document 2',
								'Evil Plans',
							] );
						await _TestUserWriteAccess(
							Alice,
							[
								'Public Document',
								'Internal Document',
								'Secret Document',
								'My Document',
								'My Document 2',
								'Evil Plans',
							] );
						return;
					} );


				//---------------------------------------------------------------------
				it( `Bob should read some documents and write some documents`,
					async function ()
					{
						await _RebuildTestEnvironment();
						await _TestUserReadAccess(
							Bob,
							[
								'Public Document',
								'Internal Document',
								'Secret Document',
								'My Document',
								'My Document 2',
								// 'Evil Plans',
							] );
						await _TestUserWriteAccess(
							Bob,
							[
								// 'Public Document',
								'Internal Document',
								// 'Secret Document',
								'My Document',
								'My Document 2',
								// 'Evil Plans',
							] );
						return;
					} );


				//---------------------------------------------------------------------
				it( `Eve should read some documents and write some documents`,
					async function ()
					{
						await _RebuildTestEnvironment();
						await _TestUserReadAccess(
							Eve,
							[
								'Public Document',
								'Internal Document',
								// 'Secret Document',
								// 'My Document',
								// 'My Document 2',
								'Evil Plans',
							] );
						await _TestUserWriteAccess(
							Eve,
							[
								// 'Public Document',
								// 'Internal Document',
								// 'Secret Document',
								// 'My Document',
								// 'My Document 2',
								'Evil Plans',
							] );
						return;
					} );


				//---------------------------------------------------------------------
				it( `Public objects should be readable by everyone`,
					async function ()
					{
						await _RebuildTestEnvironment();
						let document = null;

						document = await UserStorage.FindOne( { name: 'Public Document' }, null, GetOptions( Alice ) );
						assert.ok( document );
						assert.strictEqual( document.name, 'Public Document' );

						document = await UserStorage.FindOne( { name: 'Public Document' }, null, GetOptions( Bob ) );
						assert.ok( document );
						assert.strictEqual( document.name, 'Public Document' );

						document = await UserStorage.FindOne( { name: 'Public Document' }, null, GetOptions( Eve ) );
						assert.ok( document );
						assert.strictEqual( document.name, 'Public Document' );

						return;
					} );


				//---------------------------------------------------------------------
				it( `Public objects should only be writable by the owner`,
					async function ()
					{
						await _RebuildTestEnvironment();

						// Bob cannot update the public document.
						{
							let original = await UserStorage.FindOne( { name: 'Public Document' }, null, GetOptions( Alice ) );
							assert.ok( original );
							// Get the document.
							let document = await UserStorage.FindOne( { name: 'Public Document' }, null, GetOptions( Bob ) );
							// Edit the document.
							document.text = "I have overwritten your message.";
							// Attempt to save the document.
							document = await UserStorage.ReplaceOne( { _id: document._id }, document, GetOptions( Bob ) );
							assert.ok( document === null ); // Write failed.
							// Read thew document again.
							document = await UserStorage.FindOne( { name: 'Public Document' }, null, GetOptions( Bob ) );
							assert.deepStrictEqual( original, document );
						}

						// Eve cannot update the public document.
						{
							let original = await UserStorage.FindOne( { name: 'Public Document' }, null, GetOptions( Alice ) );
							assert.ok( original );
							// Get the document.
							let document = await UserStorage.FindOne( { name: 'Public Document' }, null, GetOptions( Eve ) );
							// Edit the document.
							document.text = "I have overwritten your message.";
							// Attempt to save the document.
							document = await UserStorage.ReplaceOne( { _id: document._id }, document, GetOptions( Eve ) );
							assert.ok( document === null ); // Write failed.
							// Read thew document again.
							document = await UserStorage.FindOne( { name: 'Public Document' }, null, GetOptions( Eve ) );
							assert.deepStrictEqual( original, document );
						}

						return;
					} );


				//---------------------------------------------------------------------
				it( `Should not allow readers to update documents`,
					async function ()
					{
						await _RebuildTestEnvironment();

						// Bob can read, but not update, the document 'Secret Document'.
						{
							let original = await UserStorage.FindOne( { name: 'Secret Document' }, null, GetOptions( Alice ) );
							assert.ok( original );
							// Get the document.
							let document = await UserStorage.FindOne( { name: 'Secret Document' }, null, GetOptions( Bob ) );
							assert.ok( document );
							// Edit the document.
							document.text = "I have overwritten your message.";
							// Attempt to save the document.
							document = await UserStorage.ReplaceOne( { _id: document._id }, document, GetOptions( Bob ) );
							assert.ok( document === null ); // Write failed.
							// Read thew document again.
							document = await UserStorage.FindOne( { name: 'Secret Document' }, null, GetOptions( Bob ) );
							assert.deepStrictEqual( original, document );
						}

						// Eve can read, but not update, the document 'Internal Document'.
						{
							let original = await UserStorage.FindOne( { name: 'Internal Document' }, null, GetOptions( Alice ) );
							assert.ok( original );
							// Get the document.
							let document = await UserStorage.FindOne( { name: 'Internal Document' }, null, GetOptions( Eve ) );
							// Edit the document.
							document.text = "I have overwritten your message.";
							// Attempt to save the document.
							document = await UserStorage.ReplaceOne( { _id: document._id }, document, GetOptions( Eve ) );
							assert.ok( document === null ); // Write failed.
							// Read thew document again.
							document = await UserStorage.FindOne( { name: 'Internal Document' }, null, GetOptions( Eve ) );
							assert.deepStrictEqual( original, document );
						}

						return;
					} );


				return;
			} );


	} );

};
