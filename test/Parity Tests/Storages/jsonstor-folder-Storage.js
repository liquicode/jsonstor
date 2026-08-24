'use strict';

/*
	The jsonstor-folder storage, for the parity run. See jsonstor-memory-Storage.js.
*/

const LIB_PATH = require( 'path' );
const jsonstor = require( '../../../src/jsonstor' )();

module.exports = function ()
{
	let path = LIB_PATH.resolve( __dirname, '../../~temp/parity-jsonstor-folder' );
	return jsonstor.GetStorage( 'jsonstor-folder', { Path: path } );
};
