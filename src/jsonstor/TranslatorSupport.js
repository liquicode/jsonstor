'use strict';

const jsongin = require( '@liquicode/jsongin' );

/*
	The questions every criteria translator has to ask, and none of the answers.

	***Nothing in this file mentions a target.*** What a clause looks like, how a literal is
	escaped, what an engine calls NULL - all of that belongs to a translator. What lives here
	is the part which is the same whether the pushdown is a SQL string, a Mango object or a
	DynamoDB expression: the shape of a jsongin criteria, and what the field allowlist says.

	***These were SqlExpression's private helpers*** until a second translator was in
	prospect. They are here because every translator author needs them and every translator
	author would otherwise get them wrong independently - which is the whole reason jsonstor
	carries translation machinery at all.

	***The invariant they serve is one sentence:*** a pushdown may admit rows the criteria
	rejects, and must never reject a row the criteria admits. Returning too many rows costs
	time; returning too few is a wrong answer nothing downstream can correct.

	***The trap they exist for is the logical operators***, where dropping a child is not the
	same as broadening. Dropping an always-true child of $or narrows the clause to its
	remaining children and loses rows; $and is the only operator for which dropping a child
	is safe. See CriteriaNamesProjection for the same asymmetry one level up.
*/

module.exports = function ()
{

	//---------------------------------------------------------------------
	// Whether an object describes a field, or is a value the field is compared against.
	//
	// { $gte: 1, $lte: 5 } describes the field and is rendered. { a: 1 } is an object the
	// field must equal, and SQL has no form for that. An empty object is a value too: it
	// matches only a field which holds an empty object.
	function is_operator_object( Value )
	{
		if ( jsongin.ShortType( Value ) !== 'o' ) { return false; }
		let keys = Object.keys( Value );
		if ( !keys.length ) { return false; }
		for ( let index = 0; index < keys.length; index++ )
		{
			if ( !keys[ index ].startsWith( '$' ) ) { return false; }
		}
		return true;
	}


	//---------------------------------------------------------------------
	function field_is_projection( FieldName, Options )
	{
		if ( !Options.AllowedFields ) { return false; }
		if ( !FieldName ) { return false; }
		let field = Options.AllowedFields[ FieldName ];
		if ( !field ) { return false; }
		return ( field.is_projection === true );
	}


	//---------------------------------------------------------------------
	// Whether a criteria names any projected column, at any depth.
	//
	// ***Broadening has to happen outside the negation, and a logical operator turns it
	// inside out.*** A field level condition is broadened where it is pushed, which is already
	// outside its own $not - but $nor and a top level $not negate an expression built further
	// down, where the disjunct has been added: `NOT (col = x OR col IS NULL)` is
	// `col <> x AND col IS NOT NULL`, which drops the very rows F4 exists to keep. There is no
	// wrapping which repairs that, so the whole operator is dropped instead and the result
	// broadens.
	function criteria_names_projection( Criteria, Options )
	{
		let st = jsongin.ShortType( Criteria );
		if ( st === 'a' )
		{
			for ( let index = 0; index < Criteria.length; index++ )
			{
				if ( criteria_names_projection( Criteria[ index ], Options ) ) { return true; }
			}
			return false;
		}
		if ( st !== 'o' ) { return false; }
		for ( let key in Criteria )
		{
			if ( !key.startsWith( '$' ) )
			{
				if ( field_is_projection( key, Options ) ) { return true; }
			}
			if ( criteria_names_projection( Criteria[ key ], Options ) ) { return true; }
		}
		return false;
	}


	//---------------------------------------------------------------------
	// Whether an operand is the same kind of value as the column it is compared against.
	//
	// ***jsongin compares by type where SQL coerces.*** A boolean is never equal to a string
	// to jsongin, so { b: { $ne: '0' } } matches every row - while MySQL reads "0" as 0, finds
	// it equal to a false column, and drops exactly those rows.
	//
	// ***Only the negating comparisons need this.*** Under a type mismatch $eq and $in match
	// nothing in jsongin, so a coercing clause only admits extra rows; and jsongin refuses a
	// cross type ordering outright, which makes $lt and its siblings match nothing either.
	// $ne, $nex and $nin are the ones which match everything, and so have rows to lose.
	//
	// A column whose type the caller did not declare is not second guessed: with no
	// AllowedFields entry there is nothing to compare the operand against.
	function operand_type_agrees( Value, Options )
	{
		if ( !Options.AllowedFields ) { return true; }
		if ( !Options.FieldName ) { return true; }
		let field = Options.AllowedFields[ Options.FieldName ];
		if ( !field ) { return true; }
		if ( !field.short_type ) { return true; }
		let values = ( jsongin.ShortType( Value ) === 'a' ) ? Value : [ Value ];
		for ( let index = 0; index < values.length; index++ )
		{
			// A null is not a type mismatch. It is asked about with IS NULL instead.
			if ( jsongin.ShortType( values[ index ] ) === 'l' ) { continue; }
			if ( jsongin.ShortType( values[ index ] ) !== field.short_type ) { return false; }
		}
		return true;
	}


	//---------------------------------------------------------------------
	// Splits an operand list into its non-null values and whether it named a null.
	//
	// A NULL in an IN list poisons the whole comparison: `2 IN (10, NULL)` is UNKNOWN rather
	// than false, so NOT of it is UNKNOWN too and the row is dropped even though 2 is plainly
	// not in the list. The nulls come out of the list and are asked about with IS NULL instead.
	function split_null_values( Values )
	{
		let result = { Values: [], HasNull: false };
		if ( jsongin.ShortType( Values ) !== 'a' ) { return result; }
		for ( let index = 0; index < Values.length; index++ )
		{
			if ( jsongin.ShortType( Values[ index ] ) === 'l' ) { result.HasNull = true; continue; }
			result.Values.push( Values[ index ] );
		}
		return result;
	}


	return {
		IsOperatorObject: is_operator_object,
		FieldIsProjection: field_is_projection,
		CriteriaNamesProjection: criteria_names_projection,
		OperandTypeAgrees: operand_type_agrees,
		SplitNullValues: split_null_values,
	};
};
