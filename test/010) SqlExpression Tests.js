'use strict';

const assert = require( 'assert' );
const jsonstor = require( '../src/jsonstor' )();


describe( '010) SqlExpression Tests', () =>
{


	//---------------------------------------------------------------------
	it( `It should return an expression for boolean values`, () => 
	{
		assert.strictEqual( jsonstor.SqlExpression( false ), 'FALSE' );
		assert.strictEqual( jsonstor.SqlExpression( true ), 'TRUE' );
	} );


	//---------------------------------------------------------------------
	it( `It should return an expression for number values`, () => 
	{
		assert.strictEqual( jsonstor.SqlExpression( 0 ), '0' );
		assert.strictEqual( jsonstor.SqlExpression( 3.14 ), '3.14' );
	} );


	//---------------------------------------------------------------------
	it( `It should return an expression for string values`, () => 
	{
		assert.strictEqual( jsonstor.SqlExpression( 'Hello World!' ), '"Hello World!"' );
	} );


	//---------------------------------------------------------------------
	it( `It should return an expression for null values`, () => 
	{
		assert.strictEqual( jsonstor.SqlExpression( null ), 'NULL' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $ImplicitEq operator`, () => 
	{
		assert.strictEqual( jsonstor.SqlExpression( { active: true } ), '(active = TRUE)' );
		assert.strictEqual( jsonstor.SqlExpression( { id: 1001 } ), '(id = 1001)' );
		assert.strictEqual( jsonstor.SqlExpression( { name: 'Alice' } ), '(name = "Alice")' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $eq operator`, () => 
	{
		assert.strictEqual( jsonstor.SqlExpression( { active: { $eq: true } } ), '(active = TRUE)' );
		assert.strictEqual( jsonstor.SqlExpression( { id: { $eq: 1001 } } ), '(id = 1001)' );
		assert.strictEqual( jsonstor.SqlExpression( { name: { $eq: 'Alice' } } ), '(name = "Alice")' );
		assert.strictEqual( jsonstor.SqlExpression( { value: { $eq: null } } ), '(value = NULL)' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $eqx operator`, () => 
	{
		assert.strictEqual( jsonstor.SqlExpression( { active: { $eqx: true } } ), '(active = TRUE)' );
		assert.strictEqual( jsonstor.SqlExpression( { id: { $eqx: 1001 } } ), '(id = 1001)' );
		assert.strictEqual( jsonstor.SqlExpression( { name: { $eqx: 'Alice' } } ), '(name = "Alice")' );
		assert.strictEqual( jsonstor.SqlExpression( { value: { $eqx: null } } ), '(value = NULL)' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $ne operator`, () => 
	{
		assert.strictEqual( jsonstor.SqlExpression( { active: { $ne: true } } ), '(active <> TRUE)' );
		assert.strictEqual( jsonstor.SqlExpression( { id: { $ne: 1001 } } ), '(id <> 1001)' );
		assert.strictEqual( jsonstor.SqlExpression( { name: { $ne: 'Alice' } } ), '(name <> "Alice")' );
		assert.strictEqual( jsonstor.SqlExpression( { value: { $ne: null } } ), '(value <> NULL)' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $nex operator`, () => 
	{
		assert.strictEqual( jsonstor.SqlExpression( { active: { $nex: true } } ), '(active <> TRUE)' );
		assert.strictEqual( jsonstor.SqlExpression( { id: { $nex: 1001 } } ), '(id <> 1001)' );
		assert.strictEqual( jsonstor.SqlExpression( { name: { $nex: 'Alice' } } ), '(name <> "Alice")' );
		assert.strictEqual( jsonstor.SqlExpression( { value: { $nex: null } } ), '(value <> NULL)' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $lt operator`, () => 
	{
		assert.strictEqual( jsonstor.SqlExpression( { active: { $lt: true } } ), '(active < TRUE)' );
		assert.strictEqual( jsonstor.SqlExpression( { id: { $lt: 1001 } } ), '(id < 1001)' );
		assert.strictEqual( jsonstor.SqlExpression( { name: { $lt: 'Alice' } } ), '(name < "Alice")' );
		assert.strictEqual( jsonstor.SqlExpression( { value: { $lt: null } } ), '(value < NULL)' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $lte operator`, () => 
	{
		assert.strictEqual( jsonstor.SqlExpression( { active: { $lte: true } } ), '(active <= TRUE)' );
		assert.strictEqual( jsonstor.SqlExpression( { id: { $lte: 1001 } } ), '(id <= 1001)' );
		assert.strictEqual( jsonstor.SqlExpression( { name: { $lte: 'Alice' } } ), '(name <= "Alice")' );
		assert.strictEqual( jsonstor.SqlExpression( { value: { $lte: null } } ), '(value <= NULL)' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $gt operator`, () => 
	{
		assert.strictEqual( jsonstor.SqlExpression( { active: { $gt: true } } ), '(active > TRUE)' );
		assert.strictEqual( jsonstor.SqlExpression( { id: { $gt: 1001 } } ), '(id > 1001)' );
		assert.strictEqual( jsonstor.SqlExpression( { name: { $gt: 'Alice' } } ), '(name > "Alice")' );
		assert.strictEqual( jsonstor.SqlExpression( { value: { $gt: null } } ), '(value > NULL)' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $gte operator`, () => 
	{
		assert.strictEqual( jsonstor.SqlExpression( { active: { $gte: true } } ), '(active >= TRUE)' );
		assert.strictEqual( jsonstor.SqlExpression( { id: { $gte: 1001 } } ), '(id >= 1001)' );
		assert.strictEqual( jsonstor.SqlExpression( { name: { $gte: 'Alice' } } ), '(name >= "Alice")' );
		assert.strictEqual( jsonstor.SqlExpression( { value: { $gte: null } } ), '(value >= NULL)' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $in operator`, () => 
	{
		assert.strictEqual( jsonstor.SqlExpression( { rating: { $in: [ 1, 2, 3, 4, 5 ] } } ), '(rating IN (1, 2, 3, 4, 5))' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $nin operator`, () => 
	{
		assert.strictEqual( jsonstor.SqlExpression( { rating: { $nin: [ 1, 2, 3, 4, 5 ] } } ), '(NOT (rating IN (1, 2, 3, 4, 5)))' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the implicit $and operator`, () => 
	{
		let criteria = {
			rating: {
				$gte: 1,
				$lte: 5,
			},
		};
		let expr = jsonstor.SqlExpression( criteria );
		assert.strictEqual( expr, '((rating >= 1) AND (rating <= 5))' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $and operator`, () => 
	{
		let criteria = {
			rating: {
				$and: [
					{ $gte: 1 },
					{ $lte: 5 },
				],
			},
		};
		let expr = jsonstor.SqlExpression( criteria );
		assert.strictEqual( expr, '((rating >= 1) AND (rating <= 5))' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $or operator`, () => 
	{
		let criteria = {
			rating: {
				$or: [
					{ $gte: 1 },
					{ $lte: 5 },
				],
			},
		};
		let expr = jsonstor.SqlExpression( criteria );
		assert.strictEqual( expr, '((rating >= 1) OR (rating <= 5))' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $nor operator`, () => 
	{
		let criteria = {
			rating: {
				$nor: [
					{ $gte: 1 },
					{ $lte: 5 },
				],
			},
		};
		let expr = jsonstor.SqlExpression( criteria );
		assert.strictEqual( expr, '(NOT ((rating >= 1) OR (rating <= 5)))' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $not operator`, () => 
	{
		let criteria = {
			rating: {
				$not: { $gte: 1 },
			},
		};
		let expr = jsonstor.SqlExpression( criteria );
		assert.strictEqual( expr, '(NOT (rating >= 1))' );
	} );


	//---------------------------------------------------------------------
	it( `It should support complex logic`, () => 
	{
		let criteria = {
			rating: {
				$ne: 2,
				$or: [
					{ $gte: 1 },
					{ $lte: 5 },
				],
			},
		};
		let expr = jsonstor.SqlExpression( criteria );
		assert.strictEqual( expr, '((rating <> 2) AND ((rating >= 1) OR (rating <= 5)))' );
	} );


	//---------------------------------------------------------------------
	it( `It should ignore document paths by default`, () => 
	{
		let criteria = {
			rating: { $ne: 2 },
			'user.name': 3.14,
		};
		let expr = jsonstor.SqlExpression( criteria );
		assert.strictEqual( expr, '(rating <> 2)' );
	} );


	//---------------------------------------------------------------------
	it( `It should use custom identifier quotes`, () => 
	{
		let criteria = { name: 'Alice' };
		let expr = jsonstor.SqlExpression( criteria, { IdentifierQuotes: '`' } );
		assert.strictEqual( expr, '(`name` = "Alice")' );
	} );


	//---------------------------------------------------------------------
	it( `It should use custom string literal quotes`, () => 
	{
		let criteria = { name: 'Alice' };
		let expr = jsonstor.SqlExpression( criteria, { StringLiteralQuotes: "'" } );
		assert.strictEqual( expr, `(name = 'Alice')` );
	} );


} );
