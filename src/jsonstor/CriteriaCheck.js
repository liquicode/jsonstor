'use strict';

const jsongin = require( '@liquicode/jsongin' );

/*
	A criteria the engine refuses is refused by every storage, before any server sees it.

	***jsongin is the reference for what a criteria means, and until now it was only the
	reference for the rows it happened to evaluate.*** A built-in engine evaluates every
	document with it, so an empty collection answered `[]` for `{ a: { $size: 2.5 } }` where a
	collection holding one document refused it. A server adapter evaluates only its residual
	with it, so a translator which claimed an exact answer skipped the engine altogether:
	DynamoDB answered an empty set for that same `$size`, MongoDB and CouchDB answered the
	whole collection for `{ $and: [] }`, and Couchbase answered a top level `$not` - every one
	a query jsongin refuses outright. Measured on the fleet on 2026-09-12 by
	`jsonx/.plans/tools/translator-parity-probe.js`.

	***`jsongin.ValidateQuery` is the whole check.*** It walks every operator at every level
	with `Query`'s own rules and never stops early - a trial evaluation against an empty
	document was the first shape of this, and it stopped at the first field which was false, so
	`{ session_id: x, value: { $size: 2.5 } }` passed it. A refusal surfaces with the engine's
	own message, the same one in every storage. A criteria which is not an object is left to
	the adapter, which already refuses it by contract; null and undefined mean the whole
	collection and are not a criteria.

	***What this does not check.*** An update document, whose checks need the stored document
	(a `$rename` from an array element cannot be seen against `{}`), and anything a criteria
	means only against data - a type mismatch, a missing field. Those stay where they are.

	Applied outermost, after the statistics wrapper, so a refused call is measured by nothing
	and reaches no filter. See `jsonx/.plans/jsongin-parity-repairs.md`.
*/

module.exports = function ()
{

	//---------------------------------------------------------------------
	// The storage functions which take a criteria, and where it is.
	//
	// ***Declared rather than derived***, the way Statistics.js declares the Options position.
	// The criteria is the first argument of every one of these, FindMany2 included.
	const CRITERIA_FUNCTIONS = {
		Count: 0,
		FindOne: 0,
		FindMany: 0,
		FindMany2: 0,
		UpdateOne: 0,
		UpdateMany: 0,
		ReplaceOne: 0,
		DeleteOne: 0,
		DeleteMany: 0,
	};


	//---------------------------------------------------------------------
	function Check( Criteria )
	{
		if ( jsongin.ShortType( Criteria ) !== 'o' ) { return; }
		jsongin.ValidateQuery( Criteria );
		return;
	}


	//---------------------------------------------------------------------
	function wrapped_function( Storage, Name, CriteriaIndex )
	{
		let original = Storage[ Name ];
		return async function ()
		{
			let args = Array.prototype.slice.call( arguments );
			Check( args[ CriteriaIndex ] );
			return await original.apply( Storage, args );
		};
	}


	//---------------------------------------------------------------------
	function Wrap( Storage )
	{
		if ( jsongin.ShortType( Storage ) !== 'o' ) { return Storage; }
		let names = Object.keys( CRITERIA_FUNCTIONS );
		for ( let index = 0; index < names.length; index++ )
		{
			let name = names[ index ];
			if ( typeof Storage[ name ] !== 'function' ) { continue; }
			Storage[ name ] = wrapped_function( Storage, name, CRITERIA_FUNCTIONS[ name ] );
		}
		return Storage;
	}


	//---------------------------------------------------------------------
	return {
		Wrap: Wrap,
		Check: Check,
	};

};
