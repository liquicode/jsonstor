'use strict';

/*
	The parity inventory, run against a live MongoDB through jsonstor-mongodb.

	This is the baseline the other storages are measured against. It is deliberately kept out
	of `npm test`, because it needs a server at localhost:27017 and a red run here usually
	means the server is not there rather than that jsonstor changed.

	Run it with `npm run parity-test-mongodb`, or let `npm run parity-report` run it.
*/

const run_inventory = require( '@liquicode/jsonstor-docs' );

describe( 'jsonstor-mongodb', function ()
{
	let storage = require( './Storages/MongoDB-Storage.js' )();
	run_inventory( storage );
} );
