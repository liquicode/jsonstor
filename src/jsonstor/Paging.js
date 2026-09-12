'use strict';

const jsongin = require( '@liquicode/jsongin' );

/*
	Paging: the fourth parameter of FindMany2.

	***A page is a skip and a limit, taken after the sort.*** FindMany2 took an integer
	MaxCount from the day it existed, and the jsonx specification (section 9.4) made SkipCount
	and MaxCount a page: the documents the criteria selects, in Sort order, with SkipCount of
	them passed over and then at most MaxCount read. So the parameter is now either of two
	shapes, and this module is the one place both are read:

		10                              ten documents, the integer form, as before
		{ SkipCount: 25, MaxCount: 25 } the second page of twenty-five
		{ SkipCount: 25 }               everything after the first twenty-five
		null, undefined, 0, {}          no skip and no limit

	***Zero means no limit, as the interface has always said***, and this module is where that
	is enforced. Before it, every adapter applied the limit with its own line, and one of them
	(jsonstor-dynamodb) read a MaxCount of 0 as "return nothing" - a caller passing
	`MaxCount || 0` got an empty answer from that one adapter and every document from the rest.
	Nothing asserted the rule, so nothing caught it.

	***Anything else is refused here, before a server sees it.*** A negative count, a fraction,
	a string, or a field this module does not define is an error naming the parameter - the
	same rule CriteriaCheck applies to a criteria. An adapter which pushes the page down
	(jsonstor-mongodb's .skip() and .limit()) calls Normalize; an adapter which sorts in process
	calls Apply on the sorted array; neither reads the parameter itself.

	Reached by the built-in adapters as `require( '../jsonstor/Paging' )()` and by the external
	adapters as `jsonstor.Paging`, the way PrimaryKey is. See jsonx/.plans/jsonx-specification.md.
*/

module.exports = function ()
{

	let Paging = {};


	// The two fields a paging object may carry. Anything else is a misspelling, and a
	// misspelled MaxCount which silently meant "no limit" would be the DynamoDB defect again
	// from the other side.
	const FIELDS = [ 'SkipCount', 'MaxCount' ];


	//---------------------------------------------------------------------
	function paging_error( Message )
	{
		return new Error( `Paging ${Message}` );
	}


	//---------------------------------------------------------------------
	// Reads one count: absent is zero, and anything which is not an integer of zero or more
	// is refused by name.
	function read_count( Value, Name )
	{
		if ( 'lu'.includes( jsongin.ShortType( Value ) ) ) { return 0; }
		if ( jsongin.ShortType( Value ) !== 'n' ) { throw paging_error( `${Name} must be an integer of zero or more.` ); }
		if ( !Number.isInteger( Value ) ) { throw paging_error( `${Name} must be an integer of zero or more.` ); }
		if ( Value < 0 ) { throw paging_error( `${Name} must be an integer of zero or more.` ); }
		return Value;
	}


	//---------------------------------------------------------------------
	// Normalize( Paging ) -> { SkipCount, MaxCount }
	//
	// Every form FindMany2 accepts, reduced to the one shape an adapter reads. Zero in either
	// field means none.
	Paging.Normalize = function Normalize( Value )
	{
		let short_type = jsongin.ShortType( Value );
		if ( 'lu'.includes( short_type ) )
		{
			return { SkipCount: 0, MaxCount: 0 };
		}
		if ( short_type === 'n' )
		{
			return { SkipCount: 0, MaxCount: read_count( Value, 'MaxCount' ) };
		}
		if ( short_type === 'o' )
		{
			let keys = Object.keys( Value );
			for ( let index = 0; index < keys.length; index++ )
			{
				if ( !FIELDS.includes( keys[ index ] ) )
				{
					throw paging_error( `does not take a field named [${keys[ index ]}]; it takes SkipCount and MaxCount.` );
				}
			}
			return {
				SkipCount: read_count( Value.SkipCount, 'SkipCount' ),
				MaxCount: read_count( Value.MaxCount, 'MaxCount' ),
			};
		}
		throw paging_error( 'must be an integer, an object of SkipCount and MaxCount, null, or undefined.' );
	};


	//---------------------------------------------------------------------
	// Apply( Documents, Paging ) -> Documents
	//
	// The page of an already-sorted array. Answers the array itself when there is nothing to
	// do, and a copy otherwise; never changes what it was given.
	Paging.Apply = function Apply( Documents, Value )
	{
		let paging = Paging.Normalize( Value );
		if ( ( paging.SkipCount === 0 ) && ( paging.MaxCount === 0 ) ) { return Documents; }
		let end = undefined;
		if ( paging.MaxCount > 0 ) { end = paging.SkipCount + paging.MaxCount; }
		return Documents.slice( paging.SkipCount, end );
	};


	return Paging;
};
