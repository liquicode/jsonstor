'use strict';

const LIB_FS = require( 'fs' );
const LIB_PATH = require( 'path' );

const jsongin = require( '@liquicode/jsongin' )();

module.exports = function ( AdapterName, Settings, Filters )
{
	let jsonstor = {


		//---------------------------------------------------------------------
		Adapters: {},
		Filters: {},


		//---------------------------------------------------------------------
		LoadPlugin: function ( Plugin )
		{
			if ( jsongin.ShortType( Plugin ) === 'o' )
			{
				if ( Plugin.AdapterName ) 
				{
					if ( typeof jsonstor.Adapters[ Plugin.AdapterName ] !== 'undefined' )
					{
						throw new Error( `Storage adapter [${Plugin.AdapterName}] already exists.` );
					}
					jsonstor.Adapters[ Plugin.AdapterName ] = Plugin;
				}
				else if ( Plugin.FilterName )
				{
					if ( typeof jsonstor.Filters[ Plugin.FilterName ] !== 'undefined' )
					{
						throw new Error( `Storage filter [${Plugin.FilterName}] already exists.` );
					}
					jsonstor.Filters[ Plugin.FilterName ] = Plugin;
				}
				else { return null; }
			}
			return Plugin;
		},


		//---------------------------------------------------------------------
		LoadPlugins: function ( Path, Recurse )
		{
			if ( !LIB_FS.existsSync( Path ) ) { throw new Error( `The path [${Path}] does not exist.` ); }
			let dir_entries = LIB_FS.readdirSync( Path, { withFileTypes: true } );
			for ( let index = 0; index < dir_entries.length; index++ )
			{
				let entry = dir_entries[ index ];
				if ( entry.isDirectory() && Recurse )
				{
					jsonstor.LoadPlugins( LIB_PATH.join( Path, entry.name ), true );
				}
				else if ( entry.isFile() )
				{
					try
					{
						let filename = LIB_PATH.join( Path, entry.name );
						let plugin = jsonstor.LoadPlugin( require( filename ) );
					}
					catch ( error )
					{
						console.error( error );
					}
				}
			}
			return;
		},


		//---------------------------------------------------------------------
		GetStorage: function ( AdapterName, Settings, Filters )
		{
			if ( !'olu'.includes( jsongin.ShortType( Settings ) ) ) { throw new Error( `The Settings parameter must be an object, null, or undefined.` ); }
			if ( 'lu'.includes( jsongin.ShortType( Settings ) ) ) { Settings = {}; }
			if ( typeof jsonstor.Adapters[ AdapterName ] === 'undefined' ) { throw new Error( `Storage adapter [${AdapterName}] is not loaded.` ); }
			let storage = jsonstor.Adapters[ AdapterName ].GetAdapter( jsonstor, Settings );
			storage.AdapterName = AdapterName;
			if ( Array.isArray( Filters ) )
			{
				for ( let index = 0; index < Filters.length; index++ )
				{
					let item = Filters[ index ];
					if ( jsongin.ShortType( item ) !== 'o' ) { throw new Error( `The Filters parameter must be an array of filter entries: { FilterName: '...', Settings: {...} }.` ); }
					if ( typeof item.FilterName === 'undefined' ) { throw new Error( `The FilterName field is required.` ); }
					if ( typeof jsonstor.Filters[ item.FilterName ] === 'undefined' ) { throw new Error( `Storage filter [${item.FilterName}] is not loaded.` ); }
					storage = jsonstor.Filters[ item.FilterName ].GetFilter( jsonstor, storage, item.Settings );
					storage.FilterName = item.FilterName;
				}
			}
			return storage;
		},


		//---------------------------------------------------------------------
		GetFilter: function ( FilterName, Storage, Settings )
		{
			if ( jsongin.ShortType( FilterName ) !== 's' ) { throw new Error( `The FilterName field must be a string.` ); }
			if ( !'olu'.includes( jsongin.ShortType( Settings ) ) ) { throw new Error( `The Settings parameter must be an object, null, or undefined.` ); }
			if ( 'lu'.includes( jsongin.ShortType( Settings ) ) ) { Settings = {}; }
			if ( typeof jsonstor.Filters[ FilterName ] === 'undefined' ) { throw new Error( `Storage filter [${FilterName}] is not loaded.` ); }
			let storage = jsonstor.Filters[ FilterName ].GetFilter( jsonstor, Storage, Settings );
			storage.FilterName = FilterName;
			return storage;
		},


		//---------------------------------------------------------------------
		StorageInterface: function ()
		{
			let storage = {
				// Storage Interface
				DropStorage: async function ( Options ) { throw new Error( 'DropStorage is not implemeted.' ); },
				FlushStorage: async function ( Options ) { throw new Error( 'FlushStorage is not implemeted.' ); },
				Count: async function ( Criteria, Options ) { throw new Error( 'Count is not implemeted.' ); },
				InsertOne: async function ( Document, Options ) { throw new Error( 'InsertOne is not implemeted.' ); },
				InsertMany: async function ( Documents, Options ) { throw new Error( 'InsertMany is not implemeted.' ); },
				FindOne: async function ( Criteria, Projection, Options ) { throw new Error( 'FindOne is not implemeted.' ); },
				FindMany: async function ( Criteria, Projection, Options ) { throw new Error( 'FindMany is not implemeted.' ); },
				UpdateOne: async function ( Criteria, Updates, Options ) { throw new Error( 'UpdateOne is not implemeted.' ); },
				UpdateMany: async function ( Criteria, Updates, Options ) { throw new Error( 'UpdateMany is not implemeted.' ); },
				ReplaceOne: async function ( Criteria, Document, Options ) { throw new Error( 'ReplaceOne is not implemeted.' ); },
				DeleteOne: async function ( Criteria, Options ) { throw new Error( 'DeleteOne is not implemeted.' ); },
				DeleteMany: async function ( Criteria, Options ) { throw new Error( 'DeleteMany is not implemeted.' ); },
			};
			return storage;
		},


		//---------------------------------------------------------------------
		SqlExpression: get_sql_expression,


	};


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
		expr += get_sql_expression( Value, Options );
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
			let expression = get_sql_expression( Values[ index ], Options );
			expressions.push( expression );
		}
		return expressions;
	}


	//---------------------------------------------------------------------
	function get_sql_expression( Criteria, Options = {} )
	{
		let options = jsongin.Clone( Options );
		if ( typeof options.StringLiteralQuotes === 'undefined' ) { options.StringLiteralQuotes = '"'; }
		if ( typeof options.IdentifierQuotes === 'undefined' ) { options.IdentifierQuotes = ''; }
		if ( typeof options.AllowDocumentPaths === 'undefined' ) { options.AllowDocumentPaths = false; }
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
							expressions.push( get_sql_expression( Criteria[ index ] ) );
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
										expressions.push( `(NOT (${expr}))` );
									}
									break;
								case '$not':
									{
										let expr = get_sql_expression( value, options );
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
								default: throw new Error( `SqlExpression: Invalid operator [${key}] found at this level. Expected a logical operator.` );
							}
						}
						else
						{
							// Key is a field.
							if ( !options.AllowDocumentPaths && key.includes( '.' ) ) { continue; }
							let child_options = jsongin.Clone( options );
							if ( !child_options.StringLiteralQuotes && key.includes( '.' ) ) { child_options.StringLiteralQuotes = '"'; }
							child_options.FieldName = key;
							let expr = '';
							if ( 'bnsla'.includes( jsongin.ShortType( value ) ) )
							{
								expr = get_operation_expression( '=', value, child_options );
								expr = `(${expr})`;
							}
							else
							{
								expr = get_sql_expression( value, child_options );
							}
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


	//---------------------------------------------------------------------
	// Storages.LoadPlugins( __dirname, true );
	// Load Adapters
	jsonstor.LoadPlugin( require( './Adapters/jsonstor-memory' ) );
	jsonstor.LoadPlugin( require( './Adapters/jsonstor-jsonfile' ) );
	jsonstor.LoadPlugin( require( './Adapters/jsonstor-folder' ) );
	// Storages.LoadPlugin( require( './Adapters/jsonstor-mongodb' ) );
	// Storages.LoadPlugin( require( './Adapters/jsonstor-excel' ) );
	// Load Filters
	jsonstor.LoadPlugin( require( './Filters/jsonstor-oplog' ) );
	jsonstor.LoadPlugin( require( './Filters/jsonstor-userinfo' ) );


	//---------------------------------------------------------------------
	if ( typeof AdapterName === 'string' )
	{
		let storage = jsonstor.GetStorage( AdapterName, Settings, Filters );
		return storage;
	}


	return jsonstor;
};


