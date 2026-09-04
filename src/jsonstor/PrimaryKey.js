'use strict';

const jsongin = require( '@liquicode/jsongin' );

/*
	The primary key, and the index underneath it.

	***An index is a pushdown for an adapter with no server to push down to.***

	That is the whole idea. Statistics.js already reports every call as Pushdown/PushdownRows
	against Residual/ResidualRows, and for an adapter with no server the first pair is
	permanently null and the whole collection - every row travels, every time. An index does not
	add a measurement here; it makes an existing one start telling the truth. See
	jsonx/.plans/primary-keys-and-indexes.md.

	***The primary key is the first unique index.*** Enforcement and O(1) by-key lookup fall out
	of one structure, which is why the two questions are answered together rather than in
	sequence.

	***This module never decides the default.*** Resolve() reports what the Settings declared and
	nothing else, because an omitted declaration means different things to different adapters: a
	SQL adapter discovers its key from the catalog, and a built-in adapter has no catalog to
	discover from. Each adapter applies its own default, which is what jsonstor-sqlite has always
	done with `Settings.IdField || DEFAULT_ID_FIELD`.

	***IdField is the deprecated spelling of PrimaryKey*** and resolves to it. Two adapters are
	published declaring it, so unlike the TLS rename this one reaches released packages. It is
	accepted silently rather than warned about: StorageInfo().Warnings is asserted empty by
	D) Engine Contract Tests, and that assertion has caught a real defect, which is worth more
	than the notice would be.
*/

