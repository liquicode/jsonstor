'use strict';

/*
	The jsonstor-jsonfile storage, for the parity run. See jsonstor-memory-Storage.js.
*/

const LIB_PATH = require( 'path' );
const jsonstor = require( '../../../src/jsonstor' )();

module.exports = function ()
{
	let path = LIB_PATH.resolve( __dirname, '../../~temp/parity-jsonstor-jsonfile.json' );
	return jsonstor.GetStorage( 'jsonstor-jsonfile', { Path: path } );
};
