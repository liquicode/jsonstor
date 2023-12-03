'use strict';

const jsongin = require( '@liquicode/jsongin' )();

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
			let expression = SqlExpression( Values[ index ], Options );
			if ( expression )
			{
				expressions.push( expression );
			}
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
										if ( !sub_expressions ) { continue; }
										let expr = '';
										if ( sub_expressions.length === 1 ) { expr = expressions[ 0 ]; }
										else { expr = sub_expressions.join( ' AND ' ); }
										if ( !expr ) { continue; }
										expressions.push( `(${expr})` );
									}
									break;
								case '$or':
									{
										if ( jsongin.ShortType( value ) !== 'a' ) { throw new Error( `SqlExpression: The operator [${key}] must be followed by an array.` ); }
										let sub_expressions = get_expression_array( value, options );
										if ( !sub_expressions ) { continue; }
										let expr = '';
										if ( sub_expressions.length === 1 ) { expr = expressions[ 0 ]; }
										else { expr = sub_expressions.join( ' OR ' ); }
										if ( !expr ) { continue; }
										expressions.push( `(${expr})` );
									}
									break;
								case '$nor':
									{
										if ( jsongin.ShortType( value ) !== 'a' ) { throw new Error( `SqlExpression: The operator [${key}] must be followed by an array.` ); }
										let sub_expressions = get_expression_array( value, options );
										if ( !sub_expressions ) { continue; }
										let expr = '';
										if ( sub_expressions.length === 1 ) { expr = expressions[ 0 ]; }
										else { expr = sub_expressions.join( ' OR ' ); }
										if ( !expr ) { continue; }
										expressions.push( `(NOT (${expr}))` );
									}
									break;
								case '$not':
									{
										let expr = SqlExpression( value, options );
										if ( !expr ) { continue; }
										expressions.push( `(NOT ${expr})` );
									}
									break;
								case '$eq':
								case '$eqx':
									{
										let expr = get_operation_expression( '=', value, options );
										if ( !expr ) { continue; }
										expressions.push( `(${expr})` );
									}
									break;
								case '$ne':
								case '$nex':
									{
										let expr = get_operation_expression( '<>', value, options );
										if ( !expr ) { continue; }
										expressions.push( `(${expr})` );
									}
									break;
								case '$lt':
									{
										let expr = get_operation_expression( '<', value, options );
										if ( !expr ) { continue; }
										expressions.push( `(${expr})` );
									}
									break;
								case '$lte':
									{
										let expr = get_operation_expression( '<=', value, options );
										if ( !expr ) { continue; }
										expressions.push( `(${expr})` );
									}
									break;
								case '$gt':
									{
										let expr = get_operation_expression( '>', value, options );
										if ( !expr ) { continue; }
										expressions.push( `(${expr})` );
									}
									break;
								case '$gte':
									{
										let expr = get_operation_expression( '>=', value, options );
										if ( !expr ) { continue; }
										expressions.push( `(${expr})` );
									}
									break;
								case '$in':
									{
										let expr = get_operation_expression( 'IN', value, options );
										if ( !expr ) { continue; }
										expressions.push( `(${expr})` );
									}
									break;
								case '$nin':
									{
										let expr = get_operation_expression( 'IN', value, options );
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
