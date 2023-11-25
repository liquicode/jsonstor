'use strict';

const LIB_PATH = require( 'path' );

const JsonStorages = require( '../src/jsonstor' )();
const Storage = JsonStorages.GetStorage( 'jsonstor-jsonfile', {
	Path: LIB_PATH.join( __dirname, '~temp', 'jsonstor-jsonfile.json' ),
} );


describe( '300) jsonstor-jsonfile Tests', () =>
{
	require( './storage-tests/A) CRUD Tests.js' )( Storage, 100 );
	require( './storage-tests/B) Rainbow Query Tests.js' )( Storage );
	require( './storage-tests/C) MongoDB Tutorial.js' )( Storage );
	require( './storage-tests/D) MongoDB Reference.js' )( Storage );
	require( './storage-tests/Z) Ad-Hoc Tests.js' )( Storage );
} );

