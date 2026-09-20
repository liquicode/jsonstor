'use strict';

const jsongin = require( '@liquicode/jsongin' );

const NewUniqueID = require( './NewUniqueID' );

/*
	***`WithUndo( Handler )` - a scope whose writes can be put back.***

	This is a ***compensating undo***, which is the literature's name for it, built as an undo
	log: every write inside the scope is recorded together with the write which reverses it, and
	a failure replays those in reverse.

	***It is not a transaction.*** Nothing is isolated and nothing is deferred. Every write
	happens when it is made, another program sees it at once, a read inside the scope sees the
	scope's own writes, and an undo can only overwrite whatever is there by the time it runs. The
	word `transaction` is kept free for something which one day promises more than this.

	***The handler is given a storage of its own, and only calls on that object are recorded.***
	A call on the outer storage inside the handler is outside the scope and survives - which is
	how a caller writes a line that must not be reversed.

	***The scoped object is a shim and nothing else.*** It puts an id on the Options of each
	write and hands the call straight back to the storage it came from, so a write inside a scope
	travels through every layer a write outside one does: the criteria is validated, the
	statistics are collected, the filters run. This layer then reads that id off the Options,
	records what it needs, takes the id back out, and forwards an ordinary call inward.

	***The id is a plain string, and it has to be.*** `jsonstor-userinfo` rebuilds a caller's
	Options with `JSON.parse( JSON.stringify( ... ) )` at twelve sites, so a Symbol, a handle or
	a function would not survive the trip down. A string does.

	***Undo is jsonstor's alone.*** No adapter implements it, declares it or can override it
	*(user, 2026-09-20)*. There is no capability member anywhere in this file, nothing here asks
	an adapter a question it does not already answer, and `StorageInfo()` gains nothing from it -
	a fact which is the same on all nineteen adapters and can never change is noise.
*/

