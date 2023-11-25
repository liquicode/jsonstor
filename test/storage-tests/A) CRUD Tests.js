'use strict';

const LIB_UUID = require( 'uuid' );
const assert = require( 'assert' );

module.exports = function ( Storage, DocumentCount, DefaultOptions )
{


	let SessionID = LIB_UUID.v4();
	let Options = { ReturnDocuments: true };
	if ( DefaultOptions )
	{
		for ( let key in DefaultOptions )
		{
			Options[ key ] = DefaultOptions[ key ];
		}
	}


	//---------------------------------------------------------------------
	describe( 'A) CRUD Tests', () =>
	{


		//---------------------------------------------------------------------
		before(
			async function ()
			{
				// let result = await Storage.DropStorage( Options );
				// assert.ok( result );
				return;
			} );


		//---------------------------------------------------------------------
		it( `should insert ${DocumentCount} documents, one at a time`, async () => 
		{

			// Create a number of objects.
			for ( let number = 1; number <= DocumentCount; number++ )
			{
				let document = {
					session_id: SessionID,
					sequence: number,
					order_number: number,
				};

				// Insert the document.
				document = await Storage.InsertOne( document, Options );
				assert.ok( document );
				assert.ok( document._id );
				assert.ok( document.session_id === SessionID );
				assert.ok( document.sequence === number );
				assert.ok( document.order_number === number );
			}

			// Get the document count.
			let count = await Storage.Count( { session_id: SessionID }, Options );
			assert.ok( count === DocumentCount );

		} );


		//---------------------------------------------------------------------
		it( `should delete ${DocumentCount} documents, all at once`, async () => 
		{
			let documents = await Storage.DeleteMany( { session_id: SessionID }, Options );
			assert.ok( documents );
			assert.ok( documents.length === DocumentCount );
			for ( let number = 1; number <= DocumentCount; number++ )
			{
				let document = documents[ number - 1 ];
				assert.ok( document );
				assert.ok( document._id );
				assert.ok( document.session_id === SessionID );
				assert.ok( document.sequence === number );
				assert.ok( document.order_number === number );
			}
			// Get the document count.
			let count = await Storage.Count( { session_id: SessionID }, Options );
			assert.ok( count === 0 );
		} );


		//---------------------------------------------------------------------
		it( `should insert ${DocumentCount} documents, all at once`, async () => 
		{

			// Create a number of objects.
			let documents = [];
			for ( let number = 1; number <= DocumentCount; number++ )
			{
				documents.push( {
					session_id: SessionID,
					sequence: number,
					order_number: number,
				} );
			}

			// Insert the documents.
			documents = await Storage.InsertMany( documents, Options );

			// Validate the documents.
			assert.ok( documents.length === DocumentCount );
			for ( let number = 1; number <= DocumentCount; number++ )
			{
				let document = documents[ number - 1 ];
				assert.ok( document );
				assert.ok( document._id );
				assert.ok( document.session_id === SessionID );
				assert.ok( document.sequence === number );
				assert.ok( document.order_number === number );
			}

			// Validate the document count.
			let count = await Storage.Count( { session_id: SessionID }, Options );
			assert.ok( count === DocumentCount );

		} );


		//---------------------------------------------------------------------
		it( `should read ${DocumentCount} documents, one at a time`, async () => 
		{
			for ( let number = 1; number <= DocumentCount; number++ )
			{
				let document = await Storage.FindOne( {
					session_id: SessionID,
					sequence: number,
				}, null, Options );
				assert.ok( document );
				assert.ok( document._id );
				assert.ok( document.session_id === SessionID );
				assert.ok( document.sequence === number );
				assert.ok( document.order_number === number );
			}
		} );


		//---------------------------------------------------------------------
		it( `should replace ${DocumentCount} documents, one at a time`, async () => 
		{
			for ( let number = 1; number <= DocumentCount; number++ )
			{
				let document = await Storage.FindOne( {
					session_id: SessionID,
					sequence: number,
				}, null, Options );
				assert.ok( document );
				assert.ok( document._id );
				assert.ok( document.session_id === SessionID );
				assert.ok( document.sequence === number );
				assert.ok( document.order_number === number );
				document.update1 = 42;
				document = await Storage.ReplaceOne( { _id: document._id }, document, Options );
				assert.ok( document );
				assert.ok( document._id );
				assert.ok( document.session_id === SessionID );
				assert.ok( document.sequence === number );
				assert.ok( document.order_number === number );
				assert.ok( document.update1 === 42 );
			}
		} );


		//---------------------------------------------------------------------
		it( `should read ${DocumentCount} documents, all at once`, async () => 
		{
			let documents = await Storage.FindMany( { session_id: SessionID }, null, Options );
			assert.ok( documents );
			assert.ok( documents.length === DocumentCount );
			for ( let number = 1; number <= DocumentCount; number++ )
			{
				let document = documents[ number - 1 ];
				assert.ok( document );
				assert.ok( document._id );
				assert.ok( document.session_id === SessionID );
				assert.ok( document.sequence === number );
				assert.ok( document.order_number === number );
				assert.ok( document.update1 === 42 );
			}
		} );


		//---------------------------------------------------------------------
		it( `should update ${DocumentCount} documents, one at a time`, async () => 
		{
			for ( let number = 1; number <= DocumentCount; number++ )
			{
				let document = await Storage.UpdateOne( {
					session_id: SessionID,
					sequence: number,
				}, {
					$set: { order_number: ( number + 1 ) }
				}, Options );
				assert.ok( document );
				assert.ok( document._id );
				assert.ok( document.session_id === SessionID );
				assert.ok( document.sequence === number );
				assert.ok( document.order_number === ( number + 1 ) );
				assert.ok( document.update1 === 42 );
			}
		} );


		//---------------------------------------------------------------------
		it( `should update ${DocumentCount} documents, all at once`, async () => 
		{
			let documents = await Storage.UpdateMany( {
				session_id: SessionID
			}, {
				$set: { update2: 3.14 }
			}, Options );
			assert.ok( documents );
			assert.ok( documents.length === DocumentCount );
			for ( let number = 1; number <= DocumentCount; number++ )
			{
				let document = documents[ number - 1 ];
				assert.ok( document );
				assert.ok( document._id );
				assert.ok( document.session_id === SessionID );
				assert.ok( document.sequence === number );
				assert.ok( document.order_number === ( number + 1 ) );
				assert.ok( document.update1 === 42 );
				assert.ok( document.update2 === 3.14 );
			}
		} );


		//---------------------------------------------------------------------
		it( `should delete ${DocumentCount} documents, one at a time`, async () => 
		{
			let documents = await Storage.FindMany( { session_id: SessionID }, null, Options );
			assert.ok( documents );
			assert.ok( documents.length === DocumentCount );
			for ( let number = 1; number <= DocumentCount; number++ )
			{
				let document = documents[ number - 1 ];
				document = await Storage.DeleteOne( { _id: document._id }, Options );
				assert.ok( document );
				assert.ok( document._id );
				assert.ok( document.session_id === SessionID );
				assert.ok( document.sequence === number );
				assert.ok( document.order_number === ( number + 1 ) );
				assert.ok( document.update1 === 42 );
				assert.ok( document.update2 === 3.14 );
			}
			// Get the document count.
			let count = await Storage.Count( { session_id: SessionID }, Options );
			assert.ok( count === 0 );
		} );


	} );


};
