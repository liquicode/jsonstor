'use strict';

const JsonStorages = require( '../src/jsonstor' )();
// const Storage = JsonStorages.GetStorage( 'jsonstor-memory', {} );
const Storage = JsonStorages.GetStorage(
	'jsonstor-memory', {},
	[
		// { FilterName: 'jsonstor-oplog', Settings: {} },
	] );

describe( '100) jsonstor-memory Tests', () =>
{
	require( './storage-tests/A) CRUD Tests.js' )( Storage, 100 );
	require( './storage-tests/B) Rainbow Query Tests.js' )( Storage );
	require( './storage-tests/C) MongoDB Tutorial.js' )( Storage );
	require( './storage-tests/D) MongoDB Reference.js' )( Storage );
	require( './storage-tests/Z) Ad-Hoc Tests.js' )( Storage );
} );