module.exports = function ( Statistics )
{

	// The writes which are recorded. Reads, `FlushStorage` and `RefreshIndex` are not.
	const WRITES = [ 'InsertOne', 'InsertMany', 'UpdateOne', 'UpdateMany', 'ReplaceOne', 'DeleteOne', 'DeleteMany' ];

	// Everything this layer calls for itself, captured before any of it is wrapped.
	const INNER = [ 'FindMany', 'InsertOne', 'UpdateOne', 'DeleteOne', 'StorageInfo' ];

	const UNDO_ID = 'UndoID';


	//---------------------------------------------------------------------
	function is_object( Value ) { return jsongin.ShortType( Value ) === 'o'; }


	// ***A document addressed by its identifier.*** Every adapter keeps the key unique and
	// immutable, which is the whole reason a before-image stays findable while the scope runs.
	// Written for a composite key although no adapter honors one yet, because the declaration
	// already is an array.
	function key_criteria( Document, Fields )
	{
		if ( !is_object( Document ) ) { return null; }
		let criteria = {};
		for ( let index = 0; index < Fields.length; index++ )
		{
			let value = jsongin.GetValue( Document, Fields[ index ] );
			if ( typeof value === 'undefined' ) { return null; }
			criteria[ Fields[ index ] ] = value;
		}
		return criteria;
	}


	// A string which tells one document from another, for pairing a before-image to the document
	// the store answered with.
	function key_text( Document, Fields )
	{
		let criteria = key_criteria( Document, Fields );
		if ( criteria === null ) { return null; }
		return JSON.stringify( criteria );
	}


	//---------------------------------------------------------------------
	// Installs `WithUndo` on a storage, in place, and replaces its writes with recording ones.
	//
	// ***Applied between the filters and the measurement.*** Outside the filters, so a pre-read
	// and an undo pass through the same permission gate the write did; inside the measurement,
	// so this layer never sees a `{ Result, Statistics }` envelope it would have to unwrap.

	function Wrap( Storage )
	{
		if ( !is_object( Storage ) ) { return Storage; }

		// ***The functions as they are underneath this layer.*** Every pre-read and every undo
		// write goes through these, which is what keeps an undo from being recorded by the layer
		// which issued it, from being validated a second time, and from being measured as though
		// the caller had asked for it.
		let inner = {};
		for ( let index = 0; index < INNER.length; index++ )
		{
			let name = INNER[ index ];
			if ( typeof Storage[ name ] === 'function' ) { inner[ name ] = Storage[ name ].bind( Storage ); }
		}

		// The one open scope, or null. A second one is refused rather than nested.
		let open = null;


		//---------------------------------------------------------------------
		// The Options an internal call travels on: the caller's, without this layer's id and
		// without the measurement's private channel, and saying whether documents are wanted.
		//
		// ***The rest of the caller's Options is carried.*** `jsonstor-userinfo` throws when
		// `Options.User` is not an object, so a pre-read or an undo issued with a bare `{}`
		// would fail underneath that filter - and carrying `User` is also what makes an undo
		// obey the same permission gate as the write it reverses.

		function inner_options( Options, ReturnDocuments )
		{
			let options = Statistics.Detach( Options );
			delete options[ UNDO_ID ];
			if ( ReturnDocuments === true ) { options.ReturnDocuments = true; }
			else { delete options.ReturnDocuments; }
			return options;
		}


		//---------------------------------------------------------------------
		// What the caller asked for, from what the store answered when documents were forced.
		//
		// ***The one-document writes answer a document and not an array of one*** - measured on
		// 2026-09-20: `InsertOne`, `UpdateOne`, `ReplaceOne` and `DeleteOne` each answer the
		// document under `ReturnDocuments`, and `null` where nothing matched. So the count a
		// caller would have been given is one for a document, none for a null, and the length of
		// whatever the `Many` calls answered.

		function caller_answer( Answer, WantedDocuments )
		{
			if ( WantedDocuments ) { return Answer; }
			if ( Array.isArray( Answer ) ) { return Answer.length; }
			if ( is_object( Answer ) ) { return 1; }
			if ( ( Answer === null ) || ( typeof Answer === 'undefined' ) ) { return 0; }
			return Answer;
		}


		//---------------------------------------------------------------------
		// The documents a change is about to touch, by key.
		//
		// ***The whole match set, not `FindOne`.*** `UpdateOne` and `ReplaceOne` touch "the first
		// match" in each adapter's own scan order, and a separately issued `FindOne` is not
		// promised to pick the same one - `LIMIT 1` with no `ORDER BY` is not a stable choice.
		// Reading the match set and pairing the answer by key is right whichever one it took.
		//
		// ***A fast path for a criteria which can only match one document was considered and not
		// taken.*** `PrimaryKey.CriteriaKey` already decides that case, but an indexed `FindMany`
		// on the same criteria costs almost the same and one read path is one thing to be wrong.

		async function before_images( Criteria, Fields, Options )
		{
			let documents = await inner.FindMany( Criteria, null, inner_options( Options, false ) );
			if ( !Array.isArray( documents ) ) { documents = []; }

			let images = {};
			for ( let index = 0; index < documents.length; index++ )
			{
				let text = key_text( documents[ index ], Fields );
				if ( text === null ) { continue; }
				images[ text ] = documents[ index ];
			}
			return images;
		}


		//---------------------------------------------------------------------
		// Recording one call. `Answer` is what the store said it touched, always as documents.

		function record( Scope, Name, Answer, Images )
		{
			let documents = Array.isArray( Answer ) ? Answer : ( is_object( Answer ) ? [ Answer ] : [] );

			for ( let index = 0; index < documents.length; index++ )
			{
				let document = documents[ index ];
				let criteria = key_criteria( document, Scope.Fields );
				if ( criteria === null )
				{
					throw new Error( `WithUndo cannot record a ${Name}: the document the storage answered with carries no [${Scope.Fields.join( ', ' )}].` );
				}

				if ( ( Name === 'InsertOne' ) || ( Name === 'InsertMany' ) )
				{
					Scope.Entries.push( { Kind: 'Insert', Criteria: criteria } );
					continue;
				}
				if ( ( Name === 'DeleteOne' ) || ( Name === 'DeleteMany' ) )
				{
					// ***Kept as it came, not cloned.*** A document handed back is already the
					// caller's own copy and never the store's - invariant 7 - so there is nothing
					// to protect it from. And cloning it would break the one adapter whose
					// identifier is not a JSON value: measured on 2026-09-20, jsongin.SafeClone
					// throws on a MongoDB ObjectId, which made every undone delete on that
					// adapter put back one document fewer than it took.
					Scope.Entries.push( { Kind: 'Delete', Document: document } );
					continue;
				}

				// A change. ***The undo is a Diff, never a ReplaceOne.*** `ReplaceOne` merges
				// rather than replaces on the six SQL adapters, so a replacement of the
				// before-image would leave behind any field the forward write added - silently,
				// on six of nineteen. `Diff( After, Before )` carries the `$unset` as well as the
				// `$set`, and every adapter applies an update the same way.
				//
				// ***And `Diff` of the observed After, not `Invert` of the update.*** `Invert`
				// recomputes the After from the patch; the After which has to be undone is the
				// one the store produced, after a generated field, a coerced type or a column
				// round trip.
				let before = Images[ key_text( document, Scope.Fields ) ];
				if ( typeof before === 'undefined' ) { continue; }
				let undo = jsongin.Diff( document, before );
				if ( !is_object( undo ) || ( Object.keys( undo ).length === 0 ) ) { continue; }
				Scope.Entries.push( { Kind: 'Restore', Criteria: criteria, Update: undo } );
			}
			return;
		}


		//---------------------------------------------------------------------
		// Putting it all back, newest first.
		//
		// ***A replay which fails stops where it stands and says so.*** It does not carry on past
		// a failure: what is left in the log is what has not been undone, and a caller told how
		// far it got can decide what to do. The writes before that point stand.

		async function replay( Scope, Cause )
		{
			let undone = 0;
			while ( Scope.Entries.length > 0 )
			{
				let entry = Scope.Entries[ Scope.Entries.length - 1 ];
				try
				{
					if ( entry.Kind === 'Insert' ) { await inner.DeleteOne( entry.Criteria, Scope.Options ); }
					else if ( entry.Kind === 'Delete' ) { await inner.InsertOne( entry.Document, Scope.Options ); }
					else { await inner.UpdateOne( entry.Criteria, entry.Update, Scope.Options ); }
				}
				catch ( error )
				{
					let standing = Scope.Entries.length;
					let failure = new Error(
						`WithUndo could not finish: ${undone} ${( undone === 1 ) ? 'write was' : 'writes were'} put back and `
						+ `${standing} ${( standing === 1 ) ? 'stands' : 'stand'}. ${error.message}` );
					failure.UndoIncomplete = true;
					failure.Undone = undone;
					failure.Standing = standing;
					failure.Cause = Cause || null;
					throw failure;
				}
				Scope.Entries.pop();
				undone++;
			}
			return undone;
		}


		//---------------------------------------------------------------------
		// The storage the handler is given: the same one, with the seven writes carrying an id.
		//
		// ***Built with Object.create, so everything else reads through.*** A read, `StorageInfo`,
		// `Settings`, `AdapterName` and anything a filter added are the storage's own, looked up
		// as the handler asks for them - including the layers which wrap this storage after this
		// function has run.

		function scoped_storage( Scope )
		{
			let scoped = Object.create( Storage );
			scoped.UndoID = Scope.Id;

			for ( let index = 0; index < WRITES.length; index++ )
			{
				let name = WRITES[ index ];
				if ( typeof Storage[ name ] !== 'function' ) { continue; }
				scoped[ name ] = ( function ( Name )
				{
					return async function ()
					{
						let args = Array.prototype.slice.call( arguments );
						let position = Statistics.OptionsIndex[ Name ];
						while ( args.length < position ) { args.push( undefined ); }
						let options = is_object( args[ position ] ) ? Object.assign( {}, args[ position ] ) : {};
						options[ UNDO_ID ] = Scope.Id;
						args[ position ] = options;
						// ***Looked up now rather than captured.*** By the time a handler runs,
						// this storage carries the measurement and the criteria check above this
						// layer, and a write inside a scope has to travel through both.
						return await Storage[ Name ].apply( Storage, args );
					};
				} )( name );
			}

			// Reverse and return normally, for "validate, then decide not to".
			scoped.Undo = function () { Scope.Requested = true; return; };
			return scoped;
		}


		//---------------------------------------------------------------------
		Storage.WithUndo = async function WithUndo( Handler, Options )
		{
			if ( typeof Handler !== 'function' ) { throw new Error( `WithUndo requires a function to run.` ); }
			if ( open !== null ) { throw new Error( `WithUndo is already open on this storage. A scope inside a scope is refused rather than nested.` ); }

			let info = await inner.StorageInfo( inner_options( Options, false ) );
			let fields = Array.isArray( info.PrimaryKey ) ? info.PrimaryKey.slice() : [];
			if ( fields.length === 0 )
			{
				throw new Error( `WithUndo needs a primary key and this storage reports none. An undo has to name the document it puts back.` );
			}
			if ( info.PrimaryKeyMutable === true )
			{
				throw new Error( `WithUndo is refused on a storage with PrimaryKeyMutable set. The log pairs a document to its earlier self by the identifier, and here an update may move it.` );
			}

			let scope = {
				Id: NewUniqueID( 'ShortID', 'undo' ),
				Fields: fields,
				Entries: [],
				Requested: false,
				Options: inner_options( Options, false ),
			};
			open = scope;

			let answer = null;
			try
			{
				answer = await Handler( scoped_storage( scope ) );
			}
			catch ( error )
			{
				try { await replay( scope, error ); }
				finally { open = null; }
				throw error;
			}

			try
			{
				if ( scope.Requested ) { await replay( scope, null ); }
			}
			finally { open = null; }

			return answer;
		};


		//---------------------------------------------------------------------
		// ***Dropping the storage inside a scope is refused***, because there would be nothing to
		// put anything back into. Refused whoever asks, not only the handler: a drop from
		// anywhere empties every entry in the log of its meaning.

		if ( typeof Storage.DropStorage === 'function' )
		{
			let drop = Storage.DropStorage.bind( Storage );
			Storage.DropStorage = async function DropStorage( Options )
			{
				if ( open !== null ) { throw new Error( `DropStorage is refused while WithUndo is open on this storage.` ); }
				return await drop( Options );
			};
		}


		//---------------------------------------------------------------------
		// The seven writes. ***A call with no id on its Options is untouched and costs one test***,
		// which is what makes the feature free for everyone who is not using it.

		for ( let index = 0; index < WRITES.length; index++ )
		{
			let name = WRITES[ index ];
			if ( typeof Storage[ name ] !== 'function' ) { continue; }
			Storage[ name ] = ( function ( Name, Original, Position )
			{
				return async function ()
				{
					let args = Array.prototype.slice.call( arguments );
					let options = args[ Position ];
					if ( !is_object( options ) || ( typeof options[ UNDO_ID ] !== 'string' ) ) { return await Original.apply( Storage, args ); }
					if ( ( open === null ) || ( options[ UNDO_ID ] !== open.Id ) )
					{
						throw new Error( `This storage has no open WithUndo scope named [${options[ UNDO_ID ]}].` );
					}

					let scope = open;
					let wanted = ( options.ReturnDocuments === true );
					let changes = ( Name === 'UpdateOne' ) || ( Name === 'UpdateMany' ) || ( Name === 'ReplaceOne' );

					// ***Only a change needs reading first.*** An insert has no earlier self and a
					// delete answers its own before-image, so four of the seven cost nothing more
					// than the write they already were.
					let images = {};
					if ( changes ) { images = await before_images( args[ 0 ], scope.Fields, options ); }

					args[ Position ] = inner_options( options, true );
					let answer = await Original.apply( Storage, args );
					record( scope, Name, answer, images );
					return caller_answer( answer, wanted );
				};
			} )( name, Storage[ name ].bind( Storage ), Statistics.OptionsIndex[ name ] );
		}

		return Storage;
	}


	//---------------------------------------------------------------------
	return { Wrap: Wrap };

};
