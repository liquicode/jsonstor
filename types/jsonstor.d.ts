// Type declarations for @liquicode/jsonstor
//
// ***Hand written, and hand written on purpose.*** The library is Javascript and stays
// Javascript: there is no `.ts` source, no compiler, and no generated declaration in this
// project. What ships is a declaration a consumer's editor can read, so TypeScript is
// ***supported and never required***.
//
// ***There are no named exports, and that is a decision rather than an omission.***
// *(User decision, 2026-08-30.)* This module exports a ***function***, and its 14-member
// surface exists only on the object that function returns - `Adapters`, `Filters` and
// `Translators` are built fresh on every call, so they belong to an instance and not to the
// module. An ESM wrapper which called the function at load time to obtain something to
// re-export would hand out the registries of an instance nobody asked for, and would register
// the built-in adapters as a side effect of an `import` statement. So `@liquicode/jsonstor`
// has a default export and nothing else, exactly as CommonJS has always had.
//
//		import jsonstor from '@liquicode/jsonstor';
//		const storage = jsonstor( 'jsonstor-memory', {} );
//
// This is the one package in the family shaped that way. jsongin, jsonproc and the four
// adapters all export an object and all carry an ESM wrapper. See
// jsonx/.plans/availability-enhancements.md.

declare module '@liquicode/jsonstor'
{

	//---------------------------------------------------------------------
	// Documents and values.

	/** A document is an object. */
	export type JsonDocument = { [ Key: string ]: any };

	/** A MongoDB style query criteria, as jsongin evaluates it. */
	export type QueryCriteria = { [ Key: string ]: any };

	export interface LibraryInfo
	{
		name: string;
		url: string;
		version: string;
	}


	//---------------------------------------------------------------------
	// The storage interface.
	//
	// ***The twelve functions below are the interface every adapter implements***, and they
	// are the same in every adapter - which is what makes one set of documentation and one
	// set of tests cover all of them. `StorageInterface()` returns them as stubs which throw,
	// so an adapter which forgets one fails loudly rather than silently doing nothing.
	//
	// An adapter is free to add members of its own, so this is left open. `jsonstor-memory`
	// carries `store` and `is_dirty`; they are not part of the interface and not declared.

	// What a call reports when it is made with `Options.Statistics`.
	//
	// ***Every storage call is two filters***: a Pushdown the medium is asked directly, and
	// a Residual which jsongin decides over the rows that came back. This is that split,
	// measured for one call.

	export interface CallStatistics
	{
		/** The adapter which answered. */
		Adapter: string;
		/** Whether anything reported. A call which evaluates no criteria reports nothing, and its counts stay at zero because none was taken. */
		Measured: boolean;
		/** The criteria translator used, or an empty string when the adapter pushes nothing down. */
		Translator: string;
		/** What was sent to the medium: a WHERE clause, a Mango criteria, or null when nothing was pushed down. */
		Pushdown: string | JsonDocument | null;
		/** How many rows came back from the pushdown - how many the second stage had to look at. */
		PushdownRows: number;
		/** The part of the criteria jsongin still had to decide. */
		Residual: QueryCriteria | null;
		/** How many rows the call returned. */
		ResidualRows: number;
	}


	// A call made with `Options.Statistics` answers this instead of its usual value.
	// `Result` is exactly what the call would have returned without the option.

	export interface MeasuredResult
	{
		Result: any;
		Statistics: CallStatistics;
	}


