'use strict';

/*
	Reports which parts of src/ the test suite never executes.

	Uses Node's own coverage collector, so this adds no dependency:
	NODE_V8_COVERAGE tells Node to dump raw V8 coverage for every process, mocha runs the
	suite, and this script merges the dumps and maps the uncovered byte ranges back to lines.

	Usage:
		npm run coverage
		npm run coverage -- --file CompareValues     (detail for the files which match)

	The uncovered blocks are grouped into three kinds, because they are worth different
	amounts of attention:

		plumbing    A catch block, or a call to OpError or OpLog. Cheap to cover and
		            historically where defects hide, since a message which is only built when
		            something has gone wrong is never built by a test which asserts success.
		validation  A throw which rejects a malformed argument. Covering it pins the message.
		logic       Everything else. Read these one at a time; some are genuinely unreachable
		            defensive code and are not worth chasing.
*/

const LIB_FS = require( 'fs' );
const LIB_PATH = require( 'path' );
const LIB_OS = require( 'os' );
const LIB_CHILD_PROCESS = require( 'child_process' );

const REPO = LIB_PATH.resolve( __dirname, '..' );
const NEWLINE = String.fromCharCode( 10 );
const BACKSLASH = String.fromCharCode( 92 );


//---------------------------------------------------------------------
function to_posix( Text )
{
	return Text.split( BACKSLASH ).join( '/' );
}


//---------------------------------------------------------------------
// Runs the test suite with the V8 coverage collector enabled.
function collect_coverage()
{
	let folder = LIB_FS.mkdtempSync( LIB_PATH.join( LIB_OS.tmpdir(), 'jsonstor-coverage-' ) );
	let environment = Object.assign( {}, process.env, { NODE_V8_COVERAGE: folder } );

	try
	{
		// The same set `npm test` runs, so that the coverage report describes the default run
		// rather than a subset of it.
		LIB_CHILD_PROCESS.execSync(
			'npx mocha -u bdd "test/Unit Tests/*.js" "test/Parity Tests/jsonstor-Tests.js" --timeout 0 --reporter dot',
			{ cwd: REPO, env: environment, stdio: 'ignore' } );
	}
	catch ( error )
	{
		// A failing test still executed the code it reached, so its coverage counts.
		// Reporting coverage is not conditional on the suite being green, and a parity gap is
		// a state this project expects to be in while it is being closed.
		console.log( 'Note: some tests failed. The coverage below is still what the run reached.' );
	}

	return folder;
}


//---------------------------------------------------------------------
// Merges every dump and returns the uncovered line numbers for each source file.
function read_coverage( Folder )
{
	let by_file = new Map();
	let files = LIB_FS.readdirSync( Folder );
	for ( let index = 0; index < files.length; index++ )
	{
		let dump = JSON.parse( LIB_FS.readFileSync( LIB_PATH.join( Folder, files[ index ] ), 'utf8' ) );
		for ( let script_index = 0; script_index < dump.result.length; script_index++ )
		{
			let script = dump.result[ script_index ];
			let url = to_posix( decodeURIComponent( script.url.replace( 'file:///', '' ) ) );
			if ( url.indexOf( to_posix( REPO ) + '/src/' ) !== 0 ) { continue; }
			if ( !by_file.has( url ) ) { by_file.set( url, [] ); }
			by_file.get( url ).push( script );
		}
	}

	let report = [];
	let keys = [ ...by_file.keys() ].sort();
	for ( let index = 0; index < keys.length; index++ )
	{
		let url = keys[ index ];
		let text = LIB_FS.readFileSync( url, 'utf8' );
		let source = text.split( NEWLINE );

		// A range is uncovered only when no dump reported a hit for it.
		let uncovered = [];
		let covered = [];
		let scripts = by_file.get( url );
		for ( let s = 0; s < scripts.length; s++ )
		{
			for ( let f = 0; f < scripts[ s ].functions.length; f++ )
			{
				let ranges = scripts[ s ].functions[ f ].ranges;
				for ( let r = 0; r < ranges.length; r++ )
				{
					let range = [ ranges[ r ].startOffset, ranges[ r ].endOffset ];
					if ( ranges[ r ].count === 0 ) { uncovered.push( range ); }
					else { covered.push( range ); }
				}
			}
		}
		let real = uncovered.filter(
			function ( Range )
			{
				return !covered.some(
					function ( Hit )
					{
						if ( Hit[ 0 ] > Range[ 0 ] ) { return false; }
						if ( Hit[ 1 ] < Range[ 1 ] ) { return false; }
						return ( ( Hit[ 1 ] - Hit[ 0 ] ) <= ( Range[ 1 ] - Range[ 0 ] ) );
					} );
			} );

		let lines = [ ...new Set( real.map( function ( Range ) { return text.slice( 0, Range[ 0 ] ).split( NEWLINE ).length; } ) ) ];
		lines.sort( function ( A, B ) { return A - B; } );

		report.push( {
			Path: url.slice( to_posix( REPO ).length + 1 ),
			Lines: lines,
			Source: source,
		} );
	}
	return report;
}


