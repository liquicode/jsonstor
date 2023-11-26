# jsonstor
[`@liquiode/jsonstor`](https://github.com/liquicode/jsonstor) (v0.0.7)

### A centralized interface to work with multiple database products and implementations.


Official Docs: [https://jsonstor.liquicode.com](https://jsonstor.liquicode.com)


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
You can use the convenient and intuitive MongoDB Query interface to access any kind os data,
	regardless of where it lives.

With a single interface to access data, we can develop common tools and plugins.
For example, `jsonstor` ships with a plugin called `user-info` that adds user ownership,
	access controls, and sharing to documents in any database.
There is also a `timestamps` plugin which adds `created` and `updated` timestamps to documents.


Features
---------------------------------------------------------------------

- 100% Javascript with minimal dependencies.
- 100% `async` and `await`-able storage functions.
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


Query Interface
---------------------------------------------------------------------

- Logical Operators
	- `$and` : Joins query clauses with a logical AND returns all documents that match the conditions of both clauses.
	- `$or` : Joins query clauses with a logical OR returns all documents that match the conditions of either clause.
	- `$nor` : Joins query clauses with a logical NOR returns all documents that fail to match both clauses.
	- `$not` : Inverts the effect of a query expression and returns documents that do not match the query expression.

- Comparison Operators
	- `$eq` : Matches values that are equal to a specified value.
	- `$ne` : Matches all values that are not equal to a specified value.
	- `$gt` : Matches values that are greater than a specified value.
	- `$gte` : Matches values that are greater than or equal to a specified value.
	- `$lt` : Matches values that are less than a specified value.
	- `$lte` : Matches values that are less than or equal to a specified value.
	- `$in` : Matches any of the values specified in an array.
	- `$nin` : Matches none of the values specified in an array.
	- `$regex` : 

- Array Operators
	- `$elemMatch` : 
	- `$size` : 
	- `$all` : 

- Meta Operators
	- `$exists` : Matches documents that have the specified field.
	- `$type` : Selects documents if a field is of the specified type.


Storage Adapters
---------------------------------------------------------------------

Storage adapters work with a specific storage format and are in charge reading and
	writing data to the storage.

### Built-In Adapters

- `jsonstor-memory` : Documents are stored in memory and are not persisted to disk.
- `jsonstor-folder` : Each document is stored in its own file in a single folder.
- `jsonstor-jsonfile` : Documents are cached in memory and persisted to a single file.

### External Adapters

- `jsonstor-mongodb` : Documents are stored on a MongoDB server.

### Planned Adapters:

- File Based
	- `jsonstor-csvfile` : Data is stored in a single CSV file.
	- `jsonstor-excel` : Data is stored in an Excel spreadsheet.

- Document Databases
	- `jsonstor-couchdb` : Documents are stored on a CouchDB server.
	- `jsonstor-aws-documentdb` : Documents are stored in an AWS DocumentDB.

- Hybrid Databases
	- `jsonstor-aws-dynamodb` : Documents are stored in an AWS DynamoDB.

- Relational Databases
	- `jsonstor-sqlite` : Documents are stored in a Sqlite3 file.
	- `jsonstor-mysql` : Documents are stored on a MySql server.

- Proxies
	- `jsonstor-wss-client` : Redirects all storage functionality to a storage wss-server.


Storage Filters
---------------------------------------------------------------------

Storage filters work with storage adapters to add functionality to your application.
Since filters and adapters support the same storage interface,
	they can be used interchangeably within your code.
Filters can be added to other filters allowing you to create your own data processing pipeline.
Again, this pipeline can be directed to store data with any storage adapter.

### Built-In Filters

- `jsonstor-userinfo` : Adds user info and access controls to documents.

### External Filters


### Planned Filters

- `jsonstor-oplog` : Traces storage function calls and outputs messages to console, file, or other log targets.
- `jsonstor-timestamps` : Adds `created` and `updated` timestamps to documents.
- `jsonstor-wss-server` : Exports a storage over the network to storage wss-client.


Considerations
---------------------------------------------------------------------

- If your code performs a json stringify and parse to clone the `Criteria` parameter,
	problems can occur when using regular expressions and when comparing fields to `undefined`.
	In both of these cases, the cloned object will be stripped of these fields.
	This leads to a failure of the `UserStorage` component as well as any or any other component
		which clones the `Criteria` parameter.
	To avoid this, consider using the `jsongin.SafeClone` function from the
		[@liquicode/jsongin](https://www.npmjs.com/package/@liquicode/jsongin) library.
	The SafeClone function will not strip these fields.
	`jsonstor` already includes this library.
	A couple rules of thumb can be applied:
	1) Avoid explicitly specifying `undefined` in `Criteria` (e.g. `$eq: undefined`).
		If you need to test for the presence of a field in a document, use the `$exists` operator instead.
	2) Use the string representation of a regular expression rather than the Javascript notation.
		Use `$regex: "^hello"` rather than `$regex: /^hello/`.
		Note that this also precludes using implicit `$eq` with regular expressions (e.g. `name: /^joe/`).
		You will need to use `$regex` operator in such cases: `name: { $regex: "^joe" }`.

- Strict comparison between two objects requires that all fields appear in both objects, have the same (strict)
	value, and also appear in the same order within the objects.
	As software systems of any sort are likely to massage and dissect the data objects they work with,
		it is not recommended to rely upon the consistency of an object's internal order.
	Performing any `$eq` comparisons requires that fields in both document and criteria objects match the same order.
	If this is too strict for your needs, you can use the more loose `eqx` operator if you want to match
		fields, values, but not the field order.

