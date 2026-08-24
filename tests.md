# @liquicode/jsonstor

> The storage interface and the three built-in adapters. Needs no server.

# Test Results

```
> @liquicode/jsonstor@0.1.0 test
> node build/run-tests.js


## Unit Tests

```
010) SqlExpression Tests
    ✔ It should return an expression for boolean values
    ✔ It should return an expression for number values
    ✔ It should return an expression for string values
    ✔ It should return an expression for null values
    ✔ It should support the $ImplicitEq operator
    ✔ It should support the $eq operator
    ✔ It should support the $eqx operator
    ✔ It should support the $ne operator
    ✔ It should support the $nex operator
    ✔ It should support the $lt operator
    ✔ It should support the $lte operator
    ✔ It should support the $gt operator
    ✔ It should support the $gte operator
    ✔ It should support the $in operator
    ✔ It should support the $nin operator
    ✔ It should support the implicit $and operator
    ✔ It should support the $and operator
    ✔ It should support the $or operator
    ✔ It should support the $nor operator
    ✔ It should support the $not operator
    ✔ It should support complex logic
    ✔ It should allow document paths
    ✔ It should use custom identifier quotes
    ✔ It should use custom string literal quotes
    ✔ It should respect Options.AllowedFields
    ✔ It should render a logical operator holding one condition
    ✔ It should not let a one condition operator borrow a preceding expression
    ✔ It should refuse a logical operator given no conditions
    ✔ It should treat an always true condition as true under $and
    ✔ It should not drop an always true condition from $or
    ✔ It should broaden rather than narrow for a $nor it cannot render
    ✔ It should drop a comparison operand it cannot render
    ✔ It should drop a whole $or when any child cannot be rendered
    ✔ It should keep the renderable children of an $and

  020) OpLog Filter Tests
    ✔ It should trace a storage call
    ✔ It should pass the storage call through to the adapter
    ✔ It should render every parameter the storage interface hands it
    ✔ It should refuse a storage which is not an object


  38 passing (16ms)
