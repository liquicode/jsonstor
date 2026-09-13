# @liquicode/jsonstor

> Home: [http://jsonstor.liquicode.com](http://jsonstor.liquicode.com)
>
> Version: 0.1.0

> ### WARNING:
>
> Please review breaking changes in the [Version History](http://jsonstor.liquicode.com/#/external/history.md) before replacing and upgrading.


<!-- Note: the links below are root-absolute, beginning with /docs/.
     GitHub resolves a leading slash from the repository root, so these reach
     docs/external/... there. The docsify site runs with an alias that rewrites
     /docs/(.*) to /$1, so the same links route within the site. This keeps one
     source of truth for a file published to both the repo root and docs/external. -->

### One storage interface for many databases.


Overview
---------------------------------------------------------------------

`jsonstor` gives every storage the same interface, modeled on MongoDB's: the same functions, the
  same queries, and the same results, whether the documents are in memory, in a file, or in a
  database server.
An ***adapter*** connects the interface to one product.

```js
const jsonstor = require( '@liquicode/jsonstor' )();

let storage = jsonstor.GetStorage( 'jsonstor-memory' );
await storage.InsertOne( { name: 'Alice', role: 'admin' } );
let admins = await storage.FindMany( { role: 'admin' } );
```

Start with `jsonstor-memory` or `jsonstor-jsonfile`, and change to `jsonstor-mongodb`,
  `jsonstor-postgres` or another adapter later without changing the code which uses the storage.


Features
---------------------------------------------------------------------

- One interface, and one set of MongoDB-style query, projection and update operators, for every
  adapter.
- Every storage function is `async`.
- Pure Javascript. Installing `@liquicode/jsonstor` installs only `@liquicode/jsongin`.
- Each external adapter is a separate package, so you install only the drivers you use.
- Add your own adapters and filters.


Storage Interface
---------------------------------------------------------------------

- `DropStorage( Options )` :
	Deletes the storage.
- `FlushStorage( Options )` :
	Writes any cached changes to the storage.
- `Count( Criteria, Options )` :
	Returns the number of documents matching `Criteria`.
- `InsertOne( Document, Options )` :
	Inserts one document.
- `InsertMany( Documents, Options )` :
	Inserts several documents.
- `FindOne( Criteria, Projection, Options )` :
	Returns the first document matching `Criteria`.
- `FindMany( Criteria, Projection, Options )` :
	Returns every document matching `Criteria`.
- `FindMany2( Criteria, Projection, Sort, Paging, Options )` :
	Returns the documents matching `Criteria`, sorted and paged. `Paging` is a `MaxCount` number or `{ SkipCount, MaxCount }`.
- `UpdateOne( Criteria, Updates, Options )` :
	Applies `Updates` to the first document matching `Criteria`.
- `UpdateMany( Criteria, Updates, Options )` :
	Applies `Updates` to every document matching `Criteria`.
- `ReplaceOne( Criteria, Document, Options )` :
	Replaces the first document matching `Criteria`.
- `DeleteOne( Criteria, Options )` :
	Deletes the first document matching `Criteria`.
- `DeleteMany( Criteria, Options )` :
	Deletes every document matching `Criteria`.
- `StorageInfo( Options )` :
	Describes the product, version and identifier of the storage.
- `RefreshIndex( Options )` :
	Rebuilds an adapter's identifier index after something else changed the store.

See the [Storage Interface](http://jsonstor.liquicode.com/#/guides/Storage-Interface.md).


Query, Projection, and Update Operators
---------------------------------------------------------------------

Criteria, projections and updates are evaluated by [jsongin](http://jsongin.liquicode.com), so a
  storage supports the operators `jsongin` supports.
See the [jsongin Operator Reference](http://jsongin.liquicode.com/#/guides/Operator-Reference.md).

Every adapter returns the same documents for the same criteria.
An adapter for a database translates what that database can express into its own query, and
  `jsongin` checks the results against the whole criteria. An operator the database cannot express
  still works; it just makes the database return more rows.
See the [Translation Layer](http://jsonstor.liquicode.com/#/guides/Translation-Layer.md).


Storage Adapters
---------------------------------------------------------------------

`jsonstor-memory`, `jsonstor-jsonfile` and `jsonstor-folder` are built in.
Every other adapter is a separate package.

See [Storage Adapters](http://jsonstor.liquicode.com/#/guides/Storage-Adapters.md) for the list,
  and [Storage Invariants](http://jsonstor.liquicode.com/#/guides/Storage-Invariants.md) for the
  rules every adapter follows.


Storage Filters
---------------------------------------------------------------------

A filter wraps a storage and has the same interface, so a filtered storage is used like any other.
Filters can be stacked.

- `jsonstor-oplog` : Logs each storage call.
- `jsonstor-userinfo` : Adds document ownership, permissions and sharing.

See [Storage Filters](http://jsonstor.liquicode.com/#/guides/Storage-Filters.md).


Documentation and Tests
---------------------------------------------------------------------

The documentation and tests for `jsonstor` and every adapter are in
  [`jsonstor-docs`](https://github.com/liquicode/jsonstor-docs), which is not published to npm.
One site, [http://jsonstor.liquicode.com](http://jsonstor.liquicode.com), covers them all.
See the [Test Results](http://jsonstor.liquicode.com/#/external/tests.md).
