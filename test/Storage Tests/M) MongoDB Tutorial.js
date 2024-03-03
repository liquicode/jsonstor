'use strict';

const assert = require( 'assert' );

module.exports = function ( Storage, TestOptions )
{

	if ( typeof TestOptions === 'undefined' ) { TestOptions = {}; }
	TestOptions.ReturnDocuments = true;


	//---------------------------------------------------------------------
	async function reset_data( Documents )
	{
		let result = null;
		result = await Storage.DropStorage( TestOptions );
		assert.ok( result );
		result = await Storage.InsertMany( Documents, TestOptions );
		return result;
	}


	//---------------------------------------------------------------------
	describe( 'M) MongoDB Tutorial', () =>
	{


		//---------------------------------------------------------------------
		describe( 'Query Documents (https://www.mongodb.com/docs/manual/tutorial/query-documents/)', () =>
		{
			let results = null;

			//---------------------------------------------------------------------
			before(
				async function ()
				{
					let result = await reset_data(
						[
							{
								item: 'journal',
								qty: 25,
								size: { h: 14, w: 21, uom: 'cm' },
								status: 'A'
							},
							{
								item: 'notebook',
								qty: 50,
								size: { h: 8.5, w: 11, uom: 'in' },
								status: 'A'
							},
							{
								item: 'paper',
								qty: 100,
								size: { h: 8.5, w: 11, uom: 'in' },
								status: 'D'
							},
							{
								item: 'planner',
								qty: 75,
								size: { h: 22.85, w: 30, uom: 'cm' },
								status: 'D'
							},
							{
								item: 'postcard',
								qty: 45,
								size: { h: 10, w: 15.25, uom: 'cm' },
								status: 'A'
							},
						]
					);
					assert.ok( result );
					return;
				}
			);


			//---------------------------------------------------------------------
			after(
				async function ()
				{
					return;
				}
			);


			//---------------------------------------------------------------------
			describe( 'Select All Documents in a Collection', () =>
			{

				//---------------------------------------------------------------------
				it( 'Match All Documents with an Empty Object {}', async () => 
				{
					// To select all documents in the collection, pass an empty document
					// as the query filter parameter to the find method.
					results = await Storage.FindMany(
						{
						}, null, TestOptions );
					assert.ok( results.length === 5 );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Specify Equality Condition', () =>
			{

				//---------------------------------------------------------------------
				it( 'Match Fields with Implicit Equality', async () => 
				{
					// selects from the collection all documents where the status equals "D"
					results = await Storage.FindMany(
						{
							status: 'D'
						}, null, TestOptions );
					assert.ok( results.length === 2 );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Specify Conditions Using Query Operators', () =>
			{

				//---------------------------------------------------------------------
				it( 'Match Fields with an Array of Possible Values', async () => 
				{
					// retrieves all documents from the inventory collection where status
					// equals either "A" or "D"
					results = await Storage.FindMany(
						{
							status: { $in: [ 'A', 'D' ] }
						}, null, TestOptions );
					assert.ok( results.length === 5 );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Specify AND Conditions', () =>
			{

				//---------------------------------------------------------------------
				it( 'Match Fields with an Array of Possible Values', async () => 
				{
					// retrieves all documents in the inventory collection where the status
					// equals "A" and qty is less than ($lt) 30
					results = await Storage.FindMany(
						{
							status: 'A',
							qty: { $lt: 30 },
						}, null, TestOptions );
					assert.ok( results.length === 1 );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Specify OR Conditions', () =>
			{

				//---------------------------------------------------------------------
				it( 'Match Fields against an Array of Possible Values', async () => 
				{
					// retrieves all documents in the collection where the status
					// equals "A" or qty is less than ($lt) 30
					results = await Storage.FindMany(
						{
							$or:
								[
									{ status: 'A' },
									{ qty: { $lt: 30 } },
								]
						}, null, TestOptions );
					assert.ok( results.length === 3 );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Specify AND as well as OR Conditions', () =>
			{

				//---------------------------------------------------------------------
				it( 'Match Fields Using AND and OR', async () => 
				{
					// selects all documents in the collection where the status equals
					// "A" and either qty is less than ($lt) 30 or item starts with the character p
					results = await Storage.FindMany(
						{
							status: 'A',
							$or:
								[
									{ qty: { $lt: 30 } },
									{ "size.h": { $gte: 10 } },
								],
						}, null, TestOptions );
					assert.ok( results.length === 2 );
				} );

			} );


		} );


		//---------------------------------------------------------------------
		describe( 'Query on Embedded/Nested Documents (https://www.mongodb.com/docs/manual/tutorial/query-embedded-documents/)', () =>
		{
			let results = null;

			//---------------------------------------------------------------------
			before(
				async function ()
				{
					let result = await reset_data(
						[
							{
								item: 'journal',
								qty: 25,
								size: { h: 14, w: 21, uom: 'cm' },
								status: 'A'
							},
							{
								item: 'notebook',
								qty: 50,
								size: { h: 8.5, w: 11, uom: 'in' },
								status: 'A'
							},
							{
								item: 'paper',
								qty: 100,
								size: { h: 8.5, w: 11, uom: 'in' },
								status: 'D'
							},
							{
								item: 'planner',
								qty: 75,
								size: { h: 22.85, w: 30, uom: 'cm' },
								status: 'D'
							},
							{
								item: 'postcard',
								qty: 45,
								size: { h: 10, w: 15.25, uom: 'cm' },
								status: 'A'
							},
						]
					);
					assert.ok( result );
					return;
				}
			);


			//---------------------------------------------------------------------
			after(
				async function ()
				{
					return;
				}
			);


			//---------------------------------------------------------------------
			describe( 'Query on Embedded/Nested Documents', () =>
			{

				//---------------------------------------------------------------------
				it( 'Specify Equality Match on a Nested Field', async () => 
				{
					// selects all documents where the field uom nested in the size field equals "in"
					results = await Storage.FindMany(
						{
							'size.uom': 'in'
						}, null, TestOptions );
					assert.ok( results.length === 2 );
				} );

				//---------------------------------------------------------------------
				it( 'Specify Match using Query Operator', async () => 
				{
					// uses the less than operator ($lt) on the field h embedded in the size field
					results = await Storage.FindMany(
						{
							'size.h': { $lt: 15 }
						}, null, TestOptions );
					assert.ok( results.length === 4 );
				} );

				//---------------------------------------------------------------------
				it( 'Specify AND Condition', async () => 
				{
					// selects all documents where the nested field h is less than 15,
					// the nested field uom equals "in", and the status field equals "D"
					results = await Storage.FindMany(
						{
							'size.h': { $lt: 15 },
							'size.uom': 'in',
							status: 'D'
						}, null, TestOptions );
					assert.ok( results.length === 1 );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Match an Embedded/Nested Document', () =>
			{

				//---------------------------------------------------------------------
				it( 'Specify Equality Match on an Embedded Document', async () => 
				{
					// selects all documents where the field size equals the document { h: 14, w: 21, uom: "cm" }
					results = await Storage.FindMany(
						{
							size: { h: 14, w: 21, uom: 'cm' }
						}, null, TestOptions );
					assert.ok( results.length === 1 );

					// does not match any documents in the inventory collection
					results = await Storage.FindMany(
						{
							size: { w: 21, h: 14, uom: 'cm' }
						}, null, TestOptions );
					assert.ok( results.length === 0 );
				} );

			} );


		} );


		//---------------------------------------------------------------------
		describe( 'Query an Array (https://www.mongodb.com/docs/manual/tutorial/query-arrays/)', () =>
		{
			let results = null;

			//---------------------------------------------------------------------
			before(
				async function ()
				{
					let result = await reset_data(
						[
							{
								item: 'journal',
								qty: 25,
								tags: [ 'blank', 'red' ],
								dim_cm: [ 14, 21 ]
							},
							{
								item: 'notebook',
								qty: 50,
								tags: [ 'red', 'blank' ],
								dim_cm: [ 14, 21 ]
							},
							{
								item: 'paper',
								qty: 100,
								tags: [ 'red', 'blank', 'plain' ],
								dim_cm: [ 14, 21 ]
							},
							{
								item: 'planner',
								qty: 75,
								tags: [ 'blank', 'red' ],
								dim_cm: [ 22.85, 30 ]
							},
							{
								item: 'postcard',
								qty: 45,
								tags: [ 'blue' ],
								dim_cm: [ 10, 15.25 ]
							}
						]
					);
					assert.ok( result );
					return;
				}
			);


			//---------------------------------------------------------------------
			after(
				async function ()
				{
					return;
				}
			);


			//---------------------------------------------------------------------
			describe( 'Match an Array', () =>
			{

				//---------------------------------------------------------------------
				it( 'Match an Array Exactly', async () => 
				{
					// queries for all documents where the field tags value is an array
					// with exactly two elements, "red" and "blank", in the specified order
					results = await Storage.FindMany(
						{
							tags: [ 'red', 'blank' ],
						}, null, TestOptions );
					assert.ok( results.length === 1 );
					assert.ok( results[ 0 ].item === 'notebook' );
				} );

				//---------------------------------------------------------------------
				it( 'Match Array Elements', async () => 
				{
					// find an array that contains both the elements "red" and "blank",
					// without regard to order or other elements in the array
					results = await Storage.FindMany(
						{
							tags: { $all: [ 'red', 'blank' ] },
						}, null, TestOptions );
					assert.ok( results.length === 4 );
					assert.ok( results[ 0 ].item === 'journal' );
					assert.ok( results[ 1 ].item === 'notebook' );
					assert.ok( results[ 2 ].item === 'paper' );
					assert.ok( results[ 3 ].item === 'planner' );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Query an Array for an Element', () =>
			{

				//---------------------------------------------------------------------
				it( 'Match a Single Array Element', async () => 
				{
					// queries for all documents where tags is an array that contains
					// the string "red" as one of its elements
					results = await Storage.FindMany(
						{
							tags: 'red',
						}, null, TestOptions );
					assert.ok( results.length === 4 );
					assert.ok( results[ 0 ].item === 'journal' );
					assert.ok( results[ 1 ].item === 'notebook' );
					assert.ok( results[ 2 ].item === 'paper' );
					assert.ok( results[ 3 ].item === 'planner' );
				} );

				//---------------------------------------------------------------------
				it( 'Match Array Elements by Comparison', async () => 
				{
					// the following operation queries for all documents where the array
					// dim_cm contains at least one element whose value is greater than 25
					results = await Storage.FindMany(
						{
							dim_cm: { $gt: 25 }
						}, null, TestOptions );
					assert.ok( results.length === 1 );
					assert.ok( results[ 0 ].item === 'planner' );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Specify Multiple Conditions for Array Elements', () =>
			{

				//---------------------------------------------------------------------
				it( 'Query an Array with Compound Filter Conditions on the Array Elements', async () => 
				{
					// queries for documents where the dim_cm array contains elements that
					// in some combination satisfy the query conditions; e.g., one element
					// can satisfy the greater than 15 condition and another element can
					// satisfy the less than 20 condition, or a single element can satisfy both
					results = await Storage.FindMany(
						{
							dim_cm: { $gt: 15, $lt: 20 }
						}, null, TestOptions );
					assert.ok( results.length === 4 );
				} );

				//---------------------------------------------------------------------
				it( 'Query for an Array Element that Meets Multiple Criteria', async () => 
				{
					// queries for documents where the dim_cm array contains at least one
					// element that is both greater than ($gt) 22 and less than ($lt) 30
					results = await Storage.FindMany(
						{
							dim_cm: { $elemMatch: { $gt: 22, $lt: 30 } }
						}, null, TestOptions );
					assert.ok( results.length === 1 );
				} );

				//---------------------------------------------------------------------
				it( 'Query for an Element by the Array Index Position', async () => 
				{
					// queries for all documents where the second element in the array dim_cm is greater than 25
					results = await Storage.FindMany(
						{
							'dim_cm.1': { $gt: 25 }
						}, null, TestOptions );
					assert.ok( results.length === 1 );
				} );

				//---------------------------------------------------------------------
				it( 'Query an Array by Array Length', async () => 
				{
					// selects documents where the array tags has 3 elements
					results = await Storage.FindMany(
						{
							tags: { $size: 3 }
						}, null, TestOptions );
					assert.ok( results.length === 1 );
				} );

			} );


		} );


		//---------------------------------------------------------------------
		describe( 'Query an Array of Embedded Documents (https://www.mongodb.com/docs/manual/tutorial/query-array-of-documents/)', () =>
		{
			let results = null;

			//---------------------------------------------------------------------
			before(
				async function ()
				{
					let result = await reset_data(
						[
							{
								item: 'journal',
								instock: [
									{ warehouse: 'A', qty: 5 },
									{ warehouse: 'C', qty: 15 }
								]
							},
							{
								item: 'notebook',
								instock: [ { warehouse: 'C', qty: 5 } ]
							},
							{
								item: 'paper',
								instock: [
									{ warehouse: 'A', qty: 60 },
									{ warehouse: 'B', qty: 15 }
								]
							},
							{
								item: 'planner',
								instock: [
									{ warehouse: 'A', qty: 40 },
									{ warehouse: 'B', qty: 5 }
								]
							},
							{
								item: 'postcard',
								instock: [
									{ warehouse: 'B', qty: 15 },
									{ warehouse: 'C', qty: 35 }
								]
							}
						]
					);
					assert.ok( result );
					return;
				}
			);


			//---------------------------------------------------------------------
			after(
				async function ()
				{
					return;
				}
			);


			//---------------------------------------------------------------------
			describe( 'Query for a Document Nested in an Array', () =>
			{

				//---------------------------------------------------------------------
				it( 'Match a Document Exactly', async () => 
				{
					// selects all documents where an element in the instock array matches the specified document
					results = await Storage.FindMany(
						{
							instock: { warehouse: 'A', qty: 5 }
						}, null, TestOptions );
					assert.ok( results.length === 1 );
					assert.ok( results[ 0 ].item === 'journal' );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Specify a Query Condition on a Field in an Array of Documents', () =>
			{

				//---------------------------------------------------------------------
				it( 'Specify a Query Condition on a Field Embedded in an Array of Documents', async () => 
				{
					// selects all documents where the instock array has at least one embedded
					// document that contains the field qty whose value is less than or equal to 20
					results = await Storage.FindMany(
						{
							'instock.qty': { $lte: 20 }
						}, null, TestOptions );
					assert.ok( results.length === 5 );
				} );

				//---------------------------------------------------------------------
				it( 'Use the Array Index to Query for a Field in the Embedded Document', async () => 
				{
					// selects all documents where the instock array has as its first element a
					// document that contains the field qty whose value is less than or equal to 20
					results = await Storage.FindMany(
						{
							'instock.0.qty': { $lte: 20 }
						}, null, TestOptions );
					assert.ok( results.length === 3 );
					assert.ok( results[ 0 ].item === 'journal' );
					assert.ok( results[ 1 ].item === 'notebook' );
					assert.ok( results[ 2 ].item === 'postcard' );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Specify Multiple Conditions for Array of Documents', () =>
			{

				//---------------------------------------------------------------------
				it( 'A Single Nested Document Meets Multiple Query Conditions on Nested Fields', async () => 
				{
					// queries for documents where the instock array has at least one embedded
					// document that contains both the field qty equal to 5 and the field warehouse equal to A
					results = await Storage.FindMany(
						{
							instock: { $elemMatch: { qty: 5, warehouse: 'A' } }
						}, null, TestOptions );
					assert.ok( results.length === 1 );

					// queries for documents where the instock array has at least one embedded
					// document that contains the field qty that is greater than 10 and less than or equal to 20
					results = await Storage.FindMany(
						{
							instock: { $elemMatch: { qty: { $gt: 10, $lte: 20 } } }
						}, null, TestOptions );
					assert.ok( results.length === 3 );
				} );

				//---------------------------------------------------------------------
				it( 'Combination of Elements Satisfies the Criteria', async () => 
				{
					// matches documents where any document nested in the instock array has the
					// qty field greater than 10 and any document (but not necessarily the same
					// embedded document) in the array has the qty field less than or equal to 20
					results = await Storage.FindMany(
						{
							'instock.qty': { $gt: 10, $lte: 20 }
						}, null, TestOptions );
					assert.ok( results.length === 4 );

					// queries for documents where the instock array has at least one embedded
					// document that contains the field qty equal to 5 and at least one embedded
					// document (but not necessarily the same embedded document) that contains
					// the field warehouse equal to A
					results = await Storage.FindMany(
						{
							'instock.qty': 5,
							'instock.warehouse': 'A'
						}, null, TestOptions );
					assert.ok( results.length === 2 );

				} );

			} );


		} );


		//---------------------------------------------------------------------
		describe( 'Query for Null or Missing Fields (https://www.mongodb.com/docs/manual/tutorial/query-for-null-fields/)', () =>
		{
			let results = null;

			//---------------------------------------------------------------------
			before(
				async function ()
				{
					let result = await reset_data(
						[
							{ _id: 1, item: null },
							{ _id: 2 },
						]
					);
					assert.ok( result );
					return;
				}
			);


			//---------------------------------------------------------------------
			after(
				async function ()
				{
					return;
				}
			);


			//---------------------------------------------------------------------
			describe( 'Equality Filter', () =>
			{

				//---------------------------------------------------------------------
				it( 'Match Fields that are Null or Missing', async () => 
				{
					// matches documents that either contain the item field whose value
					// is null or that do not contain the item field
					results = await Storage.FindMany(
						{
							item: null
						}, null, TestOptions );
					assert.ok( results.length === 2 );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Type Check', () =>
			{

				//---------------------------------------------------------------------
				it( 'Match Fields that Exist And are Null', async () => 
				{
					// matches only documents that contain the item field whose value is null;
					// i.e. the value of the item field is of BSON Type Null (BSON Type 10)
					results = await Storage.FindMany(
						{
							item: { $type: 10 }
						}, null, TestOptions );
					assert.ok( results.length === 1 );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Existence Check', () =>
			{

				//---------------------------------------------------------------------
				it( 'Match Fields that are Missing', async () => 
				{
					// queries for documents that do not contain a field
					results = await Storage.FindMany(
						{
							item: { $exists: false }
						}, null, TestOptions );
					assert.ok( results.length === 1 );
				} );

			} );


		} );


	} );


};
