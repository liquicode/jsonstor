'use strict';

const assert = require( 'assert' );

module.exports = function ( Storage, TestOptions )
{

	if ( typeof TestOptions === 'undefined' ) { TestOptions = {}; }
	TestOptions.ReturnDocuments = true;

	let results = null;


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
	describe( 'N) MongoDB Reference', () =>
	{


		//---------------------------------------------------------------------
		describe( 'Comparison Query Operators', () =>
		{


			//---------------------------------------------------------------------
			describe( 'Comparison Operator: $eq (https://www.mongodb.com/docs/manual/reference/operator/query/eq/)', () =>
			{

				//---------------------------------------------------------------------
				describe( 'Equals an Array Value', () =>
				{

					//---------------------------------------------------------------------
					before(
						async function ()
						{
							let result = await reset_data(
								[
									{ _id: 1, item: { name: "ab", code: "123" }, qty: 15, tags: [ "A", "B", "C" ] },
									{ _id: 2, item: { name: "cd", code: "123" }, qty: 20, tags: [ "B" ] },
									{ _id: 3, item: { name: "ij", code: "456" }, qty: 25, tags: [ "A", "B" ] },
									{ _id: 4, item: { name: "xy", code: "456" }, qty: 30, tags: [ "B", "A" ] },
									{ _id: 5, item: { name: "mn", code: "000" }, qty: 20, tags: [ [ "A", "B" ], "C" ] },
								]
							);
							assert.ok( result );
							return;
						}
					);

					//---------------------------------------------------------------------
					it( 'Match an Array Element', async () => 
					{
						// queries the inventory collection to select all documents where the
						// tags array equals exactly the specified array or the tags array
						// contains an element that equals the array [ "A", "B" ]
						results = await Storage.FindMany(
							{
								tags: { $eq: [ "A", "B" ] }
							}, null, TestOptions );
						assert.ok( results.length === 2 );
						assert.ok( results[ 0 ]._id === 3 );
						assert.ok( results[ 1 ]._id === 5 );
					} );

					//---------------------------------------------------------------------
					it( 'Match an Array Element Using Implicit $eq', async () => 
					{
						results = await Storage.FindMany(
							{
								tags: [ "A", "B" ]
							}, null, TestOptions );
						assert.ok( results.length === 2 );
						assert.ok( results[ 0 ]._id === 3 );
						assert.ok( results[ 1 ]._id === 5 );
					} );

				} );

				//---------------------------------------------------------------------
				describe( 'Regex Match Behaviour', () =>
				{

					//---------------------------------------------------------------------
					before(
						async function ()
						{
							let result = await reset_data(
								[
									{ _id: 1, company: "MongoDB" },
									{ _id: 2, company: "MongoDB2" },
								]
							);
							assert.ok( result );
							return;
						}
					);

					//---------------------------------------------------------------------
					it( '$eq match on a string', async () => 
					{
						// A string expands to return the same values whether an implicit match
						// or an explicit use of $eq
						results = await Storage.FindMany(
							{
								company: "MongoDB",
							}, null, TestOptions );
						assert.ok( results.length === 1 );
						results = await Storage.FindMany(
							{
								company: { $eq: "MongoDB" },
							}, null, TestOptions );
						assert.ok( results.length === 1 );
					} );

					//---------------------------------------------------------------------
					//NOTE: Regular expression objects are not always supported.
					it( '$eq match on a regular expression', async () => 
					{
						// An explicit query using $eq and a regular expression will only match
						// an object which is also a regular expresssion
						results = await Storage.FindMany(
							{
								company: { $eq: /MongoDB/ }
							}, null, TestOptions );
						assert.ok( results.length === 0 );
					} );

					//---------------------------------------------------------------------
					it( 'Use the $in Operator with a Regular Expression', async () => 
					{
						// A query with an implicit match against a regular expression is
						// equivalent to making a query with the $regex operator

						//NOTE: Regular expression objects are not always supported.
						results = await Storage.FindMany(
							{
								company: /MongoDB/
							}, null, TestOptions );
						assert.ok( results.length === 2 );

						//NOTE: Regular expression objects are not always supported.
						results = await Storage.FindMany(
							{
								company: { $regex: /MongoDB/ }
							}, null, TestOptions );
						assert.ok( results.length === 2 );
					} );

				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Comparison Operator: $gt (https://www.mongodb.com/docs/manual/reference/operator/query/gt/)', () =>
			{

				//---------------------------------------------------------------------
				before(
					async function ()
					{
						let result = await reset_data(
							[
								{
									"item": "nuts", "quantity": 30,
									"carrier": { "name": "Shipit", "fee": 3 }
								},
								{
									"item": "bolts", "quantity": 50,
									"carrier": { "name": "Shipit", "fee": 4 }
								},
								{
									"item": "washers", "quantity": 10,
									"carrier": { "name": "Shipit", "fee": 1 }
								},
							]
						);
						assert.ok( result );
						return;
					}
				);

				//---------------------------------------------------------------------
				it( 'Match Document Fields', async () => 
				{
					// Select all documents in the inventory collection where quantity is greater than 20
					results = await Storage.FindMany(
						{
							quantity: { $gt: 20 }
						}, null, TestOptions );
					assert.ok( results.length === 2 );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Comparison Operator: $gte (https://www.mongodb.com/docs/manual/reference/operator/query/gte/)', () =>
			{

				//---------------------------------------------------------------------
				before(
					async function ()
					{
						let result = await reset_data(
							[
								{
									"item": "nuts", "quantity": 30,
									"carrier": { "name": "Shipit", "fee": 3 }
								},
								{
									"item": "bolts", "quantity": 50,
									"carrier": { "name": "Shipit", "fee": 4 }
								},
								{
									"item": "washers", "quantity": 10,
									"carrier": { "name": "Shipit", "fee": 1 }
								},
							]
						);
						assert.ok( result );
						return;
					}
				);

				//---------------------------------------------------------------------
				it( 'Match Document Fields', async () => 
				{
					// Select all documents in the inventory collection where quantity is greater than or equal to 20
					results = await Storage.FindMany(
						{
							quantity: { $gte: 20 }
						}, null, TestOptions );
					assert.ok( results.length === 2 );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Comparison Operator: $in (https://www.mongodb.com/docs/manual/reference/operator/query/in/)', () =>
			{

				//---------------------------------------------------------------------
				before(
					async function ()
					{
						let result = await reset_data(
							[
								{ "item": "Pens", "quantity": 350, "tags": [ "school", "office" ] },
								{ "item": "Erasers", "quantity": 15, "tags": [ "school", "home" ] },
								{ "item": "Maps", "tags": [ "office", "storage" ] },
								{ "item": "Books", "quantity": 5, "tags": [ "school", "storage", "home" ] },
							]
						);
						assert.ok( result );
						return;
					}
				);

				//---------------------------------------------------------------------
				it( 'Use the $in Operator to Match Values', async () => 
				{
					// selects all documents in the inventory collection where the value
					// of the quantity field is either 5 or 15
					results = await Storage.FindMany(
						{
							quantity: { $in: [ 5, 15 ] }
						}, null, TestOptions );
					assert.ok( results.length === 2 );
				} );

				//---------------------------------------------------------------------
				it( 'Use the $in Operator to Match Values in an Array', async () => 
				{
					// has at least one element that matches either "home" or "school"
					results = await Storage.FindMany(
						{
							tags: { $in: [ "home", "school" ] }
						}, null, TestOptions );
					assert.ok( results.length === 3 );
				} );

				//---------------------------------------------------------------------
				//NOTE: Regular expression objects are not always supported.
				it( 'Use the $in Operator with a Regular Expression', async () => 
				{
					// selects all documents in the inventory collection where the tags
					// field holds either a string that starts with be or st or an array
					// with at least one element that starts with be or st
					results = await Storage.FindMany(
						{
							tags: { $in: [ /^be/, /^st/ ] }
						}, null, TestOptions );
					assert.ok( results.length === 2 );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Comparison Operator: $lt (https://www.mongodb.com/docs/manual/reference/operator/query/lt/)', () =>
			{

				//---------------------------------------------------------------------
				before(
					async function ()
					{
						let result = await reset_data(
							[
								{
									"item": "nuts", "quantity": 30,
									"carrier": { "name": "Shipit", "fee": 3 }
								},
								{
									"item": "bolts", "quantity": 50,
									"carrier": { "name": "Shipit", "fee": 4 }
								},
								{
									"item": "washers", "quantity": 10,
									"carrier": { "name": "Shipit", "fee": 1 }
								},
							]
						);
						assert.ok( result );
						return;
					}
				);

				//---------------------------------------------------------------------
				it( 'Match Document Fields', async () => 
				{
					// Select all documents in the inventory collection where quantity is less than 20
					results = await Storage.FindMany(
						{
							quantity: { $lt: 20 }
						}, null, TestOptions );
					assert.ok( results.length === 1 );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Comparison Operator: $lte (https://www.mongodb.com/docs/manual/reference/operator/query/lte/)', () =>
			{

				//---------------------------------------------------------------------
				before(
					async function ()
					{
						let result = await reset_data(
							[
								{
									"item": "nuts", "quantity": 30,
									"carrier": { "name": "Shipit", "fee": 3 }
								},
								{
									"item": "bolts", "quantity": 50,
									"carrier": { "name": "Shipit", "fee": 4 }
								},
								{
									"item": "washers", "quantity": 10,
									"carrier": { "name": "Shipit", "fee": 1 }
								},
							]
						);
						assert.ok( result );
						return;
					}
				);

				//---------------------------------------------------------------------
				it( 'Match Document Fields', async () => 
				{
					// Select all documents in the inventory collection where quantity is less than or equal to 20
					results = await Storage.FindMany(
						{
							quantity: { $lte: 20 }
						}, null, TestOptions );
					assert.ok( results.length === 1 );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Comparison Operator: $ne (https://www.mongodb.com/docs/manual/reference/operator/query/ne/)', () =>
			{


				//---------------------------------------------------------------------
				before(
					async function ()
					{
						let result = await reset_data(
							[
								{
									"item": "nuts", "quantity": 30,
									"carrier": { "name": "Shipit", "fee": 3 }
								},
								{
									"item": "bolts", "quantity": 50,
									"carrier": { "name": "Shipit", "fee": 4 }
								},
								{
									"item": "washers", "quantity": 10,
									"carrier": { "name": "Shipit", "fee": 1 }
								},
							]
						);
						assert.ok( result );
						return;
					}
				);


				//---------------------------------------------------------------------
				it( 'Match Document Fields', async () => 
				{
					// Select all documents in the inventory collection where quantity is not equal to 20.
					// The query will also select documents that do not have the quantity field
					results = await Storage.FindMany(
						{
							quantity: { $ne: 20 }
						}, null, TestOptions );
					assert.ok( results.length === 3 );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Comparison Operator: $nin (https://www.mongodb.com/docs/manual/reference/operator/query/nin/)', () =>
			{

				//---------------------------------------------------------------------
				before(
					async function ()
					{
						let result = await reset_data(
							[
								{ "item": "Pens", "quantity": 350, "tags": [ "school", "office" ] },
								{ "item": "Erasers", "quantity": 15, "tags": [ "school", "home" ] },
								{ "item": "Maps", "tags": [ "office", "storage" ] },
								{ "item": "Books", "quantity": 5, "tags": [ "school", "storage", "home" ] },
							]
						);
						assert.ok( result );
						return;
					}
				);

				//---------------------------------------------------------------------
				it( 'Select on Unmatching Documents', async () => 
				{
					// selects all documents from the inventory collection where the quantity does not equal either 5 or 15
					results = await Storage.FindMany(
						{
							quantity: { $nin: [ 5, 15 ] }
						}, null, TestOptions );
					assert.ok( results.length === 2 );
					assert.ok( results[ 0 ].quantity === 350 );
					assert.ok( results[ 1 ].quantity === undefined );
				} );

				//---------------------------------------------------------------------
				it( 'Select on Elements Not in an Array', async () => 
				{
					// selects all documents from the inventory collection where the quantity does not equal either 5 or 15
					results = await Storage.FindMany(
						{
							tags: { $nin: [ "school" ] }
						}, null, TestOptions );
					assert.ok( results.length === 1 );
					assert.ok( results[ 0 ].item === 'Maps' );
				} );

			} );


		} );


		//---------------------------------------------------------------------
		describe( 'Logical Query Operators', () =>
		{


			//---------------------------------------------------------------------
			before(
				async function ()
				{
					let result = await reset_data(
						[
							{
								"item": "nuts", "quantity": 30,
								price: 20, sale: true,
								"carrier": { "name": "Shipit", "fee": 3 }
							},
							{
								"item": "bolts", "quantity": 50,
								price: 1.99, sale: false,
								"carrier": { "name": "Shipit", "fee": 4 }
							},
							{
								"item": "washers", "quantity": 10,
								sale: false,
								"carrier": { "name": "Shipit", "fee": 1 }
							},
							{
								"item": "dryers", "quantity": 3,
								price: 60, sale: true,
								"carrier": { "name": "Shipit", "fee": 10 }
							},
							{
								"item": "plutonium", "quantity": 1,
								price: 60000000, sale: false,
								"carrier": { "name": "Shipit", "fee": 1000000 }
							},
						]
					);
					assert.ok( result );
					return;
				}
			);


			//---------------------------------------------------------------------
			describe( 'Logical Operator: $and (https://www.mongodb.com/docs/manual/reference/operator/query/and/)', () =>
			{

				//---------------------------------------------------------------------
				it( 'AND Queries With Multiple Expressions Specifying the Same Field', async () => 
				{
					// selects all documents in the inventory collection where:
					// - the price field value is not equal to 1.99 and
					// - the price field exists
					results = await Storage.FindMany(
						{
							$and:
								[
									{ price: { $ne: 1.99 } },
									{ price: { $exists: true } }
								]
						}, null, TestOptions );
					assert.ok( results.length === 3 );
					assert.ok( results[ 0 ].item === 'nuts' );
					assert.ok( results[ 1 ].item === 'dryers' );
					assert.ok( results[ 2 ].item === 'plutonium' );
					// query can be rewritten with an implicit AND operation that combines
					// the operator expressions for the price field
					results = await Storage.FindMany(
						{
							price: { $ne: 1.99, $exists: true },
						}, null, TestOptions );
					assert.ok( results.length === 3 );
					assert.ok( results[ 0 ].item === 'nuts' );
					assert.ok( results[ 1 ].item === 'dryers' );
					assert.ok( results[ 2 ].item === 'plutonium' );
				} );

				//---------------------------------------------------------------------
				it( 'AND Queries With Multiple Expressions Specifying the Same Operator', async () => 
				{
					// selects all documents in the inventory collection where:
					// - the qty field value is less than 10 or greater than 50, and
					// - the sale field value is equal to true or the price field value is less than 5
					results = await Storage.FindMany(
						{
							$and:
								[
									{
										$or:
											[
												{ quantity: { $lt: 10 } },
												{ quantity: { $gt: 50 } }
											]
									},
									{
										$or:
											[
												{ sale: true },
												{ price: { $lt: 5 } }
											]
									},
								],
						}, null, TestOptions );
					assert.ok( results.length === 1 );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Logical Operator: $not (https://www.mongodb.com/docs/manual/reference/operator/query/not/)', () =>
			{

				//---------------------------------------------------------------------
				it( 'Match Document Fields', async () => 
				{
					// selects all documents in the inventory collection where:
					// - the price field value is less than or equal to 1.99 or
					// - the price field does not exist
					results = await Storage.FindMany(
						{
							price: { $not: { $gt: 1.99 } },
						}, null, TestOptions );
					assert.ok( results.length === 2 );
				} );

				//---------------------------------------------------------------------
				it( '$not and Regular Expressions', async () => 
				{
					// selects all documents in the inventory collection where the item
					// field value does not start with the letter p

					//NOTE: Regular expression objects are not always supported.
					results = await Storage.FindMany(
						{
							item: { $not: /^p.*/ },
						}, null, TestOptions );
					assert.ok( results.length === 4 );
					assert.ok( results[ 0 ].item === 'nuts' );
					assert.ok( results[ 1 ].item === 'bolts' );
					assert.ok( results[ 2 ].item === 'washers' );
					assert.ok( results[ 3 ].item === 'dryers' );

					// Equivalent to:
					results = await Storage.FindMany(
						{
							item: { $not: { $regex: "^p.*" } },
						}, null, TestOptions );
					assert.ok( results.length === 4 );
					assert.ok( results[ 0 ].item === 'nuts' );
					assert.ok( results[ 1 ].item === 'bolts' );
					assert.ok( results[ 2 ].item === 'washers' );
					assert.ok( results[ 3 ].item === 'dryers' );

					//NOTE: Regular expression objects are not always supported.
					// Equivalent to:
					results = await Storage.FindMany(
						{
							item: { $not: { $regex: /^p.*/ } },
						}, null, TestOptions );
					assert.ok( results.length === 4 );
					assert.ok( results[ 0 ].item === 'nuts' );
					assert.ok( results[ 1 ].item === 'bolts' );
					assert.ok( results[ 2 ].item === 'washers' );
					assert.ok( results[ 3 ].item === 'dryers' );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Logical Operator: $nor (https://www.mongodb.com/docs/manual/reference/operator/query/nor/)', () =>
			{

				//---------------------------------------------------------------------
				it( '$nor Query with Two Expressions', async () => 
				{
					// selects all documents in the inventory collection where:
					// - contain the price field whose value is not equal to 1.99 and contain the sale field whose value is not equal to true or
					// - contain the price field whose value is not equal to 1.99 but do not contain the sale field or
					// - do not contain the price field but contain the sale field whose value is not equal to true or
					// - do not contain the price field and do not contain the sale field
					results = await Storage.FindMany(
						{
							$nor:
								[
									{ price: 1.99 },
									{ sale: true },
								]
						}, null, TestOptions );
					assert.ok( results.length === 2 );
				} );

				//---------------------------------------------------------------------
				it( '$nor and Additional Comparisons', async () => 
				{
					// selects all documents in the inventory collection where:
					// - the price field value does not equal 1.99 and
					// - the qty field value is not less than 20 and
					// - the sale field value is not equal to true
					// including those documents that do not contain these field(s)
					results = await Storage.FindMany(
						{
							$nor:
								[
									{ price: 1.99 },
									{ qty: { $lt: 20 } },
									{ sale: true },
								]
						}, null, TestOptions );
					assert.ok( results.length === 2 );
				} );

				//---------------------------------------------------------------------
				it( '$nor and $exists', async () => 
				{
					// selects all documents in the inventory collection where:
					// - document contains the price field whose value is not equal to 1.99 and
					// - document contains the sale field whose value is not equal to true
					results = await Storage.FindMany(
						{
							$nor:
								[
									{ price: 1.99 },
									{ price: { $exists: false } },
									{ sale: true },
									{ sale: { $exists: false } },
								]
						}, null, TestOptions );
					assert.ok( results.length === 1 );
					assert.ok( results[ 0 ].item === 'plutonium' );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Logical Operator: $or (https://www.mongodb.com/docs/manual/reference/operator/query/or/)', () =>
			{

				//---------------------------------------------------------------------
				it( 'Match Document Fields', async () => 
				{
					// select all documents in the inventory collection where either
					// the quantity field value is less than 20 or the price field value equals 10
					results = await Storage.FindMany(
						{
							$or:
								[
									{ quantity: { $lt: 20 } },
									{ price: 10 }
								]
						}, null, TestOptions );
					assert.ok( results.length === 3 );
				} );

				//---------------------------------------------------------------------
				it( '$or versus $in', async () => 
				{
					// select all documents in the inventory collection where the quantity field value equals either 20 or 50
					results = await Storage.FindMany(
						{
							$or:
								[
									{ quantity: 20 },
									{ quantity: 50 },
								]
						}, null, TestOptions );
					assert.ok( results.length === 1 );
					// Equivalent to:
					results = await Storage.FindMany(
						{
							quantity: { $in: [ 20, 50 ] },
						}, null, TestOptions );
					assert.ok( results.length === 1 );
				} );

				//---------------------------------------------------------------------
				it( 'Nested $or Clauses', async () => 
				{
					// You may nest $or operations
					results = await Storage.FindMany(
						{
							$or:
								[
									{
										$or:
											[
												{ quantity: 20 },
												{ quantity: 50 }
											]
									},
									{ price: { $gt: 50 } }
								]
						}, null, TestOptions );
					assert.ok( results.length === 3 );
				} );

			} );


		} );


		//---------------------------------------------------------------------
		describe( 'Element Query Operators', () =>
		{


			//---------------------------------------------------------------------
			describe( 'Element Query Operator: $exists (https://www.mongodb.com/docs/manual/reference/operator/query/exists/)', () =>
			{

				//---------------------------------------------------------------------
				it( 'Exists and Not Equal To', async () => 
				{
					let result = await reset_data(
						[
							{
								"item": "nuts", "quantity": 5,
								price: 20, sale: true,
								"carrier": { "name": "Shipit", "fee": 3 }
							},
							{
								"item": "bolts", "quantity": 10,
								price: 1.99, sale: false,
								"carrier": { "name": "Shipit", "fee": 4 }
							},
							{
								"item": "washers", "quantity": 15,
								sale: false,
								"carrier": { "name": "Shipit", "fee": 1 }
							},
						]
					);
					assert.ok( result );

					// select all documents in the inventory collection where the qty field
					// exists and its value does not equal 5 or 15
					results = await Storage.FindMany(
						{
							quantity: { $exists: true, $nin: [ 5, 15 ] }
						}, null, TestOptions );
					assert.ok( results.length === 1 );
				} );

				//---------------------------------------------------------------------
				it( 'Null Values', async () => 
				{
					let result = await reset_data(
						[
							{ saffron: 5, cinnamon: 5, mustard: null },
							{ saffron: 3, cinnamon: null, mustard: 8 },
							{ saffron: null, cinnamon: 3, mustard: 9 },
							{ saffron: 1, cinnamon: 2, mustard: 3 },
							{ saffron: 2, mustard: 5 },
							{ saffron: 3, cinnamon: 2 },
							{ saffron: 4 },
							{ cinnamon: 2, mustard: 4 },
							{ cinnamon: 2 },
							{ mustard: 6 },
						]
					);
					assert.ok( result );

					// results consist of those documents that contain the field saffron,
					// including the document whose field saffron contains a null value
					results = await Storage.FindMany(
						{
							saffron: { $exists: true },
						}, null, TestOptions );
					assert.ok( results.length === 7 );

					// results consist of those documents that do not contain the field cinnamon
					results = await Storage.FindMany(
						{
							cinnamon: { $exists: false },
						}, null, TestOptions );
					assert.ok( results.length === 3 );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Element Query Operator: $type (https://www.mongodb.com/docs/manual/reference/operator/query/type/)', () =>
			{

				//---------------------------------------------------------------------
				before(
					async function ()
					{
						let result = await reset_data(
							[
								//NOTE: Difference from official docs.
								// MongoDB v4 does not support the NumberLong() and NumberInt() functions.
								{ "_id": 1, address: "2030 Martian Way", zipCode: "90698345" },
								{ "_id": 2, address: "156 Lunar Place", zipCode: 43339374 },
								{ "_id": 3, address: "2324 Pluto Place", zipCode: 3921412 },
								{ "_id": 4, address: "55 Saturn Ring", zipCode: 88602117 },
								{ "_id": 5, address: "104 Venus Drive", zipCode: [ "834847278", "1893289032" ] },
							]
						);
						assert.ok( result );
						return;
					}
				);


				//---------------------------------------------------------------------
				it( 'Querying by Data Type (BSON Code)', async () => 
				{
					// return all documents where zipCode is the BSON type string or is
					// an array containing an element of the specified type
					results = await Storage.FindMany(
						{
							zipCode: { $type: 2 },
						}, null, TestOptions );
					assert.ok( results.length === 2 /* string */ );
					assert.ok( results[ 0 ]._id === 1 );
					assert.ok( results[ 1 ]._id === 5 );

					// return all documents where zipCode is the BSON type double or is
					// an array containing an element of the specified type:
					results = await Storage.FindMany(
						{
							//NOTE: Difference from official docs.
							// Changed type from 1 to 16.
							zipCode: { $type: 16 /* int */ },
						}, null, TestOptions );
					assert.ok( results.length === 3 );
					assert.ok( results[ 0 ]._id === 2 );
					assert.ok( results[ 1 ]._id === 3 );
					assert.ok( results[ 2 ]._id === 4 );
				} );

				//---------------------------------------------------------------------
				it( 'Querying by Data Type (BSON Alias)', async () => 
				{
					// return all documents where zipCode is the BSON type string or is
					// an array containing an element of the specified type
					results = await Storage.FindMany(
						{
							zipCode: { $type: 'string' },
						}, null, TestOptions );
					assert.ok( results.length === 2 );
					assert.ok( results[ 0 ]._id === 1 );
					assert.ok( results[ 1 ]._id === 5 );

					// return all documents where zipCode is the BSON type double or is
					// an array containing an element of the specified type:
					results = await Storage.FindMany(
						{
							//NOTE: Difference from official docs.
							// Changed type from 'double' to 'int'.
							zipCode: { $type: 'int' },
						}, null, TestOptions );
					assert.ok( results.length === 3 );
					assert.ok( results[ 0 ]._id === 2 );
					assert.ok( results[ 1 ]._id === 3 );
					assert.ok( results[ 2 ]._id === 4 );
				} );

				//---------------------------------------------------------------------
				it( 'Querying by Data Type ("number")', async () => 
				{
					// return all documents where zipCode is the BSON type string or is
					// an array containing an element of the specified type
					results = await Storage.FindMany(
						{
							zipCode: { $type: 'number' },
						}, null, TestOptions );
					assert.ok( results.length === 3 );
					assert.ok( results[ 0 ]._id === 2 );
					assert.ok( results[ 1 ]._id === 3 );
					assert.ok( results[ 2 ]._id === 4 );
				} );

				//---------------------------------------------------------------------
				it( 'Querying by Multiple Data Type (BSON Code)', async () => 
				{
					let result = await reset_data(
						[
							//NOTE: Difference from official docs.
							// MongoDB v4 does not support the NumberLong() and NumberInt() functions.
							{ "_id": 1, name: "Alice King", classAverage: 87.333333333333333 },
							{ "_id": 2, name: "Bob Jenkins", classAverage: "83.52" },
							{ "_id": 3, name: "Cathy Hart", classAverage: "94.06" },
							{ "_id": 4, name: "Drew Williams", classAverage: 93 },
						]
					);
					assert.ok( result );

					// return all documents where classAverage is the BSON type string or
					// double or is an array containing an element of the specified types
					results = await Storage.FindMany(
						{
							classAverage: { $type: [ 2, 1 ] },
						}, null, TestOptions );
					assert.ok( results.length === 3 );
				} );

				//---------------------------------------------------------------------
				it( 'Querying by Multiple Data Type (BSON Alias)', async () => 
				{
					let result = await reset_data(
						[
							//NOTE: Difference from official docs.
							// MongoDB v4 does not support the NumberLong() and NumberInt() functions.
							{ "_id": 1, name: "Alice King", classAverage: 87.333333333333333 },
							{ "_id": 2, name: "Bob Jenkins", classAverage: "83.52" },
							{ "_id": 3, name: "Cathy Hart", classAverage: "94.06" },
							{ "_id": 4, name: "Drew Williams", classAverage: 93 },
						]
					);
					assert.ok( result );

					// return all documents where classAverage is the BSON type string or
					// double or is an array containing an element of the specified types
					results = await Storage.FindMany(
						{
							classAverage: { $type: [ 'string', 'double' ] },
						}, null, TestOptions );
					assert.ok( results.length === 3 );
				} );

			} );


		} );


		//---------------------------------------------------------------------
		describe( 'Array Query Operators', () =>
		{


			//---------------------------------------------------------------------
			describe( 'Array Query Operator: $all (https://www.mongodb.com/docs/manual/reference/operator/query/all/)', () =>
			{


				//---------------------------------------------------------------------
				before(
					async function ()
					{
						//NOTE: Difference from official docs.
						// MongoDB v4 does not support the ObjectId() function.
						let result = await reset_data(
							[
								{
									code: "xyz",
									tags: [ "school", "book", "bag", "headphone", "appliance" ],
									qty: [
										{ size: "S", num: 10, color: "blue" },
										{ size: "M", num: 45, color: "blue" },
										{ size: "L", num: 100, color: "green" }
									]
								},
								{
									code: "abc",
									tags: [ "appliance", "school", "book" ],
									qty: [
										{ size: "6", num: 100, color: "green" },
										{ size: "6", num: 50, color: "blue" },
										{ size: "8", num: 100, color: "brown" }
									]
								},
								{
									code: "efg",
									tags: [ "school", "book" ],
									qty: [
										{ size: "S", num: 10, color: "blue" },
										{ size: "M", num: 100, color: "blue" },
										{ size: "L", num: 100, color: "green" }
									]
								},
								{
									code: "ijk",
									tags: [ "electronics", "school" ],
									qty: [
										{ size: "M", num: 100, color: "green" }
									]
								},
							]
						);
						assert.ok( result );
						return;
					}
				);


				//---------------------------------------------------------------------
				it( 'Use $all to Match Values', async () => 
				{
					// documents where the value of the tags field is an array whose elements
					// include appliance, school, and book
					results = await Storage.FindMany(
						{
							tags: { $all: [ 'appliance', 'school', 'book' ] }
						}, null, TestOptions );
					assert.ok( results.length === 2 );
					assert.ok( results[ 0 ].code === 'xyz' );
					assert.ok( results[ 1 ].code === 'abc' );
				} );

				//---------------------------------------------------------------------
				it( 'Use $all with $elemMatch', async () => 
				{
					// documents where the value of the qty field is an array whose elements
					// match the $elemMatch criteria
					results = await Storage.FindMany(
						{
							qty:
							{
								$all:
									[
										{ $elemMatch: { size: "M", num: { $gt: 50 } } },
										{ $elemMatch: { num: 100, color: "green" } }
									]
							}
						}, null, TestOptions );
					assert.ok( results.length === 2 );
					assert.ok( results[ 0 ].code === 'efg' );
					assert.ok( results[ 1 ].code === 'ijk' );
				} );

				//---------------------------------------------------------------------
				it( 'Use $all with Scalar Values', async () => 
				{
					// documents in the inventory collection where the value of the num field equals 50
					// you may use the $all operator to select against a non-array field
					results = await Storage.FindMany(
						{
							"qty.num": { $all: [ 50 ] }
						}, null, TestOptions );
					assert.ok( results.length === 1 );
					assert.ok( results[ 0 ].code === 'abc' );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Array Query Operator: $elemMatch (https://www.mongodb.com/docs/manual/reference/operator/query/elemMatch/)', () =>
			{

				//---------------------------------------------------------------------
				it( 'Element Match', async () => 
				{
					let result = await reset_data(
						[
							{ _id: 1, results: [ 82, 85, 88 ] },
							{ _id: 2, results: [ 75, 88, 89 ] },
						]
					);
					assert.ok( result );

					// documents where the results array contains at least one element
					// that is both greater than or equal to 80 and is less than 85
					results = await Storage.FindMany(
						{
							results: { $elemMatch: { $gte: 80, $lt: 85 } }
						}, null, TestOptions );
					assert.ok( results.length === 1 );
				} );

				//---------------------------------------------------------------------
				it( 'Array of Embedded Documents', async () => 
				{
					let result = await reset_data(
						[
							{ _id: 1, results: [ { product: 'abc', score: 10 }, { product: 'xyz', score: 5 } ] },
							{ _id: 2, results: [ { product: 'abc', score: 8 }, { product: 'xyz', score: 7 } ] },
							{ _id: 3, results: [ { product: 'abc', score: 7 }, { product: 'xyz', score: 8 } ] },
							{ _id: 4, results: [ { product: 'abc', score: 7 }, { product: 'def', score: 8 } ] }
						]
					);
					assert.ok( result );

					// documents where the results array contains at least one element
					// with both product equal to "xyz" and score greater than or equal to 8
					results = await Storage.FindMany(
						{
							results: { $elemMatch: { product: "xyz", score: { $gte: 8 } } }
						}, null, TestOptions );
					assert.ok( results.length === 1 );
					assert.ok( results[ 0 ]._id === 3 );
				} );

				//---------------------------------------------------------------------
				it( 'Single Query Condition', async () => 
				{
					let result = await reset_data(
						[
							{ _id: 1, results: [ { product: 'abc', score: 10 }, { product: 'xyz', score: 5 } ] },
							{ _id: 2, results: [ { product: 'abc', score: 8 }, { product: 'xyz', score: 7 } ] },
							{ _id: 3, results: [ { product: 'abc', score: 7 }, { product: 'xyz', score: 8 } ] },
							{ _id: 4, results: [ { product: 'abc', score: 7 }, { product: 'def', score: 8 } ] }
						]
					);
					assert.ok( result );

					// documents where a product is equal to "xyz"
					results = await Storage.FindMany(
						{
							results: { $elemMatch: { product: "xyz" } }
						}, null, TestOptions );
					assert.ok( results.length === 3 );
					assert.ok( results[ 0 ]._id === 1 );
					assert.ok( results[ 1 ]._id === 2 );
					assert.ok( results[ 2 ]._id === 3 );

					// documents where a product is not equal to "xyz"
					results = await Storage.FindMany(
						{
							results: { $elemMatch: { product: { $ne: "xyz" } } }
						}, null, TestOptions );
					assert.ok( results.length === 4 );
					assert.ok( results[ 0 ]._id === 1 );
					assert.ok( results[ 1 ]._id === 2 );
					assert.ok( results[ 2 ]._id === 3 );
					assert.ok( results[ 3 ]._id === 4 );
				} );

			} );


			//---------------------------------------------------------------------
			describe( 'Array Query Operator: $size (https://www.mongodb.com/docs/manual/reference/operator/query/size/)', () =>
			{

				//---------------------------------------------------------------------
				it( 'Use $size to Match Array Sizes', async () => 
				{
					let result = await reset_data(
						[
							{ _id: 1, results: [ 82, 85, 88 ] },
							{ _id: 2, results: [ 75, 88, 89 ] },
							{ _id: 3, results: [ 62 ] },
							{ _id: 4, results: [] },
							{ _id: 5, results: 95 },
						]
					);
					assert.ok( result );

					// documents where result is an array and has a size of 0
					results = await Storage.FindMany(
						{
							results: { $size: 0 }
						}, null, TestOptions );
					assert.ok( results.length === 1 );

					// documents where result is an array and has a size of 1
					results = await Storage.FindMany(
						{
							results: { $size: 1 }
						}, null, TestOptions );
					assert.ok( results.length === 1 );

					// documents where result is an array and has a size of 2
					results = await Storage.FindMany(
						{
							results: { $size: 2 }
						}, null, TestOptions );
					assert.ok( results.length === 0 );

					// documents where result is an array and has a size of 3
					results = await Storage.FindMany(
						{
							results: { $size: 3 }
						}, null, TestOptions );
					assert.ok( results.length === 2 );
				} );

			} );


		} );


	} );


};

