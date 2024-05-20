# @liquicode/devops

> Home: [http://jsonstor.liquicode.com](http://jsonstor.liquicode.com)
>
> Version: 0.0.20

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
You can use the convenient and intuitive MongoDB Query interface to access any kind os data,
	regardless of where it lives.

With a single interface to access data, we can develop common tools and plugins.
For example, `jsonstor` ships with a plugin called `jsonstor-userinfo` that adds user ownership,
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

`jsonstor` relies heavily upon the MongoDB-style mechanics implemented in the [jsongin](http://jsongin.liquicode.com) library.

Here is a summary of supported operators:

### Query Operators

|**Category** | **Operator**  | **Description**                                                                                                          |
|------------|----------------|--------------------------------------------------------------------------------------------------------------------------|
| Comparison | <field>: value | Implicit $eq. Specify a document field and value. A matching document will have that field strictly equal to that value. |
| Comparison | $eq            | Matches values that are equal to a specified value.                                                                      |
| Comparison | $ne            | Matches all values that are not equal to a specified value.                                                              |
| Comparison | $gt            | Matches values that are greater than a specified value.                                                                  |
| Comparison | $gte           | Matches values that are greater than or equal to a specified value.                                                      |
| Comparison | $lt            | Matches values that are less than a specified value.                                                                     |
| Comparison | $lte           | Matches values that are less than or equal to a specified value.                                                         |
| Comparison | $in            | Matches any of the values specified in an array.                                                                         |
| Comparison | $nin           | Matches none of the values specified in an array.                                                                        |
| Logical    | $and           | Joins query clauses with a logical AND returns all documents that match the conditions of both clauses.                  |
| Logical    | $or            | Joins query clauses with a logical OR returns all documents that match the conditions of either clause.                  |
| Logical    | $nor           | Joins query clauses with a logical NOR returns all documents that fail to match both clauses.                            |
| Logical    | $not           | Inverts the effect of a query expression and returns documents that do not match the query expression.                   |
| Element    | $exists        | Matches documents that have the specified field.                                                                         |
| Element    | $type          | Selects documents if a field is of the specified type.                                                                   |
| Evaluation | $regex         | Selects documents where values match a specified regular expression.                                                     |
| Array      | $elemMatch     | Selects documents if element in the array field matches all the specified $elemMatch conditions.                         |
| Array      | $size          | Selects documents if the array field is a specified size.                                                                |
| Array      | $all           | Matches arrays that contain all elements specified in the query.                                                         |

### Update Operators

| **Category** | **Operator** | **Description**                                                                                   |
|--------------|--------------|---------------------------------------------------------------------------------------------------|
| Field        | $set         | Sets the value of a field in a document.                                                          |
| Field        | $unset       | Removes the specified field from a document.                                                      |
| Field        | $rename      | Renames a field.                                                                                  |
| Field        | $inc         | Increments the value of the field by the specified amount.                                        |
| Field        | $min         | Only updates the field if the specified value is less than the existing field value.              |
| Field        | $max         | Only updates the field if the specified value is greater than the existing field value.           |
| Field        | $mul         | Multiplies the value of the field by the specified amount.                                        |
| Field        | $currentDate | Sets the value of a field to current date either as a Date or a Timestamp.                        |
| Array        | $addToSet    | *(partially implemented)* Adds elements to an array only if they do not already exist in the set. |
| Array        | $pop         | Removes the first or last item of an array.                                                       |
| Array        | $push        | *(partially implemented)* Adds an item to an array.                                               |
| Array        | $pullAll     | Removes all matching values from an array.                                                        |


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
  See: [https://github.com/liquicode/jsonstor-mongodb](https://github.com/liquicode/jsonstor-mongodb).

- `jsonstor-excel` : Documents are stored in an Excel spreadsheet.
  See: [https://github.com/liquicode/jsonstor-mongodb](https://github.com/liquicode/jsonstor-mongodb).

### Planned Adapters:

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
Since filters and adapters support the same storage interface, they can be used interchangeably within your code.
Filters can be added to other filters allowing you to create your own data processing pipeline.
Again, this pipeline can be directed to store data with any storage adapter.

### Built-In Filters

- `jsonstor-oplog` : Traces storage function calls and outputs messages to console, file, or other log targets.
- `jsonstor-userinfo` : Adds user info and access controls to documents.

### External Filters


### Planned Filters

- `jsonstor-timestamps` : Adds `created` and `updated` timestamps to documents.
- `jsonstor-wss-server` : Exports a storage over the network to storage wss-client.



