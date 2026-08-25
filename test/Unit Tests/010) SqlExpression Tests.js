'use strict';

const assert = require( 'assert' );
const jsonstor = require( '../../src/jsonstor' )();


describe( '010) SqlExpression Tests', function ()
{


	//---------------------------------------------------------------------
	it( `It should return an expression for boolean values`, function ()
	{
		assert.strictEqual( jsonstor.SqlExpression( false ), 'FALSE' );
		assert.strictEqual( jsonstor.SqlExpression( true ), 'TRUE' );
	} );


	//---------------------------------------------------------------------
	it( `It should return an expression for number values`, function ()
	{
		assert.strictEqual( jsonstor.SqlExpression( 0 ), '0' );
		assert.strictEqual( jsonstor.SqlExpression( 3.14 ), '3.14' );
	} );


	//---------------------------------------------------------------------
	it( `It should return an expression for string values`, function ()
	{
		assert.strictEqual( jsonstor.SqlExpression( 'Hello World!' ), '"Hello World!"' );
	} );


	//---------------------------------------------------------------------
	it( `It should return an expression for null values`, function ()
	{
		assert.strictEqual( jsonstor.SqlExpression( null ), 'NULL' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $ImplicitEq operator`, function ()
	{
		assert.strictEqual( jsonstor.SqlExpression( { active: true } ), '(active = TRUE)' );
		assert.strictEqual( jsonstor.SqlExpression( { id: 1001 } ), '(id = 1001)' );
		assert.strictEqual( jsonstor.SqlExpression( { name: 'Alice' } ), '(name = "Alice")' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $eq operator`, function ()
	{
		assert.strictEqual( jsonstor.SqlExpression( { active: { $eq: true } } ), '(active = TRUE)' );
		assert.strictEqual( jsonstor.SqlExpression( { id: { $eq: 1001 } } ), '(id = 1001)' );
		assert.strictEqual( jsonstor.SqlExpression( { name: { $eq: 'Alice' } } ), '(name = "Alice")' );
		// SQL has no value equal to NULL, so `= NULL` matches no row while the criteria
		// matches every row whose field is null or absent. Measured against a live server:
		// the old rendering returned nothing at all.
		assert.strictEqual( jsonstor.SqlExpression( { value: { $eq: null } } ), '(value IS NULL)' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $eqx operator`, function ()
	{
		assert.strictEqual( jsonstor.SqlExpression( { active: { $eqx: true } } ), '(active = TRUE)' );
		assert.strictEqual( jsonstor.SqlExpression( { id: { $eqx: 1001 } } ), '(id = 1001)' );
		assert.strictEqual( jsonstor.SqlExpression( { name: { $eqx: 'Alice' } } ), '(name = "Alice")' );
		// SQL has no value equal to NULL, so `= NULL` matches no row while the criteria
		// matches every row whose field is null or absent. Measured against a live server:
		// the old rendering returned nothing at all.
		assert.strictEqual( jsonstor.SqlExpression( { value: { $eqx: null } } ), '(value IS NULL)' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $ne operator`, function ()
	{
		// A criteria $ne matches a field which is absent, and SQL drops a NULL row from
		// `field <> value` because the comparison is UNKNOWN rather than true. Those rows
		// are named explicitly so the clause cannot return fewer rows than the criteria.
		assert.strictEqual( jsonstor.SqlExpression( { active: { $ne: true } } ), '((active <> TRUE) OR active IS NULL)' );
		assert.strictEqual( jsonstor.SqlExpression( { id: { $ne: 1001 } } ), '((id <> 1001) OR id IS NULL)' );
		assert.strictEqual( jsonstor.SqlExpression( { name: { $ne: 'Alice' } } ), '((name <> "Alice") OR name IS NULL)' );
		assert.strictEqual( jsonstor.SqlExpression( { value: { $ne: null } } ), '(value IS NOT NULL)' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $nex operator`, function ()
	{
		// A criteria $ne matches a field which is absent, and SQL drops a NULL row from
		// `field <> value` because the comparison is UNKNOWN rather than true. Those rows
		// are named explicitly so the clause cannot return fewer rows than the criteria.
		assert.strictEqual( jsonstor.SqlExpression( { active: { $nex: true } } ), '((active <> TRUE) OR active IS NULL)' );
		assert.strictEqual( jsonstor.SqlExpression( { id: { $nex: 1001 } } ), '((id <> 1001) OR id IS NULL)' );
		assert.strictEqual( jsonstor.SqlExpression( { name: { $nex: 'Alice' } } ), '((name <> "Alice") OR name IS NULL)' );
		assert.strictEqual( jsonstor.SqlExpression( { value: { $nex: null } } ), '(value IS NOT NULL)' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $lt operator`, function ()
	{
		assert.strictEqual( jsonstor.SqlExpression( { active: { $lt: true } } ), '(active < TRUE)' );
		assert.strictEqual( jsonstor.SqlExpression( { id: { $lt: 1001 } } ), '(id < 1001)' );
		assert.strictEqual( jsonstor.SqlExpression( { name: { $lt: 'Alice' } } ), '(name < "Alice")' );
		// A comparison against null selects null and absent fields rather than asking an
		// ordering question, and SQL answers UNKNOWN for all of them. The condition is
		// left out entirely and jsongin filters the rows instead.
		assert.strictEqual( jsonstor.SqlExpression( { value: { $lt: null } } ), '' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $lte operator`, function ()
	{
		assert.strictEqual( jsonstor.SqlExpression( { active: { $lte: true } } ), '(active <= TRUE)' );
		assert.strictEqual( jsonstor.SqlExpression( { id: { $lte: 1001 } } ), '(id <= 1001)' );
		assert.strictEqual( jsonstor.SqlExpression( { name: { $lte: 'Alice' } } ), '(name <= "Alice")' );
		// A comparison against null selects null and absent fields rather than asking an
		// ordering question, and SQL answers UNKNOWN for all of them. The condition is
		// left out entirely and jsongin filters the rows instead.
		assert.strictEqual( jsonstor.SqlExpression( { value: { $lte: null } } ), '' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $gt operator`, function ()
	{
		assert.strictEqual( jsonstor.SqlExpression( { active: { $gt: true } } ), '(active > TRUE)' );
		assert.strictEqual( jsonstor.SqlExpression( { id: { $gt: 1001 } } ), '(id > 1001)' );
		assert.strictEqual( jsonstor.SqlExpression( { name: { $gt: 'Alice' } } ), '(name > "Alice")' );
		// A comparison against null selects null and absent fields rather than asking an
		// ordering question, and SQL answers UNKNOWN for all of them. The condition is
		// left out entirely and jsongin filters the rows instead.
		assert.strictEqual( jsonstor.SqlExpression( { value: { $gt: null } } ), '' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $gte operator`, function ()
	{
		assert.strictEqual( jsonstor.SqlExpression( { active: { $gte: true } } ), '(active >= TRUE)' );
		assert.strictEqual( jsonstor.SqlExpression( { id: { $gte: 1001 } } ), '(id >= 1001)' );
		assert.strictEqual( jsonstor.SqlExpression( { name: { $gte: 'Alice' } } ), '(name >= "Alice")' );
		// A comparison against null selects null and absent fields rather than asking an
		// ordering question, and SQL answers UNKNOWN for all of them. The condition is
		// left out entirely and jsongin filters the rows instead.
		assert.strictEqual( jsonstor.SqlExpression( { value: { $gte: null } } ), '' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $in operator`, function ()
	{
		assert.strictEqual( jsonstor.SqlExpression( { rating: { $in: [ 1, 2, 3, 4, 5 ] } } ), '(rating IN (1, 2, 3, 4, 5))' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the $nin operator`, function ()
	{
		// NOT IN is UNKNOWN for a NULL column, so those rows are named explicitly - an
		// absent field is in no list, and the criteria matches it.
		assert.strictEqual( jsonstor.SqlExpression( { rating: { $nin: [ 1, 2, 3, 4, 5 ] } } ), '((NOT (rating IN (1, 2, 3, 4, 5))) OR rating IS NULL)' );
	} );


	//---------------------------------------------------------------------
	it( `It should support the implicit $and operator`, function ()
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
	it( `It should support the $and operator`, function ()
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
	it( `It should support the $or operator`, function ()
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
	it( `It should support the $nor operator`, function ()
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
	it( `It should support the $not operator`, function ()
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
	it( `It should support complex logic`, function ()
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
		assert.strictEqual( expr, '(((rating <> 2) OR rating IS NULL) AND ((rating >= 1) OR (rating <= 5)))' );
	} );


	//---------------------------------------------------------------------
	it( `It should allow document paths`, function ()
	{
		let criteria = {
			rating: { $ne: 2 },
			'user.name': 3.14,
		};
		let expr = jsonstor.SqlExpression( criteria );
		assert.strictEqual( expr, '(((rating <> 2) OR rating IS NULL) AND (user.name = 3.14))' );
	} );


	//---------------------------------------------------------------------
	it( `It should use custom identifier quotes`, function ()
	{
		let criteria = { name: 'Alice' };
		let expr = jsonstor.SqlExpression( criteria, { IdentifierQuotes: '`' } );
		assert.strictEqual( expr, '(`name` = "Alice")' );
	} );


	//---------------------------------------------------------------------
	it( `It should use custom string literal quotes`, function ()
	{
		let criteria = { name: 'Alice' };
		let expr = jsonstor.SqlExpression( criteria, { StringLiteralQuotes: "'" } );
		assert.strictEqual( expr, `(name = 'Alice')` );
	} );


	//---------------------------------------------------------------------
	it( `It should respect Options.AllowedFields`, function ()
	{
		let criteria = {
			rating: { $ne: 2 },
			'user.name': 3.14,
		};
		let options = {
			AllowedFields: {
				rating: { short_type: 'n' }
			}
		};
		let expr = jsonstor.SqlExpression( criteria, options );
		assert.strictEqual( expr, '((rating <> 2) OR rating IS NULL)' );

		options.AllowedFields[ 'user.name' ] = { short_type: 'n' };
		expr = jsonstor.SqlExpression( criteria, options );
		assert.strictEqual( expr, '(((rating <> 2) OR rating IS NULL) AND (user.name = 3.14))' );

	} );



	//---------------------------------------------------------------------
	/*
		A logical operator holding exactly one condition used to read the
		accumulator of expressions built so far instead of the sub-expressions it
		had just built. With nothing accumulated the whole clause vanished from the
		statement; with something accumulated the condition was replaced by a
		duplicate of whatever preceded it. Both produced a statement which ran and
		returned the wrong rows.
	*/
	it( `It should render a logical operator holding one condition`, function ()
	{
		assert.strictEqual( jsonstor.SqlExpression( { $or: [ { a: 1 } ] } ), '((a = 1))' );
		assert.strictEqual( jsonstor.SqlExpression( { $and: [ { a: 1 } ] } ), '((a = 1))' );
		assert.strictEqual( jsonstor.SqlExpression( { $nor: [ { a: 1 } ] } ), '(NOT ((a = 1)))' );
	} );


	//---------------------------------------------------------------------
	it( `It should not let a one condition operator borrow a preceding expression`, function ()
	{
		assert.strictEqual( jsonstor.SqlExpression( { z: 9, $or: [ { a: 1 } ] } ), '((z = 9) AND ((a = 1)))' );
		assert.strictEqual( jsonstor.SqlExpression( { z: 9, $and: [ { a: 1 } ] } ), '((z = 9) AND ((a = 1)))' );
	} );


	//---------------------------------------------------------------------
	/*
		jsongin 0.1.0 refuses a logical operator given no conditions rather than
		answering false. The statement builder refuses it too, rather than
		contributing an empty string to the WHERE clause.
	*/
	it( `It should refuse a logical operator given no conditions`, function ()
	{
		assert.throws( function () { jsonstor.SqlExpression( { $or: [] } ); } );
		assert.throws( function () { jsonstor.SqlExpression( { $and: [] } ); } );
		assert.throws( function () { jsonstor.SqlExpression( { $nor: [] } ); } );
	} );


	//---------------------------------------------------------------------
	/*
		An empty sub-criteria renders as an empty string, and an empty rendering
		means ***always true***, not ***contributes nothing***. Those are the same
		thing for $and and different things for $or and $nor, so the rendering
		cannot be dropped without asking which operator is holding it.

		Measured against the 6.0.1 baseline, over { a: 1 }, { a: 2 }, { b: 9 }:

			{ $and: [ {} ] }        matches all 3
			{ $or:  [ {} ] }        matches all 3
			{ $or:  [ {}, {a:1} ] } matches all 3
			{ $nor: [ {} ] }        matches none
			{ $nor: [ {}, {a:1} ] } matches none
	*/
	it( `It should treat an always true condition as true under $and`, function ()
	{
		// Already correct: AND TRUE is the identity, so dropping it is right.
		assert.strictEqual( jsonstor.SqlExpression( { $and: [ {} ] } ), '' );
		assert.strictEqual( jsonstor.SqlExpression( { z: 9, $and: [ {}, { a: 1 } ] } ), '((z = 9) AND ((a = 1)))' );
	} );


	//---------------------------------------------------------------------
	it( `It should not drop an always true condition from $or`, function ()
	{
		// OR TRUE is TRUE, so the whole clause constrains nothing. Dropping the
		// empty condition and keeping its neighbour narrowed the result instead.
		assert.strictEqual( jsonstor.SqlExpression( { $or: [ {}, { a: 1 } ] } ), '' );
		assert.strictEqual( jsonstor.SqlExpression( { z: 9, $or: [ {}, { a: 1 } ] } ), '(z = 9)' );
	} );

	//---------------------------------------------------------------------
	/*
		A $nor whose child rendered nothing cannot be written as FALSE, even though
		FALSE is what MongoDB means by { $nor: [ {} ] }. An empty rendering here is
		ambiguous: the child was either always true, or simply not renderable - and
		this file cannot tell those apart. FALSE is right for the first and wrongly
		narrows the result for the second, so the whole clause is dropped.

		This is the superset invariant at the head of SqlExpression.js: too many rows
		is a cost, too few is a wrong answer, and jsongin is what actually filters.
	*/
	it( `It should broaden rather than narrow for a $nor it cannot render`, function ()
	{
		assert.strictEqual( jsonstor.SqlExpression( { $nor: [ {} ] } ), '' );
		assert.strictEqual( jsonstor.SqlExpression( { z: 9, $nor: [ {} ] } ), '(z = 9)' );
	} );


	//---------------------------------------------------------------------
	/*
		An operand which is not a boolean, number, string, null, or array cannot be
		carried into SQL. The condition is left out and the caller sees more rows
		than it asked for, which jsongin then filters down. Refusing the statement
		instead would break every one of these criteria against a SQL adapter.
	*/
	it( `It should drop a comparison operand it cannot render`, function ()
	{
		assert.strictEqual( jsonstor.SqlExpression( { a: { $eq: {} } } ), '' );
		assert.strictEqual( jsonstor.SqlExpression( { a: { $gt: {} } } ), '' );
		assert.strictEqual( jsonstor.SqlExpression( { a: { $gte: new Date() } } ), '' );
		assert.strictEqual( jsonstor.SqlExpression( { a: {} } ), '' );
		assert.strictEqual( jsonstor.SqlExpression( { a: { $not: {} } } ), '' );
	} );


	//---------------------------------------------------------------------
	/*
		The reason the drop above has to reach the whole $or rather than just the one
		condition. An unrenderable child of an $or leaves the clause unconstrained,
		exactly as an always true child does - keeping the renderable siblings would
		return a subset and lose rows nothing downstream could recover.
	*/
	it( `It should drop a whole $or when any child cannot be rendered`, function ()
	{
		assert.strictEqual( jsonstor.SqlExpression( { $or: [ { a: { $eq: {} } }, { b: 1 } ] } ), '' );
		assert.strictEqual( jsonstor.SqlExpression( { z: 9, $or: [ { a: {} }, { b: 1 } ] } ), '(z = 9)' );
	} );


	//---------------------------------------------------------------------
	/*
		$and is the one operator where dropping a child is safe: AND TRUE is the
		identity, so the remaining conditions still admit every matching row.
	*/
	it( `It should keep the renderable children of an $and`, function ()
	{
		assert.strictEqual( jsonstor.SqlExpression( { $and: [ { a: { $eq: {} } }, { b: 1 } ] } ), '((b = 1))' );
	} );


} );
