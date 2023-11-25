'use strict';

const LIB_PATH = require( 'path' );

const JsonStorages = require( '../src/jsonstor.js' )();
const Storage = JsonStorages.GetStorage(
	'jsonstor-memory', {},
	// 'jsonstor-folder',
	// {
	// 	Path: LIB_PATH.join( __dirname, '~temp', 'jsonstor-folder' ),
	// },
	// 'jsonstor-mongodb',
	// {
	// 	ConnectionString: 'mongodb://localhost',
	// 	DatabaseName: 'jsonstor-mongodb',
	// 	CollectionName: 'unittests',
	// },
	[
		// { FilterName: 'jsonstor-oplog', Settings: {} },
		{ FilterName: 'jsonstor-userinfo', Settings: {} },
	] );

describe( '500) UserStorage Storage Tests', () =>
{
	//---------------------------------------------------------------------
	let Options = { User: Storage.Administrator };

	//---------------------------------------------------------------------
	before(
		async function ()
		{
			let result = await Storage.DropStorage( Options );
			return;
		} );

	//---------------------------------------------------------------------
	require( './storage-tests/A) CRUD Tests.js' )( Storage, 100, Options );
	require( './storage-tests/B) Rainbow Query Tests.js' )( Storage, Options );
	require( './storage-tests/C) MongoDB Tutorial.js' )( Storage, Options );
	require( './storage-tests/D) MongoDB Reference.js' )( Storage, Options );
	require( './storage-tests/Z) Ad-Hoc Tests.js' )( Storage, Options );
} );

