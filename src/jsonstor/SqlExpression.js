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
		// Only IN takes a list. Every other operator compares against a single value, and
		// an array operand renders as a row constructor - `field = (1, 2)` - which MySQL
		// refuses outright with "Operand should contain 1 column(s)".
		if ( ( jsongin.ShortType( Value ) === 'a' ) && ( Operator !== 'IN' ) ) { return null; }
		if ( jsongin.ShortType( Options ) !== 'o' ) { throw new Error( `The Options parameter must be an object.` ); }
		// The value is rendered first. A value SQL cannot carry renders as nothing, and the
		// condition is dropped rather than emitted with an empty or malformed operand.
		let value_expr = SqlExpression( Value, Options );
		if ( !value_expr ) { return null; }
		let expr = '';
		if ( Options.FieldName )
		{
			expr += `${Options.IdentifierQuotes}${Options.FieldName}${Options.IdentifierQuotes} `;
		}
		if ( Operator )
		{
			expr += Operator + ' ';
		}
		expr += value_expr;
		return expr;
	}


	//---------------------------------------------------------------------
	function get_field_reference( Options )
	{
		if ( !Options.FieldName ) { return ''; }
		return `${Options.IdentifierQuotes}${Options.FieldName}${Options.IdentifierQuotes}`;
	}


	//---------------------------------------------------------------------
	function list_contains_null( Values )
	{
		if ( jsongin.ShortType( Values ) !== 'a' ) { return false; }
		for ( let index = 0; index < Values.length; index++ )
		{
			if ( jsongin.ShortType( Values[ index ] ) === 'l' ) { return true; }
		}
		return false;
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
					// An empty list renders as `()`, which is a syntax error rather than a constraint.
					if ( Criteria.length === 0 ) { return ''; }
					let expressions = [];
					for ( let index = 0; index < Criteria.length; index++ )
					{
						// An element SQL cannot carry cannot be listed, so the whole condition is
						// dropped and the result broadens.
						if ( !'bnsl'.includes( jsongin.ShortType( Criteria[ index ] ) ) ) { return ''; }
						expressions.push( SqlExpression( Criteria[ index ] ) );
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
										// SQL has no value which is equal to NULL, so `field = NULL` matches nothing
										// while the criteria matches every row whose field is null or absent. IS NULL
										// is the faithful rendering, and an absent field is a NULL column here.
										if ( jsongin.ShortType( value ) === 'l' )
										{
											let field_ref = get_field_reference( options );
											if ( !field_ref ) { continue; }
											expressions.push( `(${field_ref} IS NULL)` );
											break;
										}
										let expr = get_operation_expression( '=', value, options );
										// The operand is a type SQL cannot carry, so this condition is left out of the
										// statement and the caller sees a broader result. See the note at the top.
										if ( !expr ) { continue; }
										expressions.push( `(${expr})` );
									}
									break;
								case '$ne':
								case '$nex':
									{
										// The mirror of $eq. `field <> NULL` is never true, and for a real operand SQL
										// drops every row whose field is NULL - which the criteria keeps, because an
										// absent field is not equal to anything. Those rows are added back by name.
										let field_ref = get_field_reference( options );
										if ( jsongin.ShortType( value ) === 'l' )
										{
											if ( !field_ref ) { continue; }
											expressions.push( `(${field_ref} IS NOT NULL)` );
											break;
										}
										let expr = get_operation_expression( '<>', value, options );
										if ( !expr ) { continue; }
										if ( !field_ref ) { expressions.push( `(${expr})` ); }
										else { expressions.push( `((${expr}) OR ${field_ref} IS NULL)` ); }
									}
									break;
								case '$lt':
									{
										// A comparison against null is not an ordering question - the criteria selects
										// null and absent fields - and SQL answers UNKNOWN, dropping exactly the rows
										// which should have been kept. It is left out and the result broadens.
										if ( jsongin.ShortType( value ) === 'l' ) { continue; }
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
										// A comparison against null is not an ordering question - the criteria selects
										// null and absent fields - and SQL answers UNKNOWN, dropping exactly the rows
										// which should have been kept. It is left out and the result broadens.
										if ( jsongin.ShortType( value ) === 'l' ) { continue; }
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
										// A comparison against null is not an ordering question - the criteria selects
										// null and absent fields - and SQL answers UNKNOWN, dropping exactly the rows
										// which should have been kept. It is left out and the result broadens.
										if ( jsongin.ShortType( value ) === 'l' ) { continue; }
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
										// A comparison against null is not an ordering question - the criteria selects
										// null and absent fields - and SQL answers UNKNOWN, dropping exactly the rows
										// which should have been kept. It is left out and the result broadens.
										if ( jsongin.ShortType( value ) === 'l' ) { continue; }
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
										if ( !expr ) { continue; }
										// A NULL column satisfies no IN list, so a list which names null needs those
										// rows added back explicitly.
										let field_ref = get_field_reference( options );
										if ( field_ref && list_contains_null( value ) ) { expressions.push( `((${expr}) OR ${field_ref} IS NULL)` ); }
										else { expressions.push( `(${expr})` ); }
									}
									break;
								case '$nin':
									{
										let expr = get_operation_expression( 'IN', value, options );
										if ( !expr ) { continue; }
										// NOT IN is UNKNOWN for a NULL column, so SQL drops those rows while the
										// criteria keeps them - an absent field is in no list.
										let field_ref = get_field_reference( options );
										if ( !field_ref ) { expressions.push( `(NOT (${expr}))` ); }
										else { expressions.push( `((NOT (${expr})) OR ${field_ref} IS NULL)` ); }
									}
									break;
								default:
									// An operator this builder cannot render - $exists, $type, $size, $all,
									// $elemMatch, and anything added later - places no constraint on the
									// statement, so it is left out and the result broadens. jsongin still
									// applies the whole criteria to every row, and jsongin is what refuses
									// an operator which is genuinely invalid.
									continue;
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
							// `field = NULL` is never true in SQL, while the criteria matches every row whose
							// field is null or absent - and an absent field is a NULL column here.
							if ( jsongin.ShortType( value ) === 'l' )
							{
								expressions.push( `(${get_field_reference( child_options )} IS NULL)` );
								continue;
							}
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
			// A RegExp, a function, a symbol or an undefined has no SQL form. It constrains
			// nothing here, and jsongin applies it to every row instead.
			default: return '';
		}

		return null; // Unreachable code.
	}





	return SqlExpression;
};
