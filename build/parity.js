'use strict';

/*
	Measures how much of jsonstor's behavior is verified identical across storage mediums.

	jsonstor's claim is that one interface carries across many mediums. The way to measure that
	claim is to run one shared inventory against a real database and against every other medium,
	then match the results test by test.

	MongoDB is the source of truth, reached through jsonstor-mongodb. A test which passes under
	MongoDB and fails under another storage is a parity gap in that adapter. A test which fails
	under MongoDB is not an adapter defect at all: it means the test asserts something MongoDB
	does not actually do, and the test is what needs fixing. The number which must always be
	zero is `test bugs`.

	This is jsongin's parity method applied one layer up. There, a shared suite is run against
	the jsongin engine and against a MongoDB driver. Here, a shared suite is run against a
	jsonstor Storage and against a MongoDB-backed Storage - the suites in @liquicode/jsonstor-docs
	already take a Storage, so a storage module is the whole of what a "driver" means here.

	Usage:
		npm run parity-report
		npm run parity-report -- --verbose      (list every compared test, not just the gaps)

	Requires a MongoDB server at localhost:27017. See test/Parity Tests/Storages/.

	Note what this does and does not measure. It reports the share of shared-inventory
	assertions which every storage satisfies identically. It cannot report behavior no suite
	exercises yet, so a high score means "nothing known is broken", not "nothing is broken".
	Growing the shared inventory is what makes the number mean more.
*/

const LIB_FS = require( 'fs' );
const LIB_PATH = require( 'path' );
const LIB_CHILD_PROCESS = require( 'child_process' );

const REPO = LIB_PATH.resolve( __dirname, '..' );
const PARITY = LIB_PATH.join( REPO, 'test', 'Parity Tests' );
const NEWLINE = String.fromCharCode( 10 );


//---------------------------------------------------------------------
// The storages to compare against the baseline. The baseline itself is last in the file and
// is not compared with itself.
//
// The inventory of suites lives in @liquicode/jsonstor-docs rather than here, so
// that this script and the checked in runners cannot drift apart about what the inventory is.
const BASELINE = { Name: 'jsonstor-mongodb', Module: 'MongoDB-Storage.js' };

const STORAGES = [
	{ Name: 'jsonstor-memory', Module: 'jsonstor-memory-Storage.js' },
	{ Name: 'jsonstor-folder', Module: 'jsonstor-folder-Storage.js' },
	{ Name: 'jsonstor-jsonfile', Module: 'jsonstor-jsonfile-Storage.js' },
];


//---------------------------------------------------------------------
// Writes a runner which points the shared inventory at one storage.
//
// The runner adds no describe of its own, so the titles it produces are identical whichever
// storage is underneath. That is what lets a result from one medium be paired with the result
// from another.
function write_runner( Storage )
{
	let lines = [];
	lines.push( `'use strict';` );
	lines.push( `const run_inventory = require( '@liquicode/jsonstor-docs' );` );
	lines.push( `const storage = require( './Storages/${Storage.Module}' )();` );
	lines.push( `run_inventory( storage );` );

	let filename = LIB_PATH.join( PARITY, `~parity-${Storage.Name}.js` );
	LIB_FS.writeFileSync( filename, lines.join( NEWLINE ) + NEWLINE );
	return filename;
}


//---------------------------------------------------------------------
// Runs one runner under mocha's json reporter and returns a title -> outcome map.
function run_suite( Filename )
{
	let output = '';
	try
	{
		output = LIB_CHILD_PROCESS.execSync(
			`npx mocha -u bdd "${Filename}" --timeout 0 --reporter json`,
			{ cwd: REPO, encoding: 'utf8', stdio: [ 'ignore', 'pipe', 'ignore' ], maxBuffer: 64 * 1024 * 1024 } );
	}
	catch ( error )
	{
		// mocha exits non-zero when tests fail, and still writes its report to stdout.
		output = ( error.stdout || '' );
	}

	let report = null;
	try
	{
		report = JSON.parse( output );
	}
	catch ( error )
	{
		throw new Error( `Could not read the mocha report for [${Filename}]. ${error.message}` );
	}

	let results = {};
	function record( Tests, Outcome )
	{
		if ( !Tests ) { return; }
		for ( let index = 0; index < Tests.length; index++ )
		{
			results[ Tests[ index ].fullTitle ] = Outcome;
		}
	}
	record( report.passes, 'pass' );
	record( report.failures, 'fail' );
	record( report.pending, 'skip' );

	return results;
}


