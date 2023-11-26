'use strict';

const assert = require( 'assert' );

module.exports = function ( Storage, TestOptions )
{

	if ( typeof TestOptions === 'undefined' ) { TestOptions = {}; }
	TestOptions.ReturnDocuments = true;

	
	//---------------------------------------------------------------------
	let RainbowData =
	{

		// Test Values
		b0: false,
		b1: true,
		s0: '',

		// Primitive Values: bnslu
		b: true,
		n: 3.14,
		s: 'abc',
		l: null,

		// Object: o
		o: {
			b: true,
			n: 3.14,
			s: 'abc',
			l: null,
			o: {},
			a: [],
			// r: /expression/,
			// u: undefined,
		},

		// Array: a
		a: [
			true,
			3.14,
			'abc',
			null,
			{},
			[],
			// /expression/,
			// undefined,
		],

		// Function: f
		f: function () { },

		// RegExp: r
		r: /expression/,

		// Undefined: u
		u: undefined,

		// Empty (default) values for each type.
		default: {
			b: false,
			n: 0,
			s: '',
			l: null,
			a: [],
			o: {},
			// r: /expression/,
			// u: undefined,
		},

	};


	//---------------------------------------------------------------------
	describe( `B) Rainbow Tests`, () =>
	{

		//---------------------------------------------------------------------
		before(
			async function ()
			{
				try
				{
					let result = await Storage.DropStorage( TestOptions );
					assert.ok( result );
					result = await Storage.InsertOne( RainbowData, TestOptions );
					assert.ok( result );
					return;
				}
				catch ( error )
				{
					console.error( error.message );
				}
			} );


		//=====================================================================
		//=====================================================================
		//
		//		Nested Fields
		//
		//=====================================================================
		//=====================================================================

		describe( `Nested Fields (explicit)`, () =>
		{

			it( `should not perform matching on nested fields using implicit $eq`, async () => 
			{
				assert.ok( ( await Storage.FindMany( { o: { n: 3.14 } }, null, TestOptions ) ).length === 0 );
			} );

			it( `should not perform matching on nested fields using explicit $eq`, async () => 
			{
				assert.ok( ( await Storage.FindMany( { o: { n: { $eq: 3.14 } } }, null, TestOptions ) ).length === 0 );
			} );

		} );


		describe( `Nested Fields (dot notation)`, () =>
		{

			it( `should perform matching on nested fields using implicit $eq and dot notation`, async () => 
			{
				assert.ok( ( await Storage.FindMany( { 'o.n': 3.14 }, null, TestOptions ) ).length === 1 );
			} );

			it( `should perform matching on nested fields using explicit $eq and dot notation`, async () => 
			{
				assert.ok( ( await Storage.FindMany( { 'o.n': { $eq: 3.14 } }, null, TestOptions ) ).length === 1 );
			} );

		} );


		//=====================================================================
		//=====================================================================
		//
		//		Operator $eq (===)
		//
		//=====================================================================
		//=====================================================================

		describe( `Operator $eq (===)`, () =>
		{

			//---------------------------------------------------------------------
			it( `should perform strict equality (===) on 'bns'`, async () => 
			{
				// Explicit
				assert.ok( ( await Storage.FindMany( { b: { $eq: true } }, null, TestOptions ) ).length === 1 );
				assert.ok( ( await Storage.FindMany( { n: { $eq: 3.14 } }, null, TestOptions ) ).length === 1 );
				assert.ok( ( await Storage.FindMany( { s: { $eq: 'abc' } }, null, TestOptions ) ).length === 1 );
				// Implicit
				assert.ok( ( await Storage.FindMany( { b: true }, null, TestOptions ) ).length === 1 );
				assert.ok( ( await Storage.FindMany( { n: 3.14 }, null, TestOptions ) ).length === 1 );
				assert.ok( ( await Storage.FindMany( { s: 'abc' }, null, TestOptions ) ).length === 1 );
			} );

			//---------------------------------------------------------------------
			it( `should perform strict equality (===) on 'o'`, async () => 
			{
				let result = null;

				// Explicit
				result = await Storage.FindMany( {
					o: {
						$eq: {
							b: true,
							n: 3.14,
							s: 'abc',
							l: null,
							o: {},
							a: [],
							// r: /expression/,
							// u: undefined,
						}
					}
				}, null, TestOptions );
				assert.ok( result );
				assert.ok( result.length === 1 );

				// Implicit
				result = await Storage.FindMany( {
					o: {
						b: true,
						n: 3.14,
						s: 'abc',
						l: null,
						o: {},
						a: [],
						// r: /expression/,
						// u: undefined,
					}
				}, null, TestOptions );
				assert.ok( result );
				assert.ok( result.length === 1 );

			} );

			//---------------------------------------------------------------------
			it( `should perform strict equality (===) on 'a'`, async () => 
			{
				// Explicit
				assert.ok( ( await Storage.FindMany( {
					a: {
						$eq: [
							true,
							3.14,
							'abc',
							null,
							{},
							[],
							// /expression/,
							// undefined,
						]
					}
				}, null, TestOptions ) ).length === 1 );
				// Implicit
				assert.ok( ( await Storage.FindMany( {
					a: [
						true,
						3.14,
						'abc',
						null,
						{},
						[],
						// /expression/,
						// undefined,
					]
				}, null, TestOptions ) ).length === 1 );
			} );

			//---------------------------------------------------------------------
			it( `should not perform loose equality (==) on 'bns'`, async () => 
			{
				// Explicit
				assert.ok( ( await Storage.FindMany( { b: { $eq: '1' } }, null, TestOptions ) ).length === 0 );
				assert.ok( ( await Storage.FindMany( { n: { $eq: '3.14' } }, null, TestOptions ) ).length === 0 );
				assert.ok( ( await Storage.FindMany( { s0: { $eq: 0 } }, null, TestOptions ) ).length === 0 );
				// Implicit
				assert.ok( ( await Storage.FindMany( { b: '1' }, null, TestOptions ) ).length === 0 );
				assert.ok( ( await Storage.FindMany( { n: '3.14' }, null, TestOptions ) ).length === 0 );
				assert.ok( ( await Storage.FindMany( { s0: 0 }, null, TestOptions ) ).length === 0 );
			} );

			//---------------------------------------------------------------------
			it( `should not perform loose equality (==) on 'o'`, async () => 
			{
				// Explicit
				assert.ok( ( await Storage.FindMany( {
					o: {
						$eq: {
							n: 3.14,
							s: 'abc',
							l: null,
							o: {},
							a: [],
							// r: /expression/,
							// u: undefined,
							b: true,
						}
					}
				}, null, TestOptions ) ).length === 0 );
				// Implicit
				assert.ok( ( await Storage.FindMany( {
					o: {
						n: 3.14,
						s: 'abc',
						l: null,
						o: {},
						a: [],
						// r: /expression/,
						// u: undefined,
						b: true,
					}
				}, null, TestOptions ) ).length === 0 );
			} );

			//---------------------------------------------------------------------
			it( `should not perform loose equality (==) on 'a'`, async () => 
			{
				// Explicit
				assert.ok( ( await Storage.FindMany( {
					a: {
						$eq: [
							3.14,
							'abc',
							null,
							{},
							[],
							// /expression/,
							// undefined,
							true,
						]
					}
				}, null, TestOptions ) ).length === 0 );
				// Implicit
				assert.ok( ( await Storage.FindMany( {
					a: [
						3.14,
						'abc',
						null,
						{},
						[],
						// /expression/,
						// undefined,
						true,
					]
				}, null, TestOptions ) ).length === 0 );
			} );

			//---------------------------------------------------------------------
			it( `should equate null with an undefined field`, async () => 
			{
				// Explicit
				//NOTE: Comparing to undefined will result in unexpected behaviors.
				// assert.ok( ( await Storage.FindMany( { l: { $eq: undefined } }, null, Options ) ).length === 1 );
				assert.ok( ( await Storage.FindMany( { u: { $eq: null } }, null, TestOptions ) ).length === 1 );
			} );

			// //---------------------------------------------------------------------
			// it( `should equate empty object {} with anything`, async () => 
			// {
			// 	// Explicit
			// 	assert.ok( ( await Driver.Find( { o: { $eq: {} } } ) ).length === 1 );
			// 	// Implicit
			// 	assert.ok( ( await Driver.Find( { o: {} } ) ).length === 1 );
			// } );

		} );


		//=====================================================================
		//=====================================================================
		//
		//		Operator $ne (!==)
		//
		//=====================================================================
		//=====================================================================

		describe( `Operator $ne (!==)`, () =>
		{

			//---------------------------------------------------------------------
			it( `should perform strict inequality (!==) on 'bns'`, async () => 
			{
				assert.ok( ( await Storage.FindMany( { b: { $ne: true } }, null, TestOptions ) ).length === 0 );
				assert.ok( ( await Storage.FindMany( { n: { $ne: 3.14 } }, null, TestOptions ) ).length === 0 );
				assert.ok( ( await Storage.FindMany( { s: { $ne: 'abc' } }, null, TestOptions ) ).length === 0 );

				assert.ok( ( await Storage.FindMany( { b: { $ne: false } }, null, TestOptions ) ).length === 1 );
				assert.ok( ( await Storage.FindMany( { n: { $ne: 42 } }, null, TestOptions ) ).length === 1 );
				assert.ok( ( await Storage.FindMany( { s: { $ne: '123' } }, null, TestOptions ) ).length === 1 );
			} );

			//---------------------------------------------------------------------
			it( `should perform strict inequality (!==) on 'o'`, async () => 
			{
				assert.ok( ( await Storage.FindMany( {
					o: {
						$ne: {
							n: 3.14,
							s: 'abc',
							l: null,
							o: {},
							a: [],
							// r: /expression/,
							// u: undefined,
							b: true,
						}
					}
				}, null, TestOptions ) ).length === 1 );
			} );

			//---------------------------------------------------------------------
			it( `should perform strict inequality (!==) on 'a'`, async () => 
			{
				assert.ok( ( await Storage.FindMany( {
					o: {
						$ne: [
							3.14,
							'abc',
							null,
							{},
							[],
							// /expression/,
							// undefined,
							true,
						]
					}
				}, null, TestOptions ) ).length === 1 );
			} );

			//---------------------------------------------------------------------
			it( `should not perform loose inequality (!=) on 'bns'`, async () => 
			{// Does this test make any sense? Is it trying to prove a negative?
				// These tests always fail because the values are of different types.
				assert.ok( ( await Storage.FindMany( { b: { $ne: '0' } }, null, TestOptions ) ).length === 1 );
				assert.ok( ( await Storage.FindMany( { n: { $ne: '3.14' } }, null, TestOptions ) ).length === 1 );
				assert.ok( ( await Storage.FindMany( { s0: { $ne: 0 } }, null, TestOptions ) ).length === 1 );
			} );

			//---------------------------------------------------------------------
			it( `should not perform loose inequality (!=) on 'o'`, async () => 
			{
				assert.ok( ( await Storage.FindMany( {
					o: {
						$ne: {
							n: 3.14,
							s: 'abc',
							l: null,
							o: {},
							a: [],
							// r: /expression/,
							// u: undefined,
							b: true,
						}
					}
				}, null, TestOptions ) ).length === 1 );
			} );

			//---------------------------------------------------------------------
			it( `should not perform loose inequality (!=) on 'a'`, async () => 
			{
				assert.ok( ( await Storage.FindMany( {
					o: {
						$ne: [
							3.14,
							'abc',
							null,
							{},
							[],
							// /expression/,
							// undefined,
							true,
						]
					}
				}, null, TestOptions ) ).length === 1 );
			} );

		} );


		//=====================================================================
		//=====================================================================
		//
		//		Operator $gte (>=)
		//
		//=====================================================================
		//=====================================================================

		describe( `Operator $gte (>=)`, () =>
		{

			it( `should perform strict comparison (>=) on 'bns'`, async () => 
			{
				assert.ok( ( await Storage.FindMany( { b: { $gte: true } }, null, TestOptions ) ).length === 1 );
				assert.ok( ( await Storage.FindMany( { n: { $gte: 3.14 } }, null, TestOptions ) ).length === 1 );
				assert.ok( ( await Storage.FindMany( { s: { $gte: 'abc' } }, null, TestOptions ) ).length === 1 );

				assert.ok( ( await Storage.FindMany( { b: { $gte: false } }, null, TestOptions ) ).length === 1 );
				assert.ok( ( await Storage.FindMany( { n: { $gte: 3 } }, null, TestOptions ) ).length === 1 );
				assert.ok( ( await Storage.FindMany( { s: { $gte: '123' } }, null, TestOptions ) ).length === 1 );
			} );

			it( `should not perform loose comparison (>=) on 'bns'`, async () => 
			{
				assert.ok( ( await Storage.FindMany( { b: { $gte: '0' } }, null, TestOptions ) ).length === 0 );
				assert.ok( ( await Storage.FindMany( { n: { $gte: '3' } }, null, TestOptions ) ).length === 0 );
				assert.ok( ( await Storage.FindMany( { s: { $gte: 0 } }, null, TestOptions ) ).length === 0 );
			} );

			//---------------------------------------------------------------------
			it( `should equate null with an undefined field`, async () => 
			{
				// Explicit
				//NOTE: Comparing to undefined will result in unexpected behaviors.
				// assert.ok( ( await Storage.FindMany( { l: { $gte: undefined } }, null, Options ) ).length === 1 );
				assert.ok( ( await Storage.FindMany( { u: { $gte: null } }, null, TestOptions ) ).length === 1 );
			} );

		} );


		//=====================================================================
		//=====================================================================
		//
		//		Operator $gt (>)
		//
		//=====================================================================
		//=====================================================================

		describe( `Operator $gt (>)`, () =>
		{

			it( `should perform strict comparison (>=) on 'bns'`, async () => 
			{
				assert.ok( ( await Storage.FindMany( { b: { $gt: false } }, null, TestOptions ) ).length === 1 );
				assert.ok( ( await Storage.FindMany( { n: { $gt: 3 } }, null, TestOptions ) ).length === 1 );
				assert.ok( ( await Storage.FindMany( { s: { $gt: '123' } }, null, TestOptions ) ).length === 1 );
			} );

			it( `should not perform loose comparison (>=) on 'bns'`, async () => 
			{
				// These values are always not $gte because of different types.
				assert.ok( ( await Storage.FindMany( { b: { $gt: '0' } }, null, TestOptions ) ).length === 0 );
				assert.ok( ( await Storage.FindMany( { n: { $gt: '3' } }, null, TestOptions ) ).length === 0 );
				assert.ok( ( await Storage.FindMany( { s: { $gt: 0 } }, null, TestOptions ) ).length === 0 );
			} );

		} );


		//=====================================================================
		//=====================================================================
		//
		//		Operator $lte (<=)
		//
		//=====================================================================
		//=====================================================================

		describe( `Operator $lte (<=)`, () =>
		{

			it( `should perform strict comparison (<=) on 'bns'`, async () => 
			{
				assert.ok( ( await Storage.FindMany( { b: { $lte: true } }, null, TestOptions ) ).length === 1 );
				assert.ok( ( await Storage.FindMany( { n: { $lte: 4 } }, null, TestOptions ) ).length === 1 );
				assert.ok( ( await Storage.FindMany( { s: { $lte: 'def' } }, null, TestOptions ) ).length === 1 );
			} );

			it( `should not perform loose comparison (<=) on 'bns'`, async () => 
			{
				assert.ok( ( await Storage.FindMany( { b: { $lte: '1' } }, null, TestOptions ) ).length === 0 );
				assert.ok( ( await Storage.FindMany( { n: { $lte: '4' } }, null, TestOptions ) ).length === 0 );
				assert.ok( ( await Storage.FindMany( { s0: { $lte: 0 } }, null, TestOptions ) ).length === 0 );
			} );

			//---------------------------------------------------------------------
			it( `should equate null with an undefined field`, async () => 
			{
				// Explicit
				//NOTE: Comparing to undefined will result in unexpected behaviors.
				// assert.ok( ( await Storage.FindMany( { l: { $lte: undefined } }, null, Options ) ).length === 1 );
				assert.ok( ( await Storage.FindMany( { u: { $lte: null } }, null, TestOptions ) ).length === 1 );
			} );

		} );


		//=====================================================================
		//=====================================================================
		//
		//		Operator $lt (<)
		//
		//=====================================================================
		//=====================================================================

		describe( `Operator $lt (<)`, () =>
		{

			it( `should perform strict comparison (<) on 'bns'`, async () => 
			{
				assert.ok( ( await Storage.FindMany( { b0: { $lt: true } }, null, TestOptions ) ).length === 1 );
				assert.ok( ( await Storage.FindMany( { n: { $lt: 4 } }, null, TestOptions ) ).length === 1 );
				assert.ok( ( await Storage.FindMany( { s: { $lt: 'def' } }, null, TestOptions ) ).length === 1 );
			} );

			it( `should not perform loose comparison (<) on 'bns'`, async () => 
			{
				assert.ok( ( await Storage.FindMany( { b0: { $lt: '1' } }, null, TestOptions ) ).length === 0 );
				assert.ok( ( await Storage.FindMany( { n: { $lt: '4' } }, null, TestOptions ) ).length === 0 );
				assert.ok( ( await Storage.FindMany( { s0: { $lt: 1 } }, null, TestOptions ) ).length === 0 );
			} );

		} );


	} );


};
