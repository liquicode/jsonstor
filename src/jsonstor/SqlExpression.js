'use strict';

const jsongin = require( '@liquicode/jsongin' );

/*
	Builds a SQL WHERE clause from a jsonstor criteria.

	***This clause is a pre-filter and not the row filter.*** Every adapter which uses it
	(only jsonstor-mysql today) hands each returned row to jsongin.Query with the same
	criteria, so the statement decides how many rows travel and jsongin decides which ones
	match. jsonstor-mysql/SQL_Query says as much: "Do the actual query filtering here."

	***So the one invariant is: never render a clause which excludes a row the criteria
	would match.*** Returning too many rows costs time. Returning too few returns a wrong
	answer that nothing downstream can correct. When a condition cannot be rendered - an
	operand type SQL cannot carry, a field the caller did not allow - it is left out and
	the result broadens. That is why so much of this file drops rather than throws.

	***The trap is a logical operator, where dropping a child is not the same as
	broadening.*** Dropping an always true child of $or narrows the clause to its
	remaining children, which loses rows. $and is the only operator for which dropping a
	child is safe.
*/

module.exports = function ( jsonstor )
{

	//---------------------------------------------------------------------
	function get_operation_expression( Operator, Value, Options )
	{
		if ( !'bnsla'.includes( jsongin.ShortType( Value ) ) ) { return null; }
		if ( jsongin.ShortType( Options ) !== 'o' ) { throw new Error( `The Options parameter must be an object.` ); }
		let expr = '';
		if ( Options.FieldName )
		{
			expr += `${Options.IdentifierQuotes}${Options.FieldName}${Options.IdentifierQuotes} `;
		}
		if ( Operator )
		{
			expr += Operator + ' ';
		}
		expr += SqlExpression( Value, Options );
		return expr;
	}


	//---------------------------------------------------------------------
	function get_expression_array( Values, Options )
	{
		if ( jsongin.ShortType( Values ) !== 'a' ) { return null; }
		if ( jsongin.ShortType( Options ) !== 'o' ) { throw new Error( `The Options parameter must be an object.` ); }
		if ( Values.length === 0 ) { return null; }
		let expressions = [];
		for ( let index = 0; index < Values.length; index++ )
		{
			// An empty rendering is kept rather than skipped. It means the condition places
			// ***no constraint on the statement*** - either because it is always true, or
			// because nothing about it could be rendered - and only the operator holding it
			// knows what that implies. Skipping it here made { $or: [ {}, { a: 1 } ] }
			// render as ((a = 1)), which returns fewer rows than the criteria matches.
			expressions.push( SqlExpression( Values[ index ], Options ) );
		}
		return expressions;
	}


	//---------------------------------------------------------------------
	function SqlExpression( Criteria, Options = {} )
	{
		let options = jsongin.Clone( Options );
		if ( typeof options.StringLiteralQuotes === 'undefined' ) { options.StringLiteralQuotes = '"'; }
		if ( typeof options.IdentifierQuotes === 'undefined' ) { options.IdentifierQuotes = ''; }
		if ( typeof options.AllowedFields === 'undefined' ) { options.AllowedFields = null; }
		if ( typeof options.FieldName === 'undefined' ) { options.FieldName = ''; }


		switch ( jsongin.ShortType( Criteria ) )
		{

			//---------------------------------------------------------------------
			//	Values
			//---------------------------------------------------------------------

			case 'b':
				if ( Criteria === true ) { return 'TRUE'; }
				else if ( Criteria === false ) { return 'FALSE'; }
				else { throw new Error( `SqlExpression: Internal error 101` ); }
				break;
			case 'n':
				return '' + Criteria;
				break;
			case 's':
				Criteria = Criteria.replace( options.StringLiteralQuotes, `\\${options.StringLiteralQuotes}` );
				return `${options.StringLiteralQuotes}${Criteria}${options.StringLiteralQuotes}`;
				break;
			case 'l':
				return 'NULL';
				break;
			case 'a':
				{
					let expressions = [];
					for ( let index = 0; index < Criteria.length; index++ )
					{
						if ( 'bnsl'.includes( jsongin.ShortType( Criteria[ index ] ) ) )
						{
							expressions.push( SqlExpression( Criteria[ index ] ) );
						}
						else
						{
							throw new Error( `SqlExpression: Invalid array value.` );
						}
					}
					let expr = '(' + expressions.join( ', ' ) + ')';
					return expr;
				}
				break;

			//---------------------------------------------------------------------
			//	More Criteria
			//---------------------------------------------------------------------

			case 'o':
				{
					let expressions = [];
					for ( let key in Criteria )
					{
						let value = Criteria[ key ];
						if ( key.startsWith( '$' ) )
						{
							// Key is an operator.
							switch ( key )
							{
								case '$and':
									{
										if ( jsongin.ShortType( value ) !== 'a' ) { throw new Error( `SqlExpression: The operator [${key}] must be followed by an array.` ); }
										let sub_expressions = get_expression_array( value, options );
										if ( !sub_expressions ) { throw new Error( `SqlExpression: The operator [${key}] requires a non-empty array of criteria.` ); }
										// AND TRUE is the identity, so an always true condition is dropped.
										// If every condition was always true the whole clause constrains
										// nothing and contributes nothing.
										let terms = sub_expressions.filter( function ( Text ) { return Text !== ''; } );
										if ( !terms.length ) { continue; }
										let expr = '';
										if ( terms.length === 1 ) { expr = terms[ 0 ]; }
										else { expr = terms.join( ' AND ' ); }
										expressions.push( `(${expr})` );
									}
									break;
								case '$or':
									{
										if ( jsongin.ShortType( value ) !== 'a' ) { throw new Error( `SqlExpression: The operator [${key}] must be followed by an array.` ); }
										let sub_expressions = get_expression_array( value, options );
										if ( !sub_expressions ) { throw new Error( `SqlExpression: The operator [${key}] requires a non-empty array of criteria.` ); }
										// OR TRUE is TRUE, so one always true condition makes the whole
										// clause unconstraining. It contributes nothing to the enclosing
										// AND - which is not the same as dropping the condition and
										// keeping its neighbours, which is what used to happen.
										if ( sub_expressions.indexOf( '' ) >= 0 ) { continue; }
										let expr = '';
										if ( sub_expressions.length === 1 ) { expr = sub_expressions[ 0 ]; }
										else { expr = sub_expressions.join( ' OR ' ); }
										expressions.push( `(${expr})` );
									}
									break;
								case '$nor':
									{
										if ( jsongin.ShortType( value ) !== 'a' ) { throw new Error( `SqlExpression: The operator [${key}] must be followed by an array.` ); }
										let sub_expressions = get_expression_array( value, options );
										if ( !sub_expressions ) { throw new Error( `SqlExpression: The operator [${key}] requires a non-empty array of criteria.` ); }
										// A child which rendered nothing is either always true or merely not
										// renderable, and the two are indistinguishable here. FALSE would be right
										// for the first and would wrongly narrow the result for the second, so the
										// whole clause is dropped and the result broadens instead.
										if ( sub_expressions.indexOf( '' ) >= 0 ) { continue; }
										let expr = '';
										if ( sub_expressions.length === 1 ) { expr = sub_expressions[ 0 ]; }
										else { expr = sub_expressions.join( ' OR ' ); }
										expressions.push( `(NOT (${expr}))` );
									}
									break;
								case '$not':
									{
										let expr = SqlExpression( value, options );
										// An empty operand renders nothing and the clause is left out, broadening
										// the result. MongoDB refuses this criteria outright; jsongin is the one that
										// gets to say so, not the statement builder.
										if ( !expr ) { continue; }
										expressions.push( `(NOT ${expr})` );
									}
									break;
								case '$eq':
								case '$eqx':
									{
										let expr = get_operation_expression( '=', value, options );
										// The operand is a type SQL cannot carry, so this condition is left out of
										// the statement and the caller sees a broader result. That is safe: the row
										// filter is jsongin, not the WHERE clause. See the note at the top.
										if ( !expr ) { continue; }
										expressions.push( `(${expr})` );
									}
									break;
								case '$ne':
								case '$nex':
									{
										let expr = get_operation_expression( '<>', value, options );
										// The operand is a type SQL cannot carry, so this condition is left out of
										// the statement and the caller sees a broader result. That is safe: the row
										// filter is jsongin, not the WHERE clause. See the note at the top.
										if ( !expr ) { continue; }
										expressions.push( `(${expr})` );
									}
									break;
								case '$lt':
									{
										let expr = get_operation_expression( '<', value, options );
										// The operand is a type SQL cannot carry, so this condition is left out of
										// the statement and the caller sees a broader result. That is safe: the row
										// filter is jsongin, not the WHERE clause. See the note at the top.
										if ( !expr ) { continue; }
										expressions.push( `(${expr})` );
									}
									break;
								case '$lte':
									{
										let expr = get_operation_expression( '<=', value, options );
										// The operand is a type SQL cannot carry, so this condition is left out of
										// the statement and the caller sees a broader result. That is safe: the row
										// filter is jsongin, not the WHERE clause. See the note at the top.
										if ( !expr ) { continue; }
										expressions.push( `(${expr})` );
									}
									break;
								case '$gt':
									{
										let expr = get_operation_expression( '>', value, options );
										// The operand is a type SQL cannot carry, so this condition is left out of
										// the statement and the caller sees a broader result. That is safe: the row
										// filter is jsongin, not the WHERE clause. See the note at the top.
										if ( !expr ) { continue; }
										expressions.push( `(${expr})` );
									}
									break;
								case '$gte':
									{
										let expr = get_operation_expression( '>=', value, options );
										// The operand is a type SQL cannot carry, so this condition is left out of
										// the statement and the caller sees a broader result. That is safe: the row
										// filter is jsongin, not the WHERE clause. See the note at the top.
										if ( !expr ) { continue; }
										expressions.push( `(${expr})` );
									}
									break;
								case '$in':
									{
										let expr = get_operation_expression( 'IN', value, options );
										// The operand is a type SQL cannot carry, so this condition is left out of
										// the statement and the caller sees a broader result. That is safe: the row
										// filter is jsongin, not the WHERE clause. See the note at the top.
										if ( !expr ) { continue; }
										expressions.push( `(${expr})` );
									}
									break;
								case '$nin':
									{
										let expr = get_operation_expression( 'IN', value, options );
										// The operand is a type SQL cannot carry, so this condition is left out of
										// the statement and the caller sees a broader result. That is safe: the row
										// filter is jsongin, not the WHERE clause. See the note at the top.
										if ( !expr ) { continue; }
										expressions.push( `(NOT (${expr}))` );
									}
									break;
								default:
									throw new Error( `SqlExpression: Invalid operator [${key}] found at this level. Expected a logical operator.` );
							}
						}
						else
						{
							// Key is a field.
							let child_options = jsongin.Clone( options );
							if ( Options && Options.AllowedFields )
							{
								if ( typeof Options.AllowedFields[ key ] === 'undefined' ) { continue; }
							}
							child_options.FieldName = key;

							let expr = '';
							if ( 'bnsla'.includes( jsongin.ShortType( value ) ) )
							{
								expr = get_operation_expression( '=', value, child_options );
								expr = `(${expr})`;
							}
							else
							{
								expr = SqlExpression( value, child_options );
							}
							// Nothing renderable for this field, so it contributes no constraint and the
							// result broadens. jsongin still applies the field criteria to every row.
							if ( !expr ) { continue; }
							expressions.push( expr );
							// expressions.push( `(${expr})` );
						}

					}
					if ( !expressions.length ) { return ''; }
					if ( expressions.length === 1 )
					{
						return expressions[ 0 ];
					}
					else
					{
						let expr = '(' + expressions.join( ' AND ' ) + ')';
						return expr;
					}
					return null; // Unreachable code.
				}
				break;

			// Invalid Criteria
			case 'r':
			case 'f':
			case 'y':
			case 'u':
			default: throw new Error( `SqlExpression: The Criteria [${JSON.stringify( Criteria )}] is invalid.` );
		}

		return null; // Unreachable code.
	}





	return SqlExpression;
};
