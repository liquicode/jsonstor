'use strict';

const LIB_CRYPTO = require( 'crypto' );

/*
	A unique identifier in one of several formats, with no dependency.

	***Two formats today, and adding a third is one entry in the FORMATS table.***

		ShortID   k3n8x2p9q4mz                           (the default)
		UUIDv4    d857cdae-2879-4aca-a9e3-1cc6dd57c472

	***ShortID is not a UUID and does not pretend to be one.*** It is `Size` characters from a
	36 character alphabet whose first character is always a letter, so an identifier is safe to
	paste where a leading digit would be awkward: a column name, a folder name, a Javascript
	identifier. ***UUIDv4 is the real thing***, RFC 4122 version 4, for a caller who has to hand
	an identifier to something that will check it.

	***Size belongs to the format rather than to the caller.*** A UUID is 36 characters and there
	is no other length it could be, so asking for one with a Size is a mistake rather than a
	preference and is refused. Only a variable length format accepts one.

	***The random bytes come from the platform and never from `Math.random`.*** Node and the
	browser disagree about where they live, and that disagreement is the whole of this file.
	`globalThis.crypto.getRandomValues` is the one spelling both of them answer to - it exists in
	every browser and in Node 18 and later - so it is asked first, and Node's own `crypto` module
	answers for anything older. ***`crypto.randomInt()` was rejected outright***: it does not
	exist in a browser at all, and the bundle in `dist/` is a browser artifact whose memory
	adapter is the one a browser can actually run. ***`crypto.randomUUID()` is used only when it
	is there***, because it is restricted to secure contexts, so a page served over plain http
	has the `crypto` object with no `randomUUID` on it and has to build the UUID from bytes.

	***A byte is mapped to an alphabet by rejection rather than by modulo.*** 256 is not a
	multiple of 36, so `byte % 36` would make the first four letters about 1.6% likelier than the
	rest, and 26 divides 256 even less evenly. Bytes at or above the last whole multiple are
	thrown away instead, which costs a few extra bytes and no bias.

	***Size is a collision budget and not a formatting choice.*** ShortID at twelve characters is
	26 * 36^11, about 1.2e18 identifiers, so a collection reaches a one in a million chance of
	one collision at around 1.5 million documents and one in ten thousand at around 15 million.
	That is ample for most storages and it is not UUIDv4's 2^122; a collection expected to grow
	past a few million documents should ask for more characters, or for a UUID.
*/

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz1234567890';
const ALPHABET_FIRST = 'abcdefghijklmnopqrstuvwxyz';

const SHORT_ID_SIZE = 12;

const HEX = [];
for ( let index = 0; index < 256; index++ ) { HEX.push( ( index + 0x100 ).toString( 16 ).slice( 1 ) ); }


//---------------------------------------------------------------------
// Random bytes from whatever the platform offers.
function random_bytes( Count )
{
	let bytes = new Uint8Array( Count );

	let web_crypto = globalThis.crypto;
	if ( web_crypto && ( typeof web_crypto.getRandomValues === 'function' ) )
	{
		web_crypto.getRandomValues( bytes );
		return bytes;
	}

	if ( typeof LIB_CRYPTO.randomFillSync === 'function' )
	{
		LIB_CRYPTO.randomFillSync( bytes );
		return bytes;
	}

	throw new Error( `jsonstor found no source of random bytes to make an identifier with.` );
}


//---------------------------------------------------------------------
// Hands out bytes one at a time, drawing a block whenever it runs dry.
//
// One call per character would work and would ask the platform for randomness twelve times to
// build one identifier. A block costs one call and is refilled only when rejection has eaten
// through it, which is rare.
function byte_reader( Count )
{
	let bytes = random_bytes( Count );
	let position = 0;

	return function next_byte()
	{
		if ( position >= bytes.length )
		{
			bytes = random_bytes( bytes.length );
			position = 0;
		}
		let byte = bytes[ position ];
		position++;
		return byte;
	};
}