	export interface Storage
	{
		DropStorage( Options?: JsonDocument ): Promise<any>;
		FlushStorage( Options?: JsonDocument ): Promise<any>;
		/** A number, or a MeasuredResult when called with `Options.Statistics`. */
		Count( Criteria?: QueryCriteria, Options?: JsonDocument ): Promise<number | MeasuredResult>;
		InsertOne( Document: JsonDocument, Options?: JsonDocument ): Promise<any>;
		InsertMany( Documents: JsonDocument[], Options?: JsonDocument ): Promise<any>;
		FindOne( Criteria?: QueryCriteria, Projection?: JsonDocument, Options?: JsonDocument ): Promise<any>;
		FindMany( Criteria?: QueryCriteria, Projection?: JsonDocument, Options?: JsonDocument ): Promise<any>;
		UpdateOne( Criteria: QueryCriteria, Updates: JsonDocument, Options?: JsonDocument ): Promise<any>;
		UpdateMany( Criteria: QueryCriteria, Updates: JsonDocument, Options?: JsonDocument ): Promise<any>;
		ReplaceOne( Criteria: QueryCriteria, Document: JsonDocument, Options?: JsonDocument ): Promise<any>;
		DeleteOne( Criteria: QueryCriteria, Options?: JsonDocument ): Promise<any>;
		DeleteMany( Criteria?: QueryCriteria, Options?: JsonDocument ): Promise<any>;

		/** The settings this storage was constructed with. */
		Settings?: JsonDocument;
		/** Stamped on by GetStorage(), naming the adapter which was asked for. */
		AdapterName?: string;
		/**
		 * Stamped on by GetStorage(), naming the prime this storage's dialect comes from.
		 * The same string as AdapterName whenever a prime was named directly, and the prime
		 * an alias resolved to otherwise.
		 */
		DialectVersion?: string;
		/** Stamped on by GetFilter(), naming the filter which wrapped it. */
		FilterName?: string;

		[ MemberName: string ]: any;
	}


	//---------------------------------------------------------------------
	// The three kinds of plugin.
	//
	// ***LoadPlugin decides which kind it has been handed by which name field is present***,
	// so these are told apart by `AdapterName`, `FilterName` and `TranslatorName`.

	export interface StorageAdapterPlugin
	{
		AdapterName: string;
		AdapterDescription?: string;
		GetAdapter( jsonstor: Jsonstor, Settings: JsonDocument ): Storage;
		/**
		 * The package's prime versions - the ones which differ in behavior, each carrying a
		 * dialect profile of its own. A package with one implementation declares none.
		 */
		Adapters?: StorageAdapterPlugin[];
		/**
		 * Every other name this package answers to, each mapped to the prime it resolves to.
		 * A prime named here would be a mistake; an alias must name a prime. Naming the
		 * package's own AdapterName here makes the bare name an alias rather than an adapter.
		 */
		Aliases?: { [ AliasName: string ]: string };
	}

	export interface StorageFilterPlugin
	{
		FilterName: string;
		FilterDescription?: string;
		GetFilter( jsonstor: Jsonstor, Storage: Storage, Settings: JsonDocument ): Storage;
	}

	/** How completely a translator rendered a criteria for its target. */
	export interface TranslationFidelities
	{
		[ FidelityName: string ]: any;
	}

	export interface CriteriaTranslatorPlugin
	{
		TranslatorName: string;
		/** Turns a jsongin criteria into what the target can be asked, and reports what it could not absorb. */
		Translate( Criteria: QueryCriteria, Options?: JsonDocument ): any;
		Fidelities: TranslationFidelities;
	}

	/** An entry in the Filters array GetStorage() takes. */
	export interface FilterEntry
	{
		FilterName: string;
		Settings?: JsonDocument;
	}


	//---------------------------------------------------------------------
	// What every registered translator does with every jsongin query operator.
	//
	// Built from jsongin's operator list and the registered translators, so neither the rows
	// nor the columns are written down twice.

	export interface OperatorMatrixApi
	{
		FIDELITIES: JsonDocument;
		Operators(): string[];
		Fidelity( TranslatorName: string, OperatorName: string ): any;
		Matrix(): any;
		NotExact(): any;
	}


	//---------------------------------------------------------------------
	// The target-agnostic half of a translator, for whoever writes the next one.
	//
	// The criteria-shape and allowlist questions, with no target in them.

	export interface TranslatorSupportApi
	{
		IsOperatorObject( Value: any ): boolean;
		FieldIsProjection( FieldName: string, Projection: JsonDocument ): boolean;
		CriteriaNamesProjection( Criteria: QueryCriteria, Projection: JsonDocument ): boolean;
		OperandTypeAgrees( Operand: any, Type: any ): boolean;
		SplitNullValues( Values: any[] ): any;
	}