//---------------------------------------------------------------------
function classify( Text )
{
	let text = Text.trim();
	if ( text.includes( 'catch ( error )' ) ) { return 'plumbing'; }
	if ( text.includes( 'OpError' ) || text.includes( 'OpLog' ) ) { return 'plumbing'; }
	if ( text.includes( 'throw new Error' ) ) { return 'validation'; }
	return 'logic';
}


//---------------------------------------------------------------------
function main()
{
	let filter = null;
	let flag = process.argv.indexOf( '--file' );
	if ( flag >= 0 ) { filter = process.argv[ flag + 1 ]; }

	console.log( 'Running the test suite with coverage ...' );
	let folder = collect_coverage();
	let report = read_coverage( folder );
	LIB_FS.rmSync( folder, { recursive: true, force: true } );

	let totals = { plumbing: 0, validation: 0, logic: 0 };
	let clean = 0;
	for ( let index = 0; index < report.length; index++ )
	{
		let file = report[ index ];
		if ( file.Lines.length === 0 ) { clean++; }
		for ( let line_index = 0; line_index < file.Lines.length; line_index++ )
		{
			let line = file.Lines[ line_index ];
			totals[ classify( file.Source[ line - 1 ] || '' ) ]++;
		}
	}
	let total = totals.plumbing + totals.validation + totals.logic;

	console.log( '' );
	console.log( `source files exercised    : ${report.length}` );
	console.log( `fully covered             : ${clean}` );
	console.log( `uncovered blocks          : ${total}` );
	console.log( `  error plumbing          : ${totals.plumbing}` );
	console.log( `  validation throws       : ${totals.validation}` );
	console.log( `  logic branches          : ${totals.logic}` );

	if ( filter === null )
	{
		console.log( '' );
		console.log( 'Files with uncovered blocks:' );
		for ( let index = 0; index < report.length; index++ )
		{
			let file = report[ index ];
			if ( file.Lines.length === 0 ) { continue; }
			console.log( `  ${String( file.Lines.length ).padStart( 3 )}  ${file.Path}` );
		}
		console.log( '' );
		console.log( 'Run with --file <text> to see the uncovered lines of the matching files.' );
		return;
	}

	for ( let index = 0; index < report.length; index++ )
	{
		let file = report[ index ];
		if ( file.Path.indexOf( filter ) < 0 ) { continue; }
		console.log( '' );
		console.log( `--- ${file.Path}  (${file.Lines.length} uncovered)` );
		for ( let line_index = 0; line_index < file.Lines.length; line_index++ )
		{
			let line = file.Lines[ line_index ];
			let text = ( file.Source[ line - 1 ] || '' ).trim();
			console.log( `  ${String( line ).padStart( 4 )}  [${classify( text ).padEnd( 10 )}]  ${text.slice( 0, 90 )}` );
		}
	}
	return;
}


main();