//---------------------------------------------------------------------
// One character of an alphabet, chosen without bias.
function random_character( Alphabet, NextByte )
{
	let limit = 256 - ( 256 % Alphabet.length );
	while ( true )
	{
		let byte = NextByte();
		if ( byte < limit ) { return Alphabet[ byte % Alphabet.length ]; }
	}
}


//---------------------------------------------------------------------
// ShortID: Size characters, the first of them a letter.
function make_short_id( Size )
{
	// Half again, so that the usual amount of rejection does not need a second draw.
	let next_byte = byte_reader( Size + Math.ceil( Size / 2 ) );

	let result = '';
	for ( let index = 0; index < Size; index++ )
	{
		// ***The first character is always a letter.*** An identifier which can begin with a
		// digit is one a caller cannot always paste where they want to.
		if ( index === 0 ) { result += random_character( ALPHABET_FIRST, next_byte ); }
		else { result += random_character( ALPHABET, next_byte ); }
	}
	return result;
}


//---------------------------------------------------------------------
// UUIDv4: RFC 4122 version 4, from the platform where it offers one.
function make_uuid_v4()
{
	let web_crypto = globalThis.crypto;
	if ( web_crypto && ( typeof web_crypto.randomUUID === 'function' ) ) { return web_crypto.randomUUID(); }
	if ( typeof LIB_CRYPTO.randomUUID === 'function' ) { return LIB_CRYPTO.randomUUID(); }

	let bytes = random_bytes( 16 );

	// The version goes in the high nibble of byte 6 and the variant in the top bits of byte 8.
	// Without these two lines the result is 128 random bits which no validator will accept.
	bytes[ 6 ] = ( bytes[ 6 ] & 0x0f ) | 0x40;
	bytes[ 8 ] = ( bytes[ 8 ] & 0x3f ) | 0x80;

	return HEX[ bytes[ 0 ] ] + HEX[ bytes[ 1 ] ] + HEX[ bytes[ 2 ] ] + HEX[ bytes[ 3 ] ] + '-' +
		HEX[ bytes[ 4 ] ] + HEX[ bytes[ 5 ] ] + '-' +
		HEX[ bytes[ 6 ] ] + HEX[ bytes[ 7 ] ] + '-' +
		HEX[ bytes[ 8 ] ] + HEX[ bytes[ 9 ] ] + '-' +
		HEX[ bytes[ 10 ] ] + HEX[ bytes[ 11 ] ] + HEX[ bytes[ 12 ] ] +
		HEX[ bytes[ 13 ] ] + HEX[ bytes[ 14 ] ] + HEX[ bytes[ 15 ] ];
}


//---------------------------------------------------------------------
// The formats, by name. A new one is an entry here and nothing else.
const FORMATS = {
	ShortID: { DefaultSize: SHORT_ID_SIZE, Make: make_short_id },
	UUIDv4: { DefaultSize: null, Make: make_uuid_v4 },
};


//---------------------------------------------------------------------
// A new identifier.
function NewUniqueID( Format = 'ShortID', Prefix = '', Size = null )
{
	let format = FORMATS[ Format ];
	if ( !format )
	{
		throw new Error( `[${Format}] is not an identifier format. Use one of: ${Object.keys( FORMATS ).join( ', ' )}.` );
	}

	// ***A fixed length format refuses a Size rather than ignoring one.*** A caller who asks a
	// UUID to be twenty characters long has misunderstood something, and silently handing back
	// thirty six would leave them believing it worked.
	if ( Size !== null )
	{
		if ( format.DefaultSize === null )
		{
			throw new Error( `The [${Format}] format has a fixed length and does not take a Size.` );
		}
		if ( !Number.isInteger( Size ) || ( Size < 1 ) )
		{
			throw new Error( `The Size parameter must be a whole number of one or more.` );
		}
	}

	let result = format.Make( ( Size === null ) ? format.DefaultSize : Size );

	if ( Prefix && Prefix.length ) { result = Prefix + '-' + result; }
	return result;
}


//---------------------------------------------------------------------
module.exports = NewUniqueID;
