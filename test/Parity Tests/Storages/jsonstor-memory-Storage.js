'use strict';

/*
	The jsonstor-memory storage, for the parity run.

	A "driver" here is a Storage. The shared suites in @liquicode/jsonstor-docs already take one,
	so a storage module is all a parity runner needs to point an entire inventory at a
	different medium.
*/

const jsonstor = require( '../../../src/jsonstor' )();

module.exports = function ()
{
	return jsonstor.GetStorage( 'jsonstor-memory', {} );
};
