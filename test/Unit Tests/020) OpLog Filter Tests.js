'use strict';

const assert = require( 'assert' );
const jsonstor = require( '../../src/jsonstor' )();


//---------------------------------------------------------------------
/*
	The oplog filter traces storage calls to a log target. It is a jsonstor
	extension with no MongoDB counterpart, so it is a unit test rather than
	part of the shared storage inventory.

	Nothing exercised this filter at all before - `npm run coverage` reported
	the whole of its GetFilter as untouched - which is how a value type it
	could not render went unnoticed.
*/
//---------------------------------------------------------------------

describe( '020) OpLog Filter Tests', function ()
{

	//---------------------------------------------------------------------
	// Returns a storage wrapped in an oplog filter, plus the lines it logs.
	function logged_storage( Settings )
	{
		let lines = [];
		if ( typeof Settings === 'undefined' ) { Settings = {}; }
		Settings.LogTo = function ( Message ) { lines.push( Message ); };
		Settings.ErrorTo = function ( Message ) { lines.push( Message ); };
		let storage = jsonstor.GetStorage( 'jsonstor-memory', {},
			[ { FilterName: 'jsonstor-oplog', Settings: Settings } ] );
		return { Storage: storage, Lines: lines };
	}


	//---------------------------------------------------------------------
	it( `It should trace a storage call`, async function ()
	{
		let traced = logged_storage();
		await traced.Storage.InsertOne( { value: 1 } );
		let text = traced.Lines.join( '\n' );
		assert.ok( text.includes( 'InsertOne' ) );
		assert.ok( text.includes( 'jsonstor-memory' ) );
	} );


	//---------------------------------------------------------------------
	it( `It should pass the storage call through to the adapter`, async function ()
	{
		let traced = logged_storage();
		await traced.Storage.InsertOne( { value: 1 } );
		let count = await traced.Storage.Count( {} );
		assert.strictEqual( count, 1 );
	} );


	//---------------------------------------------------------------------
	/*
		log_parameter switches on the short type of a whole parameter, and every
		parameter the storage interface hands it is an object, an array, a scalar,
		a null, or undefined.

		A Date has its own short type in jsongin 0.1.0 where it used to report as
		an object, which looked like it would make this log `unknown type [d]`. It
		does not: a Date only ever appears ***inside*** a criteria or a document,
		where it is carried by the object branch. The type is asserted here so that
		a future parameter which is a bare Date is a failing test rather than a
		surprise in a log file.
	*/
	it( `It should render every parameter the storage interface hands it`, async function ()
	{
		let traced = logged_storage( { IncludeParameters: true } );

		await traced.Storage.FindMany( {} );
		await traced.Storage.FindMany( null );
		await traced.Storage.FindMany( undefined );
		await traced.Storage.FindMany( { when: new Date( '2020-01-01T00:00:00Z' ) } );
		await traced.Storage.InsertMany( [ { value: 1 } ] );

		let text = traced.Lines.join( '\n' );
		assert.ok( !text.includes( 'unknown type' ) );
	} );


	//---------------------------------------------------------------------
	it( `It should refuse a storage which is not an object`, function ()
	{
		assert.throws( function () { jsonstor.GetFilter( 'jsonstor-oplog', 'not-a-storage', {} ); } );
	} );


} );
