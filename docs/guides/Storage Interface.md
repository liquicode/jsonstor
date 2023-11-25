# JSON Storages


## Storage Interface

Each `jsonstor` storage implementation supports the same set of functions with the same syntax.

To handle vendor specific requirements and to customize function behavior,
	each storage function takes an `Options` object as its last paramter.

In almost all cases, storage functions will return a count of the number of documents affected by the function.
	Exceptions to this are:
	(1) the `FindOne` and `FindMany` functions which will always return the documents found that match the provided criteria.
	and (2) when otherwise specified by setting the `ReturnDocuments` in the `Options` parameter of the function call.


### Global Options

There are some global options which are common across all storages implementations.

- `ReturnDocuments` :
	When set to `true`, a storage function will return the modified documents rather
	than just count of documents modified by the function.
	This applies to the following functions:
	`InsertOne`, `InsertMany`, `UpdateOne`, `UpdateMany`, `ReplaceOne`, `DeleteOne`, and `DeleteMany`.


### Storage Function Summary

- `DropStorage( Options )` :
	Destroys the storage and all of its contents.
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

#### Function Parameters

`Criteria` is a MongoDB-style query that identifies one or more documents.
This similar to a `WHERE` clause in an sql statement.
See [Query Operators](./Query%20Operators.md) for more detail about how to use the `Criteria` parameter.

`Projection` lets you control which document fields are returned as a result of a call to `FindOne` or `FindMany`.
See [Projection Operators](./Projection%20Operators.md) for more information.

`Updates` is an object containing [Update Operators](./Update%20Operators.md) that will modify objects
	during a call to `UpdateOne` or `UpdateMany`.

`Document` is a single object.
`Documents` is an array of objects.

`Options` is an object containing vendor specific optiuons.


---------------------------------------------------------------------

### Count( Criteria, Options )

***Returns a count of documents satisfying `Criteria`.***


---------------------------------------------------------------------

### InsertOne( Document, Options )

***Inserts a single document.***


---------------------------------------------------------------------

### InsertMany( Documents, Options )

***Inserts multiple documents.***


---------------------------------------------------------------------

### FindOne( Criteria, Projection, Options )

***Returns the first document satisfying `Criteria`.***


---------------------------------------------------------------------

### FindMany( Criteria, Projection, Options )

***Returns all documents satisfying `Criteria`.***


---------------------------------------------------------------------

### UpdateOne( Criteria, Updates, Options )

***Updates the first document satisfying `Criteria` with update operations found in `Updates`.***


---------------------------------------------------------------------

### UpdateMany( Criteria, Updates, Options )

***Updates all documents satisfying `Criteria` with update operations found in `Updates`.***


---------------------------------------------------------------------

### ReplaceOne( Criteria, Document, Options )

***Replaces a single document that has matches `Criteria`.***


---------------------------------------------------------------------

### DeleteOne( Criteria, Options )

***Deletes the first document satisfying `Criteria`.***


---------------------------------------------------------------------

### DeleteMany( Criteria, Options )

	Deletes all documents satisfying `Criteria`.
