'use strict';

const assert = require( 'assert' );

module.exports = function ( Storage, TestOptions )
{

	if ( typeof TestOptions === 'undefined' ) { TestOptions = {}; }
	TestOptions.ReturnDocuments = true;


	//---------------------------------------------------------------------
	describe( 'Z) Ad-Hoc Tests', () =>
	{

		//---------------------------------------------------------------------
		before(
			async function ()
			{
				var result = await Storage.DropStorage( TestOptions );
				assert.ok( result );
				return;
			} );


		//---------------------------------------------------------------------
		it( 'should not match explicit nested fields', async () => 
		{
			var result = null;

			result = await Storage.DropStorage( TestOptions );
			assert.ok( result );

			result = await Storage.InsertOne( {
				"session_id": "39141da7-5b24-47d5-b666-9f0a493d1084",
				"order_number": 1,
				"__": {
					"id": "bf71bf6e-4603-464e-96d1-3cb75c209f08",
					"created_at": "2023-11-14T20:39:37.035Z",
					"updated_at": "2023-11-14T20:39:37.035Z",
					"owner_id": "alice@fake.com",
					"readers": [],
					"writers": [],
					"public": false
				},
				"_id": "631b7ab6-a728-42ce-b4f8-f8db70cfebdf"
			}, TestOptions );
			assert.ok( result );

			result = await Storage.FindOne( { __: { id: "bf71bf6e-4603-464e-96d1-3cb75c209f08" } }, null, TestOptions );
			assert.ok( result == null );

			result = await Storage.FindOne( { __: { id: { $eq: "bf71bf6e-4603-464e-96d1-3cb75c209f08" } } }, null, TestOptions );
			assert.ok( result == null );

		} );


		//---------------------------------------------------------------------
		it( 'should sort and limit in FindMany2', async () => 
		{
			var result = null;

			result = await Storage.DropStorage( TestOptions );
			assert.ok( result );

			var count = 10;
			for ( var number = 1; number <= count; number++ )
			{
				result = await Storage.InsertOne( {
					"sequence": number,
					"rev_sequence": ( count - number ) + 1,
				}, TestOptions );
				assert.ok( result );
			}

			var max = 5;
			var documents = await Storage.FindMany2( {}, null, { rev_sequence: 1 }, max, TestOptions );
			assert.ok( documents );
			assert.strictEqual( documents.length, max );
			for ( var number = 1; number <= max; number++ )
			{
				var document = documents[ number - 1 ];
				assert.strictEqual( document.rev_sequence, number );
			}

		} );


	} );


};
