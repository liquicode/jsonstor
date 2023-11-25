'use strict';

const assert = require( 'assert' );

module.exports = function ( Storage, Options )
{


	//---------------------------------------------------------------------
	describe( 'Z) Ad-Hoc Tests', () =>
	{

		it( 'should not match explicit nested fields', async () => 
		{
			let result = null;
			result = await Storage.DropStorage( Options );
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
			}, Options );
			assert.ok( result );

			result = await Storage.FindOne( { __: { id: "bf71bf6e-4603-464e-96d1-3cb75c209f08" } }, null, Options );
			assert.ok( result == null );

			result = await Storage.FindOne( { __: { id: { $eq: "bf71bf6e-4603-464e-96d1-3cb75c209f08" } } }, null, Options );
			assert.ok( result == null );

		} );

	} );


};