module.exports = function ()
{

	let PrimaryKey = {};


	// What an adapter with no catalog falls back to. Named here so that six adapters do not each
	// spell it, and so the field a document is keyed on has one definition in the family.
	PrimaryKey.DEFAULT_FIELD = '_id';

	// The medium's key holds a string unless the medium says otherwise. See EncodeValue - this
	// is about what the *medium* stores, never about what the document may hold.
	PrimaryKey.DEFAULT_TYPE = 's';


	//---------------------------------------------------------------------
	// What the Settings declared about the key.
	//
	// ***Every name comes back in an array***, so an adapter reads one shape whether it was
	// handed a name or a list of them. A composite key is declared here and honored by no adapter
	// yet - every by-key statement in this family locates a row by a single value - so an adapter
	// which cannot honor one refuses it by name rather than silently keying on the first field.
	PrimaryKey.Resolve = function ( Settings )
	{
		if ( jsongin.ShortType( Settings ) !== 'o' ) { Settings = {}; }

		// The deprecated spelling, only when the current one is absent. A Settings carrying both
		// is a caller mid-migration, and the new name is the one they meant.
		let declared_fields = Settings.PrimaryKey;
		if ( typeof declared_fields === 'undefined' ) { declared_fields = Settings.IdField; }

		let resolved = {
			Fields: to_string_array( declared_fields ),
			Types: to_string_array( Settings.PrimaryKeyType ),
			Mutable: ( Settings.PrimaryKeyMutable === true ),
			Generated: ( Settings.PrimaryKeyGenerated === true ),
			HostIndex: ( Settings.HostIndex === true ),
		};
		return resolved;
	};


	//---------------------------------------------------------------------
	// One name or a list of them, always as a list.
	function to_string_array( Value )
	{
		let short_type = jsongin.ShortType( Value );
		if ( short_type === 's' )
		{
			if ( !Value.length ) { return []; }
			return [ Value ];
		}
		if ( short_type !== 'a' ) { return []; }
		let names = [];
		for ( let index = 0; index < Value.length; index++ )
		{
			if ( jsongin.ShortType( Value[ index ] ) !== 's' ) { continue; }
			if ( !Value[ index ].length ) { continue; }
			names.push( Value[ index ] );
		}
		return names;
	}


	//---------------------------------------------------------------------
	// The string a key value is filed under.
	//
	// ***The short type is part of the key, so a number and a string never collide.*** jsongin
	// keeps 1 and '1' apart everywhere else, and an index which folded them together would refuse
	// an insert the engine considers a different document. This is the opposite of what a SQL
	// adapter's TEXT key column does, and deliberately so: there the medium cannot hold the type,
	// which is exactly why the payload carries the true _id beside it.
	//
	// ***An object or an array is encoded by its JSON, field order included.*** That is MongoDB's
	// own rule for an object _id - { a: 1, b: 2 } and { b: 2, a: 1 } are different keys - and it
	// is what makes the composite spelling available with no adapter change.
	PrimaryKey.EncodeValue = function ( Value )
	{
		let short_type = jsongin.ShortType( Value );
		if ( 'oa'.includes( short_type ) )
		{
			return short_type + ':' + JSON.stringify( Value );
		}
		return short_type + ':' + String( Value );
	};


	//---------------------------------------------------------------------
	// Whether a value can be found by an equality against a scalar.
	//
	// ***An array at the key is why this question exists.*** jsongin matches { _id: 'x' } against
	// a document whose _id is [ 'x' ], by the same array element rule every operator obeys - so an
	// index keyed on the array cannot answer that criteria and must not be asked to. A collection
	// holding one is scanned instead.
	PrimaryKey.IsScalar = function ( Value )
	{
		return 'snbl'.includes( jsongin.ShortType( Value ) );
	};


	//---------------------------------------------------------------------
	// The key value this document carries, or null when it has none.
	//
	// A composite key answers null the moment any one of its fields is absent, because a partial
	// key is not a key. jsongin.GetValue reads a dotted path, so a key field may name one.
	PrimaryKey.DocumentValue = function ( Document, Fields )
	{
		if ( jsongin.ShortType( Document ) !== 'o' ) { return null; }
		if ( !Fields.length ) { return null; }
		if ( Fields.length === 1 )
		{
			let value = jsongin.GetValue( Document, Fields[ 0 ] );
			if ( typeof value === 'undefined' ) { return null; }
			return value;
		}
		let values = [];
		for ( let index = 0; index < Fields.length; index++ )
		{
			let value = jsongin.GetValue( Document, Fields[ index ] );
			if ( typeof value === 'undefined' ) { return null; }
			values.push( value );
		}
		return values;
	};


	//---------------------------------------------------------------------
	// The encoded key of a document, or null when it has none.
	PrimaryKey.DocumentKey = function ( Document, Fields )
	{
		let value = PrimaryKey.DocumentValue( Document, Fields );
		if ( value === null ) { return null; }
		return PrimaryKey.EncodeValue( value );
	};


	//---------------------------------------------------------------------
	// The key a criteria asks for, or null when it does not ask for exactly one.
	//
	// ***This is the pushdown gate and it is deliberately narrow.*** It answers only for a
	// criteria whose single field is the key and whose operand is a scalar equality, written bare
	// or as $eq. Everything else - a second field, another operator, an object operand, a regexp -
	// falls through to the scan, which is always correct and merely slower. Widening this gate is
	// how an index starts losing rows, so a shape belongs here only once something asserts it.
	//
	// ***A composite key is never answered.*** A criteria naming two fields is an implicit $and
	// whose two operands may each match by an array element rule, and asking that of a single
	// encoded key would narrow.
	PrimaryKey.CriteriaKey = function ( Criteria, Fields )
	{
		if ( jsongin.ShortType( Criteria ) !== 'o' ) { return null; }
		if ( Fields.length !== 1 ) { return null; }

		let criteria_fields = Object.keys( Criteria );
		if ( criteria_fields.length !== 1 ) { return null; }
		if ( criteria_fields[ 0 ] !== Fields[ 0 ] ) { return null; }

		let value = Criteria[ criteria_fields[ 0 ] ];
		if ( jsongin.ShortType( value ) === 'o' )
		{
			// An operator object. Only a lone $eq is an equality; anything beside it, a second
			// operator included, is a question this index cannot answer.
			let operators = Object.keys( value );
			if ( operators.length !== 1 ) { return null; }
			if ( operators[ 0 ] !== '$eq' ) { return null; }
			value = value.$eq;
		}
		if ( !PrimaryKey.IsScalar( value ) ) { return null; }
		return PrimaryKey.EncodeValue( value );
	};


	//---------------------------------------------------------------------
	// The index itself.
	//
	// ***A Map keyed by the encoded key, holding an adapter specific locator.*** Not an array of
	// key-and-locator objects: that is O(n) to search and buys neither the uniqueness check nor
	// the lookup the index exists for - it would move the scan rather than remove it.
	//
	// The locator is whatever that adapter needs to reach the document: the document reference for
	// jsonstor-memory, the file name for jsonstor-folder, the store key for a key/value adapter.
	PrimaryKey.NewIndex = function ()
	{
		let index = {};

		index.Entries = new Map();

		// ***Set the moment a non-scalar key is filed***, and cleared only by a rebuild. While it
		// is set the index still enforces uniqueness and refuses to answer a lookup, because a
		// scalar equality may match inside an array the index has filed under one key.
		index.HasComplexKey = false;


		//-----------------------------------------------------------------
		index.Size = function ()
		{
			return index.Entries.size;
		};


		//-----------------------------------------------------------------
		index.Clear = function ()
		{
			index.Entries.clear();
			index.HasComplexKey = false;
			return;
		};


		//-----------------------------------------------------------------
		index.Has = function ( Key )
		{
			if ( Key === null ) { return false; }
			return index.Entries.has( Key );
		};


		//-----------------------------------------------------------------
		// ***Answers only when the index can answer exactly.*** A collection holding a non-scalar
		// key is scanned instead - undefined here means ask the scan, which is the same shape a
		// translator uses when it declines to render a predicate.
		index.Lookup = function ( Key )
		{
			if ( Key === null ) { return undefined; }
			if ( index.HasComplexKey ) { return undefined; }
			return index.Entries.get( Key );
		};


		//-----------------------------------------------------------------
		// ***Refuses a duplicate by name.*** This is the enforcement half, and it throws rather
		// than answering false because an insert which silently did not happen is the shape this
		// whole design exists to remove.
		index.Add = function ( Key, Locator, Value )
		{
			if ( Key === null ) { return false; }
			if ( index.Entries.has( Key ) )
			{
				throw new Error( `A document with this primary key already exists: ${ Key }.` );
			}
			if ( arguments.length > 2 )
			{
				if ( !PrimaryKey.IsScalar( Value ) ) { index.HasComplexKey = true; }
			}
			index.Entries.set( Key, Locator );
			return true;
		};


		//-----------------------------------------------------------------
		// Replaces an entry which is already there, for an update which kept its key.
		index.Set = function ( Key, Locator )
		{
			if ( Key === null ) { return false; }
			index.Entries.set( Key, Locator );
			return true;
		};


		//-----------------------------------------------------------------
		index.Remove = function ( Key )
		{
			if ( Key === null ) { return false; }
			return index.Entries.delete( Key );
		};


		return index;
	};


	return PrimaryKey;
};
