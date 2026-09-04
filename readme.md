# @liquicode/jsonstor

> Home: [http://jsonstor.liquicode.com](http://jsonstor.liquicode.com)
>
> Version: 0.1.0

> ### WARNING:
>
> This version is built on `jsongin` 0.1.0 and carries its breaking changes.
> Please review the [Version History](http://jsonstor.liquicode.com/#/external/history.md) before replacing and upgrading.


<!-- Note: the links below are root-absolute, beginning with /docs/.
     GitHub resolves a leading slash from the repository root, so these reach
     docs/external/... there. The docsify site runs with an alias that rewrites
     /docs/(.*) to /$1, so the same links route within the site. This keeps one
     source of truth for a file published to both the repo root and docs/external. -->

### A centralized interface to work with multiple database products and implementations.


Overview
---------------------------------------------------------------------

`jsonstor` defines a single interface for database interaction and implements
	adapters for specific database products and libraries.
This interface is inspired by the MongoDB-style interface found in many other projects.
All database interaction is done through this interface and is the same across all database adapters.

`jsonstor` is not really an ORM but it is kind of ORM-ish.
ORMs provide a very structured approach to data access and `jsonstor` values the flexibility
	to store whatever you want wherever you want with a minimum of fuss and bother.

With `jsonstor`, you can build your project without being tied to the specifics of a single database.
Use `jsonstor-memory` when prototyping or developing locally and then switch to
`jsonstor-mongodb` when you need the support of a higher end multi-user service.
Even if you need to eventually switch your code over to the native driver, for MongoDB this is
	straightforward as the `jsonstor` and MongoDB interfaces are almost identical.

As long as there is an adapter for it (or you create one), you can use any existing database.
You can use the convenient and intuitive MongoDB Query interface to access any kind of data,
	regardless of where it lives.

With a single interface to access data, we can develop common tools and plugins.
For example, `jsonstor` ships with a plugin called `jsonstor-userinfo` that adds user ownership,
	access controls, and sharing to documents in any database.
There is also a `timestamps` plugin which adds `created` and `updated` timestamps to documents.


Features
---------------------------------------------------------------------

- 100% Javascript with minimal dependencies.
- 100% `async` and `await`-able storage functions.
- Identical interface to JSON, MongoDB, MySql, and others.
- Create your own adapters and filters with the extensible plugin architecture.


Database Interface
---------------------------------------------------------------------

- `DropStorage( Options )` :
	Deletes the storage from its persistent medium.
- `FlushStorage( Options )` :
	Forces any changes cached in memory to be written to the storage.
- `Count( Criteria, Options )` :
	Returns a count of documents satisfying `Criteria`.
- `InsertOne( Document, Options )` :
	Inserts a single document.
- `InsertMany( Documents, Options )` :
	Inserts multiple documents.
- `FindOne( Criteria, Projection, Options )` :
	Returns the first document satisfying `Criteria`.
- `FindMany( Criteria, Projection, Options )` :
	Returns all documents satisfying `Criteria`.
- `FindMany2( Criteria, Projection, Sort, MaxCount, Options )` :
	Returns all documents satisfying `Criteria`, optionally sorted and/or limited.
- `UpdateOne( Criteria, Updates, Options )` :
	Updates the first document satisfying `Criteria` with update operations found in `Updates`.
- `UpdateMany( Criteria, Updates, Options )` :
	Updates all documents satisfying `Criteria` with update operations found in `Updates`.
- `ReplaceOne( Criteria, Document, Options )` :
	Replaces a single document that matches `Criteria`.
- `DeleteOne( Criteria, Options )` :
	Deletes the first document satisfying `Criteria`.
- `DeleteMany( Criteria, Options )` :
	Deletes all documents satisfying `Criteria`.


Query, Projection, and Update Operators
---------------------------------------------------------------------

`jsonstor` relies heavily upon the MongoDB-style mechanics implemented in the
	[jsongin](http://jsongin.liquicode.com) library.
A criteria, a projection, and an update handed to a storage function are handed to `jsongin`,
	so the operators a storage understands are exactly the operators `jsongin` implements.

`jsongin` 0.1.0 implements ***219 of the 254 operators MongoDB documents***, and is measured at
	100% parity with a live MongoDB server across 988 compared behaviors.

***The list is not repeated here.*** It changes whenever the engine gains an operator, and a
	copy of it in this file could only ever be out of date. See the
	[Operator Reference](https://github.com/liquicode/jsongin/blob/main/docs/guides/Operator-Reference.md),
	which is generated from the engine's own registries and checked against them in both
	directions.

Two things are worth knowing about how the operators reach an adapter:

- ***An adapter which stores documents itself uses `jsongin` directly***, so it supports
	whatever the engine supports. `jsonstor-memory`, `jsonstor-folder`, and `jsonstor-jsonfile`
	are all in this group.
- ***An adapter which delegates to a database passes the criteria to that database.***
	`jsonstor-mongodb` hands criteria straight to the MongoDB driver. A SQL adapter translates
	what it can and refuses the rest.

***That difference is measured rather than assumed.*** One shared inventory is run against
	every storage and against a live MongoDB server, and where a medium disagrees with the
	server the medium is wrong.


Storage Adapters
---------------------------------------------------------------------

A storage adapter is what actually reads and writes the documents. Every adapter implements the
	same interface, so the choice of adapter does not reach the code which uses it.

***The list is not repeated here.*** It is generated from one inventory, along with a topic page
	for each adapter describing what that adapter does differently. See
	[Storage Adapters](http://jsonstor.liquicode.com/#/guides/Storage-Adapters.md).

***What every adapter does the same way is written down once.***
	[Storage Invariants](http://jsonstor.liquicode.com/#/guides/Storage-Invariants.md) is that
	list - the identifier, the order a collection reads back in, what a search is guaranteed to
	answer - so a topic page carries only the differences.

***Each external adapter is its own package so that its driver stays optional.*** A project
	storing documents in memory and a file downloads no database driver at all - installing
	`@liquicode/jsonstor` brings `@liquicode/jsongin` and nothing else.


Storage Filters
---------------------------------------------------------------------

Storage filters work with storage adapters to add functionality to your application.
Since filters and adapters support the same storage interface, they can be used interchangeably
	within your code.
Filters can be added to other filters allowing you to create your own data processing pipeline.
Again, this pipeline can be directed to store data with any storage adapter.

### Built-In Filters

- `jsonstor-oplog` : Traces storage function calls and outputs messages to console, file, or other log targets.
- `jsonstor-userinfo` : Adds user ownership and document sharing to an existing storage.

See [Storage Filters](http://jsonstor.liquicode.com/#/guides/Storage-Filters.md).


Documentation and Tests
---------------------------------------------------------------------

***The documentation and the conformance suites for the whole family are built in one place.***
	`@liquicode/jsonstor-docs` carries the shared storage inventory every adapter is measured
	by, and generates this site from it. It is a development repository rather than a library:
	***it is never published to npm***, and there is nothing to install.
	See the [Test Results](http://jsonstor.liquicode.com/#/external/tests.md) for the most recent run of every adapter.

***One site covers `jsonstor` and every adapter***, at
	[http://jsonstor.liquicode.com](http://jsonstor.liquicode.com). No adapter has a site of its
	own; its topic page lives here, describing only what that adapter does differently.
