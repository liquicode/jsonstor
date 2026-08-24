'use strict';

/*
	The jsonstor-mongodb storage, for the parity run.

	This is the reference storage. jsonstor's claim is that one interface carries across many
	mediums, and the way to measure that claim is to run one inventory against a real database
	and against every other medium, then compare test by test.

	The adapter is loaded from the sibling checkout rather than from node_modules, so the
	parity run measures the adapter as it is now rather than as it was last published. That
	checkout must resolve the same jsongin this one does; see .guides/upgrading-jsongin.md.

	Requires a MongoDB server at localhost:27017.
*/

const LIB_PATH = require( 'path' );
const jsonstor = require( '../../../src/jsonstor' )();

const ADAPTER_PATH = LIB_PATH.resolve( __dirname, '../../../../jsonstor-mongodb.git/src/jsonstor-mongodb.js' );

module.exports = function ()
{
	if ( typeof jsonstor.Adapters[ 'jsonstor-mongodb' ] === 'undefined' )
	{
		jsonstor.LoadPlugin( require( ADAPTER_PATH ) );
	}
	return jsonstor.GetStorage( 'jsonstor-mongodb',
		{
			ConnectionString: 'mongodb://localhost:27017',
			DatabaseName: 'jsonstor-parity',
			CollectionName: 'inventory',
		} );
};
