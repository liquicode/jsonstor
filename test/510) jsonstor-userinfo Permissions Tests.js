'use strict';

const assert = require( 'assert' );

const JsonStorages = require( '../src/jsonstor' )();
const UserInfo = JsonStorages.GetStorage(
	'jsonstor-memory', {},
	[
		{ FilterName: 'jsonstor-userinfo', Settings: {} },
	] );

describe( '510) jsonstor-userinfo Permissions Tests', () =>
{

	//---------------------------------------------------------------------
	describe( `Alice, Bob, and Eve scenario`,
		function ()
		{

			// Make some fake users.
			let Alice = { user_id: 'alice@fake.com', user_role: 'admin' };
			let Bob = { user_id: 'bob@fake.com', user_role: 'user' };
			let Eve = { user_id: 'eve@fake.com', user_role: 'user' };

			function GetOptions( User )
			{
				return {
					ReturnDocuments: true,
					User: User,
				};
			}

			//---------------------------------------------------------------------
			async function _TestUserReadAccess( User, DocumentNames )
			{
				// Test the number of objects accessible.
				{
					let count = await UserInfo.Count( {}, GetOptions( User ) );
					assert.strictEqual( count, DocumentNames.length );
				}

				// Test the results of FindOne.
				{
					for ( let index = 0; index < DocumentNames.length; index++ )
					{
						let document_name = DocumentNames[ index ];
						let document = await UserInfo.FindOne( { name: document_name }, null, GetOptions( User ) );
						assert.ok( document !== null );
						assert.strictEqual( document.name, document_name );
					}
				}

				// Test the results of FindMany.
				{
					let documents = await UserInfo.FindMany( {}, null, GetOptions( User ) );
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
						let document = await UserInfo.FindOne( { name: document_name }, null, GetOptions( User ) );
						assert.ok( document );
						assert.strictEqual( document.name, document_name );
						document.text = "I overwrote your message.";
						document = UserInfo.ReplaceOne( { _id: document._id }, document, GetOptions( User ) );
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
					await UserInfo.DeleteMany( {}, GetOptions( Alice ) );

					// Create some documents for Alice.
					document = await UserInfo.InsertOne( { name: 'Public Document', text: 'This is a public document.' }, GetOptions( Alice ) );
					assert.ok( document );
					documents = await UserInfo.User( Alice ).Share( { _id: document._id }, null, null, true ); // Share this doc with everyone.
					assert.ok( documents.length === 1 );

					document = await UserInfo.InsertOne( { name: 'Internal Document', text: 'This is an internal document.' }, GetOptions( Alice ) );
					assert.ok( document );
					documents = await UserInfo.User( Alice ).Share( { _id: document._id }, null, Bob.user_id ); // Give read and write access to Bob.
					assert.ok( documents.length === 1 );
					documents = await UserInfo.User( Alice ).Share( { _id: document._id }, Eve.user_id ); // Give read-only access to Eve.
					assert.ok( documents.length === 1 );

					document = await UserInfo.InsertOne( { name: 'Secret Document', text: 'This is a secret document.' }, GetOptions( Alice ) );
					assert.ok( document );
					documents = await UserInfo.User( Alice ).Share( { _id: document._id }, Bob.user_id ); // Give read-only access to Bob.
					assert.ok( documents.length === 1 );

					// Create some documents for Bob.
					document = await UserInfo.InsertOne( { name: 'My Document', text: 'This is my document.' }, GetOptions( Bob ) );
					assert.ok( document );
					document = await UserInfo.InsertOne( { name: 'My Document 2', text: 'This is my other document.' }, GetOptions( Bob ) );
					assert.ok( document );

					// Create a document for Eve.
					document = await UserInfo.InsertOne( { name: 'Evil Plans', text: 'Step 1: Take over the world.' }, GetOptions( Eve ) );
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

					document = await UserInfo.FindOne( { name: 'Public Document' }, null, GetOptions( Alice ) );
					assert.ok( document );
					assert.strictEqual( document.name, 'Public Document' );

					document = await UserInfo.FindOne( { name: 'Public Document' }, null, GetOptions( Bob ) );
					assert.ok( document );
					assert.strictEqual( document.name, 'Public Document' );

					document = await UserInfo.FindOne( { name: 'Public Document' }, null, GetOptions( Eve ) );
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
						let original = await UserInfo.FindOne( { name: 'Public Document' }, null, GetOptions( Alice ) );
						assert.ok( original );
						// Get the document.
						let document = await UserInfo.FindOne( { name: 'Public Document' }, null, GetOptions( Bob ) );
						// Edit the document.
						document.text = "I have overwritten your message.";
						// Attempt to save the document.
						document = await UserInfo.ReplaceOne( { _id: document._id }, document, GetOptions( Bob ) );
						assert.ok( document === null ); // Write failed.
						// Read thew document again.
						document = await UserInfo.FindOne( { name: 'Public Document' }, null, GetOptions( Bob ) );
						assert.deepStrictEqual( original, document );
					}

					// Eve cannot update the public document.
					{
						let original = await UserInfo.FindOne( { name: 'Public Document' }, null, GetOptions( Alice ) );
						assert.ok( original );
						// Get the document.
						let document = await UserInfo.FindOne( { name: 'Public Document' }, null, GetOptions( Eve ) );
						// Edit the document.
						document.text = "I have overwritten your message.";
						// Attempt to save the document.
						document = await UserInfo.ReplaceOne( { _id: document._id }, document, GetOptions( Eve ) );
						assert.ok( document === null ); // Write failed.
						// Read thew document again.
						document = await UserInfo.FindOne( { name: 'Public Document' }, null, GetOptions( Eve ) );
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
						let original = await UserInfo.FindOne( { name: 'Secret Document' }, null, GetOptions( Alice ) );
						assert.ok( original );
						// Get the document.
						let document = await UserInfo.FindOne( { name: 'Secret Document' }, null, GetOptions( Bob ) );
						assert.ok( document );
						// Edit the document.
						document.text = "I have overwritten your message.";
						// Attempt to save the document.
						document = await UserInfo.ReplaceOne( { _id: document._id }, document, GetOptions( Bob ) );
						assert.ok( document === null ); // Write failed.
						// Read thew document again.
						document = await UserInfo.FindOne( { name: 'Secret Document' }, null, GetOptions( Bob ) );
						assert.deepStrictEqual( original, document );
					}

					// Eve can read, but not update, the document 'Internal Document'.
					{
						let original = await UserInfo.FindOne( { name: 'Internal Document' }, null, GetOptions( Alice ) );
						assert.ok( original );
						// Get the document.
						let document = await UserInfo.FindOne( { name: 'Internal Document' }, null, GetOptions( Eve ) );
						// Edit the document.
						document.text = "I have overwritten your message.";
						// Attempt to save the document.
						document = await UserInfo.ReplaceOne( { _id: document._id }, document, GetOptions( Eve ) );
						assert.ok( document === null ); // Write failed.
						// Read thew document again.
						document = await UserInfo.FindOne( { name: 'Internal Document' }, null, GetOptions( Eve ) );
						assert.deepStrictEqual( original, document );
					}

					return;
				} );


			return;
		} );


} );

