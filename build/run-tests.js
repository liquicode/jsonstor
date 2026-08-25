'use strict';

/*
	Runs the unit tests and the jsonstor parity tests as two separate mocha
	invocations, and prints a report with a clear heading and a per-section
	summary for each.

	Shared by `npm test` and the `run_tests` build task so the two always run
	the same thing. `npm test` prints this output to the terminal; the build
	task captures it to tests.md and prepends the package title.

	The parity suites need no server (jsonstor-Tests.js runs the shared inventory
	against the engine under test). MongoDB-Tests.js is excluded because it
	needs a live MongoDB at localhost:27017.
*/

const path = require( 'path' );
const { spawnSync } = require( 'child_process' );

const REPO_ROOT = path.resolve( __dirname, '..' );
// Resolved rather than joined onto REPO_ROOT: under the jsonx workspace, node_modules is
// hoisted to the folder above this repo and there is no node_modules/mocha here at all.
const MOCHA_BIN = require.resolve( 'mocha/bin/mocha.js' );
const MOCHA_OPTS = [ '-u', 'bdd', '--timeout', '0', '--slow', '10' ];

// Anything after `npm test --` is handed to mocha untouched, so a caller can ask for a
// different reporter without this file knowing what for. The jsonstor-docs hub asks for
// `--reporter json` to collect per-section counts and durations across every storage.
const EXTRA_ARGS = process.argv.slice( 2 );

// A machine readable reporter is asked for in order to be parsed, so its output is passed
// through exactly as mocha wrote it and the markdown decoration below is skipped. Each
// suite is a separate mocha invocation, so a reader gets one document per suite.
const MACHINE_REPORTER = EXTRA_ARGS.some( function ( Arg )
{
	return ( Arg === '--reporter' ) || Arg.startsWith( '--reporter=' ) || ( Arg === '-R' );
} );

const SUITES = [
	{ label: 'Unit Tests', files: [ 'test/Unit Tests/*.js' ] },
	{ label: 'Parity Tests', files: [ 'test/Parity Tests/jsonstor-Tests.js' ] },
];

//---------------------------------------------------------------------
// Runs one mocha invocation and returns its captured output and counts.
function run_suite( suite )
{
	const args = [ MOCHA_BIN, ...MOCHA_OPTS, ...suite.files, ...EXTRA_ARGS ];
	const result = spawnSync( process.execPath, args, {
		cwd: REPO_ROOT,
		encoding: 'utf8',
	} );
	// Mocha writes the spec listing and summary to stdout; failure details
	// and stack traces go to stderr. Keep both so failures are not lost.
	const output = ( result.stdout || '' ) + ( result.stderr || '' );
	const counts = parse_counts( output );
	return {
		label: suite.label,
		output: output.trim(),
		passed: result.status === 0,
		counts,
	};
}

//---------------------------------------------------------------------
// Pulls the passing / failing / pending counts out of mocha's summary line.
function parse_counts( output )
{
	const counts = { passing: 0, failing: 0, pending: 0 };
	const passing = output.match( /(\d+)\s+passing/ );
	const failing = output.match( /(\d+)\s+failing/ );
	const pending = output.match( /(\d+)\s+pending/ );
	if ( passing ) { counts.passing = parseInt( passing[ 1 ], 10 ); }
	if ( failing ) { counts.failing = parseInt( failing[ 1 ], 10 ); }
	if ( pending ) { counts.pending = parseInt( pending[ 1 ], 10 ); }
	return counts;
}

//---------------------------------------------------------------------
// Main.
function main()
{
	const results = SUITES.map( run_suite );

	// A machine reporter's output is the whole point of asking for one, so nothing is
	// written around it. The exit code still reports the run, because it is taken from
	// mocha's own status rather than from counts scraped out of the text.
	if ( MACHINE_REPORTER )
	{
		let machine_passed = true;
		for ( const result of results )
		{
			if ( !result.passed ) { machine_passed = false; }
			process.stdout.write( result.output );
			process.stdout.write( '\n' );
		}
		process.exit( machine_passed ? 0 : 1 );
	}

	// Print one markdown section per suite, each in its own code fence so
	// mocha's own per-run summary (e.g. "1161 passing") stays with its suite.
	for ( const result of results )
	{
		process.stdout.write( `\n## ${result.label}\n\n` );
		process.stdout.write( '```\n' );
		process.stdout.write( result.output );
		process.stdout.write( '\n```\n' );
	}

	// Combined summary at the end.
	let total = 0;
	let all_passed = true;
	process.stdout.write( '\n## Summary\n\n' );
	for ( const result of results )
	{
		const c = result.counts;
		total += c.passing;
		if ( c.failing > 0 || !result.passed ) { all_passed = false; }
		const status = ( c.failing === 0 && result.passed ) ? 'passed' : 'FAILED';
		process.stdout.write( `- ${result.label}: ${c.passing} passed` );
		if ( c.failing > 0 ) { process.stdout.write( `, ${c.failing} failed` ); }
		if ( c.pending > 0 ) { process.stdout.write( `, ${c.pending} pending` ); }
		process.stdout.write( ` (${status})\n` );
	}
	process.stdout.write( `- Total: ${total} passed\n` );

	process.exit( all_passed ? 0 : 1 );
}

main();