```

## Parity Tests

```
jsonstor-memory
    A) CRUD Tests
      ✔ should insert 100 documents, one at a time
      ✔ should delete 100 documents, all at once
      ✔ should insert 100 documents, all at once
      ✔ should read 100 documents, one at a time (19ms)
      ✔ should replace 100 documents, one at a time (16ms)
      ✔ should read 100 documents, all at once
      ✔ should read 5 documents, all at once and sorted
      ✔ should update 100 documents, one at a time (10ms)
      ✔ should update 100 documents, all at once
      ✔ should delete 100 documents, one at a time
    B) Rainbow Tests
      Nested Fields (explicit)
        ✔ should not perform matching on nested fields using implicit $eq
        ✔ should not perform matching on nested fields using explicit $eq
      Nested Fields (dot notation)
        ✔ should perform matching on nested fields using implicit $eq and dot notation
        ✔ should perform matching on nested fields using explicit $eq and dot notation
      Operator $eq (===)
        ✔ should perform strict equality (===) on 'bns'
        ✔ should perform strict equality (===) on 'o'
        ✔ should perform strict equality (===) on 'a'
        ✔ should not perform loose equality (==) on 'bns'
        ✔ should not perform loose equality (==) on 'o'
        ✔ should not perform loose equality (==) on 'a'
        ✔ should equate null with an undefined field
      Operator $ne (!==)
        ✔ should perform strict inequality (!==) on 'bns'
        ✔ should perform strict inequality (!==) on 'o'
        ✔ should perform strict inequality (!==) on 'a'
        ✔ should not perform loose inequality (!=) on 'bns'
        ✔ should not perform loose inequality (!=) on 'o'
        ✔ should not perform loose inequality (!=) on 'a'
      Operator $gte (>=)
        ✔ should perform strict comparison (>=) on 'bns'
        ✔ should not perform loose comparison (>=) on 'bns'
        ✔ should equate null with an undefined field
      Operator $gt (>)
        ✔ should perform strict comparison (>=) on 'bns'
        ✔ should not perform loose comparison (>=) on 'bns'
      Operator $lte (<=)
        ✔ should perform strict comparison (<=) on 'bns'
        ✔ should not perform loose comparison (<=) on 'bns'
        ✔ should equate null with an undefined field
      Operator $lt (<)
        ✔ should perform strict comparison (<) on 'bns'
        ✔ should not perform loose comparison (<) on 'bns'
    C) UserInfo Permissions Tests
      Alice, Bob, and Eve scenario
        ✔ Should add documents and set permissions
        ✔ Alice should read all documents and write all documents
        ✔ Bob should read some documents and write some documents
        ✔ Eve should read some documents and write some documents
        ✔ Public objects should be readable by everyone
        ✔ Public objects should only be writable by the owner
        ✔ Should not allow readers to update documents
    D) Engine Contract Tests
      ✔ should refuse a criteria naming an unknown operator
      ✔ should refuse a criteria which is not an object
      ✔ should refuse an update naming an unknown operator
      ✔ should refuse an update which cannot be applied
      ✔ should not alias a FindOne result to the stored document
      ✔ should not alias a FindMany result to the stored documents
      ✔ should sort a missing field and a null below every value
      ✔ should reverse that order when sorting descending
      ✔ should limit the result to MaxCount after sorting
    M) MongoDB Tutorial
      Query Documents (https://www.mongodb.com/docs/manual/tutorial/query-documents/)
        Select All Documents in a Collection
          ✔ Match All Documents with an Empty Object {}
        Specify Equality Condition
          ✔ Match Fields with Implicit Equality
        Specify Conditions Using Query Operators
          ✔ Match Fields with an Array of Possible Values
        Specify AND Conditions
          ✔ Match Fields with an Array of Possible Values
        Specify OR Conditions
          ✔ Match Fields against an Array of Possible Values
        Specify AND as well as OR Conditions
          ✔ Match Fields Using AND and OR
      Query on Embedded/Nested Documents (https://www.mongodb.com/docs/manual/tutorial/query-embedded-documents/)
        Query on Embedded/Nested Documents
          ✔ Specify Equality Match on a Nested Field
          ✔ Specify Match using Query Operator
          ✔ Specify AND Condition
        Match an Embedded/Nested Document
          ✔ Specify Equality Match on an Embedded Document
      Query an Array (https://www.mongodb.com/docs/manual/tutorial/query-arrays/)
        Match an Array
          ✔ Match an Array Exactly
          ✔ Match Array Elements
        Query an Array for an Element
          ✔ Match a Single Array Element
          ✔ Match Array Elements by Comparison
        Specify Multiple Conditions for Array Elements
          ✔ Query an Array with Compound Filter Conditions on the Array Elements
          ✔ Query for an Array Element that Meets Multiple Criteria
          ✔ Query for an Element by the Array Index Position
          ✔ Query an Array by Array Length
      Query an Array of Embedded Documents (https://www.mongodb.com/docs/manual/tutorial/query-array-of-documents/)
        Query for a Document Nested in an Array
          ✔ Match a Document Exactly
        Specify a Query Condition on a Field in an Array of Documents
          ✔ Specify a Query Condition on a Field Embedded in an Array of Documents
          ✔ Use the Array Index to Query for a Field in the Embedded Document
        Specify Multiple Conditions for Array of Documents
          ✔ A Single Nested Document Meets Multiple Query Conditions on Nested Fields
          ✔ Combination of Elements Satisfies the Criteria
      Query for Null or Missing Fields (https://www.mongodb.com/docs/manual/tutorial/query-for-null-fields/)
        Equality Filter
          ✔ Match Fields that are Null or Missing
        Type Check
          ✔ Match Fields that Exist And are Null
        Existence Check
          ✔ Match Fields that are Missing
    N) MongoDB Reference
      Comparison Query Operators
        Comparison Operator: $eq (https://www.mongodb.com/docs/manual/reference/operator/query/eq/)
          Equals an Array Value
            ✔ Match an Array Element
            ✔ Match an Array Element Using Implicit $eq
          Regex Match Behaviour
            ✔ $eq match on a string
            ✔ $eq match on a regular expression
            ✔ Use the $in Operator with a Regular Expression
        Comparison Operator: $gt (https://www.mongodb.com/docs/manual/reference/operator/query/gt/)
          ✔ Match Document Fields
        Comparison Operator: $gte (https://www.mongodb.com/docs/manual/reference/operator/query/gte/)
          ✔ Match Document Fields
        Comparison Operator: $in (https://www.mongodb.com/docs/manual/reference/operator/query/in/)
          ✔ Use the $in Operator to Match Values
          ✔ Use the $in Operator to Match Values in an Array
          ✔ Use the $in Operator with a Regular Expression
        Comparison Operator: $lt (https://www.mongodb.com/docs/manual/reference/operator/query/lt/)
          ✔ Match Document Fields
        Comparison Operator: $lte (https://www.mongodb.com/docs/manual/reference/operator/query/lte/)
          ✔ Match Document Fields
        Comparison Operator: $ne (https://www.mongodb.com/docs/manual/reference/operator/query/ne/)
          ✔ Match Document Fields
        Comparison Operator: $nin (https://www.mongodb.com/docs/manual/reference/operator/query/nin/)
          ✔ Select on Unmatching Documents
          ✔ Select on Elements Not in an Array
      Logical Query Operators
        Logical Operator: $and (https://www.mongodb.com/docs/manual/reference/operator/query/and/)
          ✔ AND Queries With Multiple Expressions Specifying the Same Field
          ✔ AND Queries With Multiple Expressions Specifying the Same Operator
        Logical Operator: $not (https://www.mongodb.com/docs/manual/reference/operator/query/not/)
          ✔ Match Document Fields
          ✔ $not and Regular Expressions
        Logical Operator: $nor (https://www.mongodb.com/docs/manual/reference/operator/query/nor/)
          ✔ $nor Query with Two Expressions
          ✔ $nor and Additional Comparisons
          ✔ $nor and $exists
        Logical Operator: $or (https://www.mongodb.com/docs/manual/reference/operator/query/or/)
          ✔ Match Document Fields
          ✔ $or versus $in
          ✔ Nested $or Clauses
      Element Query Operators
        Element Query Operator: $exists (https://www.mongodb.com/docs/manual/reference/operator/query/exists/)
          ✔ Exists and Not Equal To
          ✔ Null Values
        Element Query Operator: $type (https://www.mongodb.com/docs/manual/reference/operator/query/type/)
          ✔ Querying by Data Type (BSON Code)
          ✔ Querying by Data Type (BSON Alias)
          ✔ Querying by Data Type ("number")
          ✔ Querying by Multiple Data Type (BSON Code)
          ✔ Querying by Multiple Data Type (BSON Alias)
      Array Query Operators
        Array Query Operator: $all (https://www.mongodb.com/docs/manual/reference/operator/query/all/)
          ✔ Use $all to Match Values
          ✔ Use $all with $elemMatch
          ✔ Use $all with Scalar Values
        Array Query Operator: $elemMatch (https://www.mongodb.com/docs/manual/reference/operator/query/elemMatch/)
          ✔ Element Match
          ✔ Array of Embedded Documents
          ✔ Single Query Condition
        Array Query Operator: $size (https://www.mongodb.com/docs/manual/reference/operator/query/size/)
          ✔ Use $size to Match Array Sizes
    Z) Ad-Hoc Tests
      ✔ should not match explicit nested fields
      ✔ should sort and limit in FindMany2

  jsonstor-folder
    A) CRUD Tests
      ✔ should insert 100 documents, one at a time (147ms)
      ✔ should delete 100 documents, all at once (64ms)
      ✔ should insert 100 documents, all at once (148ms)
      ✔ should read 100 documents, one at a time (696ms)
      ✔ should replace 100 documents, one at a time (1680ms)
      ✔ should read 100 documents, all at once (14ms)
      ✔ should read 5 documents, all at once and sorted (13ms)
      ✔ should update 100 documents, one at a time (1146ms)
      ✔ should update 100 documents, all at once (139ms)
      ✔ should delete 100 documents, one at a time (100ms)
    B) Rainbow Tests
      Nested Fields (explicit)
        ✔ should not perform matching on nested fields using implicit $eq (7ms)
        ✔ should not perform matching on nested fields using explicit $eq
      Nested Fields (dot notation)
        ✔ should perform matching on nested fields using implicit $eq and dot notation
        ✔ should perform matching on nested fields using explicit $eq and dot notation
      Operator $eq (===)
        ✔ should perform strict equality (===) on 'bns'
        ✔ should perform strict equality (===) on 'o'
        ✔ should perform strict equality (===) on 'a'
        ✔ should not perform loose equality (==) on 'bns'
        ✔ should not perform loose equality (==) on 'o'
        ✔ should not perform loose equality (==) on 'a'
        ✔ should equate null with an undefined field
      Operator $ne (!==)
        ✔ should perform strict inequality (!==) on 'bns'
        ✔ should perform strict inequality (!==) on 'o'
        ✔ should perform strict inequality (!==) on 'a'
        ✔ should not perform loose inequality (!=) on 'bns'
        ✔ should not perform loose inequality (!=) on 'o'
        ✔ should not perform loose inequality (!=) on 'a'
      Operator $gte (>=)
        ✔ should perform strict comparison (>=) on 'bns'
        ✔ should not perform loose comparison (>=) on 'bns'
        ✔ should equate null with an undefined field
      Operator $gt (>)
        ✔ should perform strict comparison (>=) on 'bns'
        ✔ should not perform loose comparison (>=) on 'bns'
      Operator $lte (<=)
        ✔ should perform strict comparison (<=) on 'bns'
        ✔ should not perform loose comparison (<=) on 'bns'
        ✔ should equate null with an undefined field
      Operator $lt (<)
        ✔ should perform strict comparison (<) on 'bns'
        ✔ should not perform loose comparison (<) on 'bns'
    C) UserInfo Permissions Tests
      Alice, Bob, and Eve scenario
        ✔ Should add documents and set permissions (46ms)
        ✔ Alice should read all documents and write all documents (111ms)
        ✔ Bob should read some documents and write some documents (87ms)
        ✔ Eve should read some documents and write some documents (72ms)
        ✔ Public objects should be readable by everyone (53ms)
        ✔ Public objects should only be writable by the owner (60ms)
        ✔ Should not allow readers to update documents (58ms)
    D) Engine Contract Tests
      ✔ should refuse a criteria naming an unknown operator (9ms)
      ✔ should refuse a criteria which is not an object
      ✔ should refuse an update naming an unknown operator
      ✔ should refuse an update which cannot be applied
      ✔ should not alias a FindOne result to the stored document (11ms)
      ✔ should not alias a FindMany result to the stored documents (11ms)
      ✔ should sort a missing field and a null below every value (15ms)
      ✔ should reverse that order when sorting descending
      ✔ should limit the result to MaxCount after sorting
    M) MongoDB Tutorial
      Query Documents (https://www.mongodb.com/docs/manual/tutorial/query-documents/)
        Select All Documents in a Collection
          ✔ Match All Documents with an Empty Object {} (10ms)
        Specify Equality Condition
          ✔ Match Fields with Implicit Equality
        Specify Conditions Using Query Operators
          ✔ Match Fields with an Array of Possible Values
        Specify AND Conditions
          ✔ Match Fields with an Array of Possible Values
        Specify OR Conditions
          ✔ Match Fields against an Array of Possible Values
        Specify AND as well as OR Conditions
          ✔ Match Fields Using AND and OR
      Query on Embedded/Nested Documents (https://www.mongodb.com/docs/manual/tutorial/query-embedded-documents/)
        Query on Embedded/Nested Documents
          ✔ Specify Equality Match on a Nested Field (10ms)
          ✔ Specify Match using Query Operator
          ✔ Specify AND Condition
        Match an Embedded/Nested Document
          ✔ Specify Equality Match on an Embedded Document
      Query an Array (https://www.mongodb.com/docs/manual/tutorial/query-arrays/)
        Match an Array
          ✔ Match an Array Exactly (9ms)
          ✔ Match Array Elements
        Query an Array for an Element
          ✔ Match a Single Array Element
          ✔ Match Array Elements by Comparison
        Specify Multiple Conditions for Array Elements
          ✔ Query an Array with Compound Filter Conditions on the Array Elements
          ✔ Query for an Array Element that Meets Multiple Criteria
          ✔ Query for an Element by the Array Index Position
          ✔ Query an Array by Array Length
      Query an Array of Embedded Documents (https://www.mongodb.com/docs/manual/tutorial/query-array-of-documents/)
        Query for a Document Nested in an Array
          ✔ Match a Document Exactly (8ms)
        Specify a Query Condition on a Field in an Array of Documents
          ✔ Specify a Query Condition on a Field Embedded in an Array of Documents
          ✔ Use the Array Index to Query for a Field in the Embedded Document
        Specify Multiple Conditions for Array of Documents
          ✔ A Single Nested Document Meets Multiple Query Conditions on Nested Fields
          ✔ Combination of Elements Satisfies the Criteria
      Query for Null or Missing Fields (https://www.mongodb.com/docs/manual/tutorial/query-for-null-fields/)
        Equality Filter
          ✔ Match Fields that are Null or Missing
        Type Check
          ✔ Match Fields that Exist And are Null
        Existence Check
          ✔ Match Fields that are Missing
    N) MongoDB Reference
      Comparison Query Operators
        Comparison Operator: $eq (https://www.mongodb.com/docs/manual/reference/operator/query/eq/)
          Equals an Array Value
            ✔ Match an Array Element (7ms)
            ✔ Match an Array Element Using Implicit $eq
          Regex Match Behaviour
            ✔ $eq match on a string
            ✔ $eq match on a regular expression
            ✔ Use the $in Operator with a Regular Expression
        Comparison Operator: $gt (https://www.mongodb.com/docs/manual/reference/operator/query/gt/)
          ✔ Match Document Fields (8ms)
        Comparison Operator: $gte (https://www.mongodb.com/docs/manual/reference/operator/query/gte/)
          ✔ Match Document Fields (9ms)
        Comparison Operator: $in (https://www.mongodb.com/docs/manual/reference/operator/query/in/)
          ✔ Use the $in Operator to Match Values (10ms)
          ✔ Use the $in Operator to Match Values in an Array
          ✔ Use the $in Operator with a Regular Expression
        Comparison Operator: $lt (https://www.mongodb.com/docs/manual/reference/operator/query/lt/)
          ✔ Match Document Fields (9ms)
        Comparison Operator: $lte (https://www.mongodb.com/docs/manual/reference/operator/query/lte/)
          ✔ Match Document Fields (8ms)
        Comparison Operator: $ne (https://www.mongodb.com/docs/manual/reference/operator/query/ne/)
          ✔ Match Document Fields (10ms)
        Comparison Operator: $nin (https://www.mongodb.com/docs/manual/reference/operator/query/nin/)
          ✔ Select on Unmatching Documents (7ms)
          ✔ Select on Elements Not in an Array
      Logical Query Operators
        Logical Operator: $and (https://www.mongodb.com/docs/manual/reference/operator/query/and/)
          ✔ AND Queries With Multiple Expressions Specifying the Same Field (10ms)
          ✔ AND Queries With Multiple Expressions Specifying the Same Operator
        Logical Operator: $not (https://www.mongodb.com/docs/manual/reference/operator/query/not/)
          ✔ Match Document Fields
          ✔ $not and Regular Expressions
        Logical Operator: $nor (https://www.mongodb.com/docs/manual/reference/operator/query/nor/)
          ✔ $nor Query with Two Expressions
          ✔ $nor and Additional Comparisons
          ✔ $nor and $exists
        Logical Operator: $or (https://www.mongodb.com/docs/manual/reference/operator/query/or/)
          ✔ Match Document Fields
          ✔ $or versus $in
          ✔ Nested $or Clauses
      Element Query Operators
        Element Query Operator: $exists (https://www.mongodb.com/docs/manual/reference/operator/query/exists/)
          ✔ Exists and Not Equal To (14ms)
          ✔ Null Values (22ms)
        Element Query Operator: $type (https://www.mongodb.com/docs/manual/reference/operator/query/type/)
          ✔ Querying by Data Type (BSON Code) (10ms)
          ✔ Querying by Data Type (BSON Alias)
          ✔ Querying by Data Type ("number")
          ✔ Querying by Multiple Data Type (BSON Code) (13ms)
          ✔ Querying by Multiple Data Type (BSON Alias) (7ms)
      Array Query Operators
        Array Query Operator: $all (https://www.mongodb.com/docs/manual/reference/operator/query/all/)
          ✔ Use $all to Match Values (9ms)
          ✔ Use $all with $elemMatch
          ✔ Use $all with Scalar Values
        Array Query Operator: $elemMatch (https://www.mongodb.com/docs/manual/reference/operator/query/elemMatch/)
          ✔ Element Match (11ms)
          ✔ Array of Embedded Documents (11ms)
          ✔ Single Query Condition (8ms)
        Array Query Operator: $size (https://www.mongodb.com/docs/manual/reference/operator/query/size/)
          ✔ Use $size to Match Array Sizes (18ms)
    Z) Ad-Hoc Tests
      ✔ should not match explicit nested fields
      ✔ should sort and limit in FindMany2 (20ms)

  jsonstor-jsonfile
    A) CRUD Tests
      ✔ should insert 100 documents, one at a time (823ms)
      ✔ should delete 100 documents, all at once (8ms)
      ✔ should insert 100 documents, all at once
      ✔ should read 100 documents, one at a time (9ms)
      ✔ should replace 100 documents, one at a time (850ms)
      ✔ should read 100 documents, all at once
      ✔ should read 5 documents, all at once and sorted
      ✔ should update 100 documents, one at a time (879ms)
      ✔ should update 100 documents, all at once (9ms)
      ✔ should delete 100 documents, one at a time (656ms)
    B) Rainbow Tests
      Nested Fields (explicit)
        ✔ should not perform matching on nested fields using implicit $eq
        ✔ should not perform matching on nested fields using explicit $eq
      Nested Fields (dot notation)
        ✔ should perform matching on nested fields using implicit $eq and dot notation
        ✔ should perform matching on nested fields using explicit $eq and dot notation
      Operator $eq (===)
        ✔ should perform strict equality (===) on 'bns'
        ✔ should perform strict equality (===) on 'o'
        ✔ should perform strict equality (===) on 'a'
        ✔ should not perform loose equality (==) on 'bns'
        ✔ should not perform loose equality (==) on 'o'
        ✔ should not perform loose equality (==) on 'a'
        ✔ should equate null with an undefined field
      Operator $ne (!==)
        ✔ should perform strict inequality (!==) on 'bns'
        ✔ should perform strict inequality (!==) on 'o'
        ✔ should perform strict inequality (!==) on 'a'
        ✔ should not perform loose inequality (!=) on 'bns'
        ✔ should not perform loose inequality (!=) on 'o'
        ✔ should not perform loose inequality (!=) on 'a'
      Operator $gte (>=)
        ✔ should perform strict comparison (>=) on 'bns'
        ✔ should not perform loose comparison (>=) on 'bns'
        ✔ should equate null with an undefined field
      Operator $gt (>)
        ✔ should perform strict comparison (>=) on 'bns'
        ✔ should not perform loose comparison (>=) on 'bns'
      Operator $lte (<=)
        ✔ should perform strict comparison (<=) on 'bns'
        ✔ should not perform loose comparison (<=) on 'bns'
        ✔ should equate null with an undefined field
      Operator $lt (<)
        ✔ should perform strict comparison (<) on 'bns'
        ✔ should not perform loose comparison (<) on 'bns'
    C) UserInfo Permissions Tests
      Alice, Bob, and Eve scenario
        ✔ Should add documents and set permissions (45ms)
        ✔ Alice should read all documents and write all documents (66ms)
        ✔ Bob should read some documents and write some documents (74ms)
        ✔ Eve should read some documents and write some documents (60ms)
        ✔ Public objects should be readable by everyone (60ms)
        ✔ Public objects should only be writable by the owner (46ms)
        ✔ Should not allow readers to update documents (63ms)
    D) Engine Contract Tests
      ✔ should refuse a criteria naming an unknown operator
      ✔ should refuse a criteria which is not an object
      ✔ should refuse an update naming an unknown operator
      ✔ should refuse an update which cannot be applied
      ✔ should not alias a FindOne result to the stored document
      ✔ should not alias a FindMany result to the stored documents
      ✔ should sort a missing field and a null below every value
      ✔ should reverse that order when sorting descending
      ✔ should limit the result to MaxCount after sorting
    M) MongoDB Tutorial
      Query Documents (https://www.mongodb.com/docs/manual/tutorial/query-documents/)
        Select All Documents in a Collection
          ✔ Match All Documents with an Empty Object {}
        Specify Equality Condition
          ✔ Match Fields with Implicit Equality
        Specify Conditions Using Query Operators
          ✔ Match Fields with an Array of Possible Values
        Specify AND Conditions
          ✔ Match Fields with an Array of Possible Values
        Specify OR Conditions
          ✔ Match Fields against an Array of Possible Values
        Specify AND as well as OR Conditions
          ✔ Match Fields Using AND and OR
      Query on Embedded/Nested Documents (https://www.mongodb.com/docs/manual/tutorial/query-embedded-documents/)
        Query on Embedded/Nested Documents
          ✔ Specify Equality Match on a Nested Field
          ✔ Specify Match using Query Operator
          ✔ Specify AND Condition
        Match an Embedded/Nested Document
          ✔ Specify Equality Match on an Embedded Document
      Query an Array (https://www.mongodb.com/docs/manual/tutorial/query-arrays/)
        Match an Array
          ✔ Match an Array Exactly
          ✔ Match Array Elements
        Query an Array for an Element
          ✔ Match a Single Array Element
          ✔ Match Array Elements by Comparison
        Specify Multiple Conditions for Array Elements
          ✔ Query an Array with Compound Filter Conditions on the Array Elements
          ✔ Query for an Array Element that Meets Multiple Criteria
          ✔ Query for an Element by the Array Index Position
          ✔ Query an Array by Array Length
      Query an Array of Embedded Documents (https://www.mongodb.com/docs/manual/tutorial/query-array-of-documents/)
        Query for a Document Nested in an Array
          ✔ Match a Document Exactly
        Specify a Query Condition on a Field in an Array of Documents
          ✔ Specify a Query Condition on a Field Embedded in an Array of Documents
          ✔ Use the Array Index to Query for a Field in the Embedded Document
        Specify Multiple Conditions for Array of Documents
          ✔ A Single Nested Document Meets Multiple Query Conditions on Nested Fields
          ✔ Combination of Elements Satisfies the Criteria
      Query for Null or Missing Fields (https://www.mongodb.com/docs/manual/tutorial/query-for-null-fields/)
        Equality Filter
          ✔ Match Fields that are Null or Missing
        Type Check
          ✔ Match Fields that Exist And are Null
        Existence Check
          ✔ Match Fields that are Missing
    N) MongoDB Reference
      Comparison Query Operators
        Comparison Operator: $eq (https://www.mongodb.com/docs/manual/reference/operator/query/eq/)
          Equals an Array Value
            ✔ Match an Array Element
            ✔ Match an Array Element Using Implicit $eq
          Regex Match Behaviour
            ✔ $eq match on a string
            ✔ $eq match on a regular expression
            ✔ Use the $in Operator with a Regular Expression
        Comparison Operator: $gt (https://www.mongodb.com/docs/manual/reference/operator/query/gt/)
          ✔ Match Document Fields
        Comparison Operator: $gte (https://www.mongodb.com/docs/manual/reference/operator/query/gte/)
          ✔ Match Document Fields
        Comparison Operator: $in (https://www.mongodb.com/docs/manual/reference/operator/query/in/)
          ✔ Use the $in Operator to Match Values
          ✔ Use the $in Operator to Match Values in an Array
          ✔ Use the $in Operator with a Regular Expression
        Comparison Operator: $lt (https://www.mongodb.com/docs/manual/reference/operator/query/lt/)
          ✔ Match Document Fields
        Comparison Operator: $lte (https://www.mongodb.com/docs/manual/reference/operator/query/lte/)
          ✔ Match Document Fields
        Comparison Operator: $ne (https://www.mongodb.com/docs/manual/reference/operator/query/ne/)
          ✔ Match Document Fields
        Comparison Operator: $nin (https://www.mongodb.com/docs/manual/reference/operator/query/nin/)
          ✔ Select on Unmatching Documents
          ✔ Select on Elements Not in an Array
      Logical Query Operators
        Logical Operator: $and (https://www.mongodb.com/docs/manual/reference/operator/query/and/)
          ✔ AND Queries With Multiple Expressions Specifying the Same Field
          ✔ AND Queries With Multiple Expressions Specifying the Same Operator
        Logical Operator: $not (https://www.mongodb.com/docs/manual/reference/operator/query/not/)
          ✔ Match Document Fields
          ✔ $not and Regular Expressions
        Logical Operator: $nor (https://www.mongodb.com/docs/manual/reference/operator/query/nor/)
          ✔ $nor Query with Two Expressions
          ✔ $nor and Additional Comparisons
          ✔ $nor and $exists
        Logical Operator: $or (https://www.mongodb.com/docs/manual/reference/operator/query/or/)
          ✔ Match Document Fields
          ✔ $or versus $in
          ✔ Nested $or Clauses
      Element Query Operators
        Element Query Operator: $exists (https://www.mongodb.com/docs/manual/reference/operator/query/exists/)
          ✔ Exists and Not Equal To
          ✔ Null Values
        Element Query Operator: $type (https://www.mongodb.com/docs/manual/reference/operator/query/type/)
          ✔ Querying by Data Type (BSON Code)
          ✔ Querying by Data Type (BSON Alias)
          ✔ Querying by Data Type ("number")
          ✔ Querying by Multiple Data Type (BSON Code)
          ✔ Querying by Multiple Data Type (BSON Alias)
      Array Query Operators
        Array Query Operator: $all (https://www.mongodb.com/docs/manual/reference/operator/query/all/)
          ✔ Use $all to Match Values
          ✔ Use $all with $elemMatch
          ✔ Use $all with Scalar Values
        Array Query Operator: $elemMatch (https://www.mongodb.com/docs/manual/reference/operator/query/elemMatch/)
          ✔ Element Match
          ✔ Array of Embedded Documents
          ✔ Single Query Condition
        Array Query Operator: $size (https://www.mongodb.com/docs/manual/reference/operator/query/size/)
          ✔ Use $size to Match Array Sizes
    Z) Ad-Hoc Tests
      ✔ should not match explicit nested fields
      ✔ should sort and limit in FindMany2 (65ms)


  360 passing (9s)
```

## Summary

- Unit Tests: 38 passed (passed)
- Parity Tests: 360 passed (passed)
- Total: 398 passed
```
