'use strict';

/*
	The parity inventory, run against every storage which needs no server.

	This is the runner `npm test` uses. A red run here always means a regression in jsonstor
	itself: none of these storages talks to anything outside the process except the filesystem.

	The MongoDB baseline is run deliberately by `npm run parity-test-mongodb`, and the
	comparison of the two by `npm run parity-report`.
*/

const run_inventory = require( '@liquicode/jsonstor-docs' );

const STORAGES = [
	{ Name: 'jsonstor-memory', Module: './Storages/jsonstor-memory-Storage.js' },
	{ Name: 'jsonstor-folder', Module: './Storages/jsonstor-folder-Storage.js' },
	{ Name: 'jsonstor-jsonfile', Module: './Storages/jsonstor-jsonfile-Storage.js' },
];

for ( let index = 0; index < STORAGES.length; index++ )
{
	let entry = STORAGES[ index ];
	describe( entry.Name, function ()
	{
		let storage = require( entry.Module )();
		run_inventory( storage );
	} );
}