	//---------------------------------------------------------------------
	// A jsonstor instance.
	//
	// ***The registries below belong to this instance.*** Each call to the module's function
	// builds new ones, which is why there is no module-level surface to import from.

	export interface Jsonstor
	{
		Library: LibraryInfo;

		/** The registered storage adapters, keyed by AdapterName. Primes and aliases alike. */
		Adapters: { [ AdapterName: string ]: StorageAdapterPlugin };
		/**
		 * Which registered names are aliases, each mapped to the prime it resolves to.
		 * A name in Adapters and absent here is a prime: it carries a dialect profile.
		 */
		AdapterAliases: { [ AliasName: string ]: string };
		/** The registered storage filters, keyed by FilterName. */
		Filters: { [ FilterName: string ]: StorageFilterPlugin };
		/** The registered criteria translators, keyed by TranslatorName. */
		Translators: { [ TranslatorName: string ]: CriteriaTranslatorPlugin };

		/** Registers an adapter, a filter, or a translator. Returns null if it is none of the three. */
		LoadPlugin( Plugin: StorageAdapterPlugin | StorageFilterPlugin | CriteriaTranslatorPlugin ): any;
		/** Registers every plugin found in a folder. Throws if the path does not exist. */
		LoadPlugins( Path: string, Recurse?: boolean ): void;

		/** Builds a storage from a registered adapter, wrapped in the named filters. */
		GetStorage( AdapterName: string, Settings?: JsonDocument | null, Filters?: FilterEntry[] ): Storage;
		/** Wraps an existing storage in one registered filter. */
		GetFilter( FilterName: string, Storage: Storage, Settings?: JsonDocument | null ): Storage;
		/** The twelve interface functions as stubs which throw. What an adapter starts from. */
		StorageInterface(): Storage;

		/** The built-in SQL criteria translator. Also reachable as `Translators.SqlExpression`. */
		SqlExpression: CriteriaTranslatorPlugin;
		/** The built-in Mango criteria translator. Also reachable as `Translators.MangoExpression`. */
		MangoExpression: CriteriaTranslatorPlugin;

		/**
		 * A new unique identifier.
		 * `ShortID` (the default) is `Size` characters from a 36 character alphabet, always beginning with a letter.
		 * `UUIDv4` is RFC 4122 version 4, has a fixed length, and refuses a `Size`.
		 */
		NewUniqueID( Format?: 'ShortID' | 'UUIDv4', Prefix?: string, Size?: number | null ): string;

		/** What an adapter calls to report one criteria evaluation. A no-op unless the call was made with `Options.Statistics`. */
		ReportStatistics( Options: JsonDocument, Statistics: Partial<CallStatistics> ): boolean;
		/** What has already been reported for this call, or null. For an adapter which learns the pushdown and its row count in two places. */
		ReadStatistics( Options: JsonDocument ): CallStatistics | null;
		/** Whether this call is being measured, for an adapter which would have to do real work to answer. */
		IsMeasuringStatistics( Options: JsonDocument ): boolean;

		OperatorMatrix: OperatorMatrixApi;
		TranslatorSupport: TranslatorSupportApi;
	}


	//---------------------------------------------------------------------
	// The module's export, which is a function.
	//
	// ***It returns two different things and the argument decides which***: naming an adapter
	// builds a storage from it, and naming nothing hands back the jsonstor instance so that
	// you can load plugins into it first.

	export interface JsonstorFactory
	{
		/** A new jsonstor instance, with the built-in adapters, filters and translators registered. */
		(): Jsonstor;
		/** A storage from a registered adapter. The same as `jsonstor().GetStorage( ... )`. */
		( AdapterName: string, Settings?: JsonDocument | null, Filters?: FilterEntry[] ): Storage;
	}


	//---------------------------------------------------------------------
	// The default export, and what `require()` returns. There are no named exports.

	const jsonstor: JsonstorFactory;
	export default jsonstor;

}
