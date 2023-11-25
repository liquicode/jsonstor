'use strict';

module.exports = function ( Adapter, Settings )
{
	let Storage = {

		//TODO: Change Adapter to Plugin

		// Metadata
		Adapter: Adapter,
		// Settings: jsongin.Clone( Settings ),
		Settings: Settings,

		// Interface
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
	return Storage;
};


