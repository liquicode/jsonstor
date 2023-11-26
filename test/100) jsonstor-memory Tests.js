'use strict';

const jsonstor = require( '../src/jsonstor' )();
// const Storage = JsonStorages.GetStorage( 'jsonstor-memory', {} );
const Storage = jsonstor.GetStorage(
	'jsonstor-memory', {},
	[
		// { FilterName: 'jsonstor-oplog', Settings: {} },
	] );

describe( '100) jsonstor-memory Tests', () =>
{
	require( './Storage Tests/A) CRUD Tests.js' )( Storage, 100 );
	require( './Storage Tests/B) Rainbow Query Tests.js' )( Storage );
	require( './Storage Tests/C) UserInfo Permissions Tests.js' )( Storage );
	require( './Storage Tests/M) MongoDB Tutorial.js' )( Storage );
	require( './Storage Tests/N) MongoDB Reference.js' )( Storage );
	require( './Storage Tests/Z) Ad-Hoc Tests.js' )( Storage );
} );

