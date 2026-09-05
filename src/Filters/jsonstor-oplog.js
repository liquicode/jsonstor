"use strict";


const LIB_FS = require( 'fs' );

const jsongin = require( '@liquicode/jsongin' );


//---------------------------------------------------------------------
// ***`BigInt` is not the capability this needs, and testing for it was wrong by
// three patch releases.*** BigInt literals arrived in Node 10.4.0 and
// `process.hrtime.bigint` arrived in 10.7.0, so on 10.4 through 10.6 the old guard
// passed and then called a function which was not there. Measured on 2026-09-02
// while establishing the family's Node floor: node:10.4 answers
// `BigInt=function  process.hrtime.bigint=undefined`.
// ***Test for the function you are about to call, not for a thing which arrived
// near it.***
const HAS_HRTIME = ( typeof process !== 'undefined' ) && ( typeof process.hrtime === 'function' );
const HAS_HRTIME_BIGINT = HAS_HRTIME && ( typeof process.hrtime.bigint === 'function' );

//---------------------------------------------------------------------
// ***And `typeof` does not guard a member access.*** The line above used to read
// `typeof process.hrtime.bigint`, which evaluates `process.hrtime` first - so on a
// runtime with no `process` at all it threw before `typeof` was reached. At
// ***module scope***, in a filter bundled into core, so `jsonstor()` itself failed.
// Measured on 2026-09-04 against the published `dist/jsonstor.min.js` in headless
// Chrome 152, which answered `process is not defined` before a storage could be
// constructed.
// ***A guarded constant is only half the repair.*** With no timer a browser can
// read, the filter would be guarded into logging nothing - a worse defect than the
// crash it replaced. `performance.now()` is that timer: every browser has it, and
// Node has carried it as a global since 16, below which `process.hrtime` answers
// anyway.
const HAS_PERFORMANCE_NOW = ( typeof performance !== 'undefined' ) && ( typeof performance.now === 'function' );


//---------------------------------------------------------------------
// The three timer paths. A `read_timer` value is only ever handed back to
// `elapsed_ms`, so which path ran is invisible to the caller and the log reads the
// same on every runtime.
function read_timer()
{
	if ( HAS_HRTIME_BIGINT ) { return process.hrtime.bigint(); }
	if ( HAS_HRTIME ) { return process.hrtime(); }
	return read_clock_ms();
}

function elapsed_ms( StartTime )
{
	if ( HAS_HRTIME_BIGINT )
	{
		return Number( process.hrtime.bigint() - StartTime ) / 1e6; // ns to ms
	}
	if ( HAS_HRTIME )
	{
		let elapsed = process.hrtime( StartTime ); // [ seconds, nanoseconds ]
		return ( elapsed[ 0 ] * 1e3 ) + ( elapsed[ 1 ] / 1e6 );
	}
	return read_clock_ms() - StartTime;
}

// A millisecond clock, monotonic where the runtime offers one. `Date.now` is the
// degenerate case rather than a fourth path - it answers in the same units, so
// nothing above it changes shape.
function read_clock_ms()
{
	if ( HAS_PERFORMANCE_NOW ) { return performance.now(); }
	return Date.now();
}