//---------------------------------------------------------------------
// Sorts every test of one storage against the baseline into one of four outcomes.
function compare_storage( Storage, BaselineResults, Verbose )
{
	let runner = write_runner( Storage );
	let summary = {
		Name: Storage.Name,
		Compared: 0,
		Agreed: 0,
		Gaps: [],
		Missing: [],
	};

	try
	{
		let results = run_suite( runner );

		let titles = Object.keys( BaselineResults );
		for ( let index = 0; index < titles.length; index++ )
		{
			let title = titles[ index ];
			let baseline_outcome = BaselineResults[ title ];
			let outcome = results[ title ];

			if ( typeof outcome === 'undefined' )
			{
				summary.Missing.push( title );
				continue;
			}
			if ( ( baseline_outcome === 'skip' ) || ( outcome === 'skip' ) ) { continue; }

			// A test which fails under MongoDB says nothing about this adapter. It is counted
			// as a test bug by the caller and is not compared here.
			if ( baseline_outcome === 'fail' ) { continue; }

			summary.Compared++;
			if ( outcome === 'fail' ) { summary.Gaps.push( title ); }
			else { summary.Agreed++; }

			if ( Verbose )
			{
				let mark = ( outcome === 'fail' ) ? 'GAP  ' : 'ok   ';
				console.log( `   ${mark} ${title}` );
			}
		}
	}
	finally
	{
		LIB_FS.unlinkSync( runner );
	}

	return summary;
}


//---------------------------------------------------------------------
function percent( Numerator, Denominator )
{
	if ( Denominator === 0 ) { return '  n/a'; }
	return ( ( Numerator / Denominator ) * 100 ).toFixed( 1 ) + '%';
}


//---------------------------------------------------------------------
function main()
{
	let verbose = process.argv.includes( '--verbose' );

	console.log( '' );
	console.log( 'Measuring jsonstor against MongoDB ...' );
	console.log( '' );

	// The baseline first. Everything else is measured against it, and a test which fails here
	// is a test bug rather than a finding about any adapter.
	let baseline_runner = write_runner( BASELINE );
	let baseline_results = null;
	try { baseline_results = run_suite( baseline_runner ); }
	finally { LIB_FS.unlinkSync( baseline_runner ); }

	let baseline_titles = Object.keys( baseline_results );
	let test_bugs = baseline_titles.filter( function ( Title ) { return baseline_results[ Title ] === 'fail'; } );

	if ( baseline_titles.length === 0 )
	{
		console.log( 'The MongoDB baseline produced no results at all.' );
		console.log( 'Is there a server at localhost:27017?' );
		process.exit( 1 );
	}

	let summaries = [];
	for ( let index = 0; index < STORAGES.length; index++ )
	{
		if ( verbose ) { console.log( `${STORAGES[ index ].Name}:` ); }
		summaries.push( compare_storage( STORAGES[ index ], baseline_results, verbose ) );
		if ( verbose ) { console.log( '' ); }
	}

	// The report.
	console.log( `baseline   ${BASELINE.Name}, ${baseline_titles.length} tests` );
	console.log( '' );
	console.log( '   storage                compared    agreed        gaps' );
	console.log( '   -------------------------------------------------------' );

	let total_compared = 0;
	let total_agreed = 0;
	for ( let index = 0; index < summaries.length; index++ )
	{
		let summary = summaries[ index ];
		total_compared += summary.Compared;
		total_agreed += summary.Agreed;
		let name = summary.Name.padEnd( 22 );
		let compared = String( summary.Compared ).padStart( 8 );
		let agreed = String( summary.Agreed ).padStart( 9 );
		let gaps = String( summary.Gaps.length ).padStart( 11 );
		console.log( `   ${name}${compared}${agreed}${gaps}` );
	}
	console.log( '   -------------------------------------------------------' );
	console.log( `   ${'total'.padEnd( 22 )}${String( total_compared ).padStart( 8 )}${String( total_agreed ).padStart( 9 )}${String( total_compared - total_agreed ).padStart( 11 )}` );
	console.log( '' );

	// The gaps, named.
	let has_gaps = false;
	for ( let index = 0; index < summaries.length; index++ )
	{
		let summary = summaries[ index ];
		for ( let gap_index = 0; gap_index < summary.Gaps.length; gap_index++ )
		{
			has_gaps = true;
			console.log( `   GAP        [${summary.Name}] ${summary.Gaps[ gap_index ]}` );
		}
		for ( let missing_index = 0; missing_index < summary.Missing.length; missing_index++ )
		{
			has_gaps = true;
			console.log( `   NOT RUN    [${summary.Name}] ${summary.Missing[ missing_index ]}` );
		}
	}
	if ( has_gaps ) { console.log( '' ); }

	// The test bugs. These are failures of the baseline itself, which means the inventory
	// asserts something MongoDB does not do. This number must always be zero.
	for ( let index = 0; index < test_bugs.length; index++ )
	{
		console.log( `   TEST BUG   ${test_bugs[ index ]}` );
	}
	if ( test_bugs.length > 0 ) { console.log( '' ); }

	console.log( `   parity     ${percent( total_agreed, total_compared )}   (${total_agreed} of ${total_compared} compared behaviors)` );
	console.log( `   test bugs  ${test_bugs.length}` );
	console.log( '' );

	// A gap is a regression and fails the report. A test bug fails it too, because it means
	// the inventory is measuring the wrong thing and every number above it is suspect.
	if ( ( total_agreed !== total_compared ) || ( test_bugs.length > 0 ) ) { process.exit( 1 ); }
	process.exit( 0 );
}

main();
