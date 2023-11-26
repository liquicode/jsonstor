'use strict';

const LIB_PATH = require( 'path' );

const jsonstor = require( '../src/jsonstor' )();
const Storage = jsonstor.GetStorage( 'jsonstor-folder', {
	Path: LIB_PATH.join( __dirname, '~temp', 'jsonstor-folder' ),
} );


describe( '200) jsonstor-folder Tests', () =>
{
	require( './Storage Tests/A) CRUD Tests.js' )( Storage, 100 );
	require( './Storage Tests/B) Rainbow Query Tests.js' )( Storage );
	require( './Storage Tests/C) UserInfo Permissions Tests.js' )( Storage );
	require( './Storage Tests/M) MongoDB Tutorial.js' )( Storage );
	require( './Storage Tests/N) MongoDB Reference.js' )( Storage );
	require( './Storage Tests/Z) Ad-Hoc Tests.js' )( Storage );
} );