module.exports = {

	FilterName: 'jsonstor-oplog',
	FilterDescription: 'Traces storage function calls and outputs messages to console, file, or other log targets.',

	GetFilter: function ( jsonstor, Storage, Settings )
	{
		//=====================================================================
		/*
			Settings = {
				LogTo: function ( Message ) { console.log( Message ); },
				IncludeTimestamp: true,
				IncludeDuration: true,
				DurationUnits: 'ms', // Can be: 's', 'ms', or'ns'
				IncludePluginName: true,
				IncludeParameters: false,
			}
		*/
		if ( jsongin.ShortType( Storage ) !== 'o' ) { throw new Error( `jsonstor-oplog requires a Storage object parameter.` ); }
		if ( jsongin.ShortType( Settings ) !== 'o' ) { Settings = {}; }
		if ( jsongin.ShortType( Settings.LogTo ) !== 'f' ) { Settings.LogTo = console.log; }
		if ( jsongin.ShortType( Settings.ErrorTo ) !== 'f' ) { Settings.ErrorTo = console.error; }
		if ( jsongin.ShortType( Settings.IncludeTimestamp ) !== 'b' ) { Settings.IncludeTimestamp = true; }
		if ( jsongin.ShortType( Settings.IncludeDuration ) !== 'b' ) { Settings.IncludeDuration = true; }
		if ( jsongin.ShortType( Settings.DurationUnits ) !== 's' ) { Settings.DurationUnits = 'ms'; }
		if ( jsongin.ShortType( Settings.IncludePluginName ) !== 'b' ) { Settings.IncludePluginName = true; }
		if ( jsongin.ShortType( Settings.IncludeParameters ) !== 'b' ) { Settings.IncludeParameters = true; }


		//=====================================================================
		let Filter = jsonstor.StorageInterface();
		Filter.Settings = Settings;
		Filter.Storage = Storage;


		//=====================================================================
		async function call_function( FunctionName, ParameterNames, ParameterValues )
		{
			return new Promise(
				async function ( resolve, reject )
				{
					try
					{
						Settings.LogTo( '' );
						let plugin_name = null;
						if ( typeof Storage.AdapterName !== 'undefined' ) { plugin_name = Storage.AdapterName; }
						else if ( typeof Storage.FilterName !== 'undefined' ) { plugin_name = Storage.FilterName; }
						else { plugin_name = 'unknown plugin'; }

						let timestamp = ( new Date() ).toISOString();
						let start_time = read_timer();

						let results = await Storage[ FunctionName ]( ...ParameterValues );

						let duration = elapsed_ms( start_time ); // ms

						let message = '=== ';
						if ( Settings.IncludeTimestamp ) { message += `${timestamp} | `; }
						if ( Settings.IncludeDuration ) 
						{
							if ( Settings.DurationUnits === 's' ) { message += `${( duration / 1e3 ).toFixed( 3 )} s | `; }
							else if ( Settings.DurationUnits === 'ms' ) { message += `${( duration ).toFixed( 3 )} ms | `; }
							else if ( Settings.DurationUnits === 'ns' ) { message += `${( duration * 1e6 )} ns | `; }
						}
						if ( Settings.IncludePluginName ) { message += `${plugin_name} | `; }
						message += `${FunctionName}`;
						message += ` ===`;
						if ( Settings.LogTo )
						{
							Settings.LogTo( message );
						}

						// ParameterNames.push( 'Results' );
						// ParameterValues.push( results );

						function log_parameter( Name, Value )
						{
							message = `    ${Name} : `;
							let st = jsongin.ShortType( Value );
							if ( 'bns'.includes( st ) ) { message += `${Value}`; }
							else if ( st === 'o' ) { message += `${JSON.stringify( Value )}`; }
							else if ( st === 'a' ) { message += `${Value.length} items`; }
							else if ( st === 'l' ) { message += `null`; }
							else if ( st === 'u' ) { message += `undefined`; }
							else { message += `unknown type [${st}]`; }
							if ( Settings.LogTo )
							{
								Settings.LogTo( message );
							}
						}

						if ( Settings.IncludeParameters )
						{
							for ( let index = 0; index < ParameterNames.length; index++ )
							{
								log_parameter( ParameterNames[ index ], ParameterValues[ index ] );
							}
						}

						log_parameter( 'Results', results );

						resolve( results );
						return;
					}
					catch ( error )
					{
						if ( Settings.ErrorTo )
						{
							Settings.ErrorTo( `Error: ${error.message}` );
						}
						reject( error );
						return;
					}
					finally
					{
					}
					return;
				} );
			return;
		}

		//=====================================================================
		Filter.DropStorage = async function ( Options ) { return await call_function( 'DropStorage', [ 'Options' ], [ Options ] ); };
		Filter.FlushStorage = async function ( Options ) { return await call_function( 'FlushStorage', [ 'Options' ], [ Options ] ); };
		Filter.Count = async function ( Criteria, Options ) { return await call_function( 'Count', [ 'Criteria', 'Options' ], [ Criteria, Options ] ); };
		Filter.InsertOne = async function ( Document, Options ) { return await call_function( 'InsertOne', [ 'Document', 'Options' ], [ Document, Options ] ); };
		Filter.InsertMany = async function ( Documents, Options ) { return await call_function( 'InsertMany', [ 'Documents', 'Options' ], [ Documents, Options ] ); };
		Filter.FindOne = async function ( Criteria, Projection, Options ) { return await call_function( 'FindOne', [ 'Criteria', 'Projection', 'Options' ], [ Criteria, Projection, Options ] ); };
		Filter.FindMany = async function ( Criteria, Projection, Options ) { return await call_function( 'FindMany', [ 'Criteria', 'Projection', 'Options' ], [ Criteria, Projection, Options ] ); };
		Filter.UpdateOne = async function ( Criteria, Update, Options ) { return await call_function( 'UpdateOne', [ 'Criteria', 'Update', 'Options' ], [ Criteria, Update, Options ] ); };
		Filter.UpdateMany = async function ( Criteria, Update, Options ) { return await call_function( 'UpdateMany', [ 'Criteria', 'Update', 'Options' ], [ Criteria, Update, Options ] ); };
		Filter.ReplaceOne = async function ( Criteria, Document, Options ) { return await call_function( 'ReplaceOne', [ 'Criteria', 'Document', 'Options' ], [ Criteria, Document, Options ] ); };
		Filter.DeleteOne = async function ( Criteria, Options ) { return await call_function( 'DeleteOne', [ 'Criteria', 'Options' ], [ Criteria, Options ] ); };
		Filter.DeleteMany = async function ( Criteria, Options ) { return await call_function( 'DeleteMany', [ 'Criteria', 'Options' ], [ Criteria, Options ] ); };
		Filter.FindMany2 = async function ( Criteria, Projection, Sort, MaxCount, Options ) { return await call_function( 'FindMany2', [ 'Criteria', 'Projection', 'Sort', 'MaxCount', 'Options' ], [ Criteria, Projection, Sort, MaxCount, Options ] ); };

		// ***The two which ask about the storage rather than about the documents in it.***
		//
		// ***This list had stopped at twelve and nothing was watching.*** StorageInfo was never
		// forwarded, so a storage with a filter in front of it answered `StorageInfo is not
		// implemented` - the stub, from the interface, reached because the filter never replaced
		// it. FindMany2 was not forwarded either and was not even a function. Both were invisible
		// because no test puts a filter in front of either call. Measured 2026-09-04, while
		// adding the fourteenth. See jsonx/.plans/primary-keys-and-indexes.md.
		Filter.StorageInfo = async function ( Options ) { return await call_function( 'StorageInfo', [ 'Options' ], [ Options ] ); };
		Filter.RefreshIndex = async function ( Options ) { return await call_function( 'RefreshIndex', [ 'Options' ], [ Options ] ); };


		//=====================================================================
		return Filter;
	},

};

