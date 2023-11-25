```shell
  100) jsonstor-memory Tests
    A) CRUD Tests
      ✔ should insert 100 documents, one at a time
      ✔ should delete 100 documents, all at once
      ✔ should insert 100 documents, all at once
      ✔ should read 100 documents, one at a time (19ms)
      ✔ should replace 100 documents, one at a time (16ms)
      ✔ should read 100 documents, all at once
      ✔ should update 100 documents, one at a time (14ms)
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
    C) MongoDB Tutorial
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
    D) MongoDB Reference
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

  200) jsonstor-folder Tests
    A) CRUD Tests
      ✔ should insert 100 documents, one at a time (127ms)
      ✔ should delete 100 documents, all at once (59ms)
      ✔ should insert 100 documents, all at once (118ms)
      ✔ should read 100 documents, one at a time (500ms)
      ✔ should replace 100 documents, one at a time (1265ms)
      ✔ should read 100 documents, all at once (10ms)
      ✔ should update 100 documents, one at a time (793ms)
      ✔ should update 100 documents, all at once (108ms)
      ✔ should delete 100 documents, one at a time (74ms)
    B) Rainbow Tests
      Nested Fields (explicit)
        ✔ should not perform matching on nested fields using implicit $eq (6ms)
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
    C) MongoDB Tutorial
      Query Documents (https://www.mongodb.com/docs/manual/tutorial/query-documents/)
        Select All Documents in a Collection
          ✔ Match All Documents with an Empty Object {} (7ms)
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
          ✔ Specify Equality Match on a Nested Field (7ms)
          ✔ Specify Match using Query Operator
          ✔ Specify AND Condition
        Match an Embedded/Nested Document
          ✔ Specify Equality Match on an Embedded Document
      Query an Array (https://www.mongodb.com/docs/manual/tutorial/query-arrays/)
        Match an Array
          ✔ Match an Array Exactly (6ms)
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
          ✔ Match a Document Exactly (9ms)
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
    D) MongoDB Reference
      Comparison Query Operators
        Comparison Operator: $eq (https://www.mongodb.com/docs/manual/reference/operator/query/eq/)
          Equals an Array Value
            ✔ Match an Array Element
            ✔ Match an Array Element Using Implicit $eq
          Regex Match Behaviour
            ✔ $eq match on a string (6ms)
            ✔ $eq match on a regular expression
            ✔ Use the $in Operator with a Regular Expression
        Comparison Operator: $gt (https://www.mongodb.com/docs/manual/reference/operator/query/gt/)
          ✔ Match Document Fields (6ms)
        Comparison Operator: $gte (https://www.mongodb.com/docs/manual/reference/operator/query/gte/)
          ✔ Match Document Fields
        Comparison Operator: $in (https://www.mongodb.com/docs/manual/reference/operator/query/in/)
          ✔ Use the $in Operator to Match Values (6ms)
          ✔ Use the $in Operator to Match Values in an Array
          ✔ Use the $in Operator with a Regular Expression
        Comparison Operator: $lt (https://www.mongodb.com/docs/manual/reference/operator/query/lt/)
          ✔ Match Document Fields (6ms)
        Comparison Operator: $lte (https://www.mongodb.com/docs/manual/reference/operator/query/lte/)
          ✔ Match Document Fields
        Comparison Operator: $ne (https://www.mongodb.com/docs/manual/reference/operator/query/ne/)
          ✔ Match Document Fields
        Comparison Operator: $nin (https://www.mongodb.com/docs/manual/reference/operator/query/nin/)
          ✔ Select on Unmatching Documents (6ms)
          ✔ Select on Elements Not in an Array
      Logical Query Operators
        Logical Operator: $and (https://www.mongodb.com/docs/manual/reference/operator/query/and/)
          ✔ AND Queries With Multiple Expressions Specifying the Same Field (6ms)
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
          ✔ Exists and Not Equal To (11ms)
          ✔ Null Values (19ms)
        Element Query Operator: $type (https://www.mongodb.com/docs/manual/reference/operator/query/type/)
          ✔ Querying by Data Type (BSON Code) (6ms)
          ✔ Querying by Data Type (BSON Alias)
          ✔ Querying by Data Type ("number")
          ✔ Querying by Multiple Data Type (BSON Code) (11ms)
          ✔ Querying by Multiple Data Type (BSON Alias) (6ms)
      Array Query Operators
        Array Query Operator: $all (https://www.mongodb.com/docs/manual/reference/operator/query/all/)
          ✔ Use $all to Match Values (8ms)
          ✔ Use $all with $elemMatch
          ✔ Use $all with Scalar Values
        Array Query Operator: $elemMatch (https://www.mongodb.com/docs/manual/reference/operator/query/elemMatch/)
          ✔ Element Match
          ✔ Array of Embedded Documents (9ms)
          ✔ Single Query Condition (7ms)
        Array Query Operator: $size (https://www.mongodb.com/docs/manual/reference/operator/query/size/)
          ✔ Use $size to Match Array Sizes (13ms)
    Z) Ad-Hoc Tests
      ✔ should not match explicit nested fields (9ms)

  300) jsonstor-jsonfile Tests
    A) CRUD Tests
      ✔ should insert 100 documents, one at a time (666ms)
      ✔ should delete 100 documents, all at once (6ms)
      ✔ should insert 100 documents, all at once
      ✔ should read 100 documents, one at a time (14ms)
      ✔ should replace 100 documents, one at a time (717ms)
      ✔ should read 100 documents, all at once
      ✔ should update 100 documents, one at a time (733ms)
      ✔ should update 100 documents, all at once (7ms)
      ✔ should delete 100 documents, one at a time (670ms)
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
    C) MongoDB Tutorial
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
    D) MongoDB Reference
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
          ✔ Null Values (7ms)
        Element Query Operator: $type (https://www.mongodb.com/docs/manual/reference/operator/query/type/)
          ✔ Querying by Data Type (BSON Code)
          ✔ Querying by Data Type (BSON Alias)
          ✔ Querying by Data Type ("number")
          ✔ Querying by Multiple Data Type (BSON Code) (7ms)
          ✔ Querying by Multiple Data Type (BSON Alias)
      Array Query Operators
        Array Query Operator: $all (https://www.mongodb.com/docs/manual/reference/operator/query/all/)
          ✔ Use $all to Match Values
          ✔ Use $all with $elemMatch
          ✔ Use $all with Scalar Values
        Array Query Operator: $elemMatch (https://www.mongodb.com/docs/manual/reference/operator/query/elemMatch/)
          ✔ Element Match (7ms)
          ✔ Array of Embedded Documents (7ms)
          ✔ Single Query Condition
        Array Query Operator: $size (https://www.mongodb.com/docs/manual/reference/operator/query/size/)
          ✔ Use $size to Match Array Sizes
    Z) Ad-Hoc Tests
      ✔ should not match explicit nested fields (6ms)

  400) jsonstor-mongodb Tests
    A) CRUD Tests
      ✔ should insert 100 documents, one at a time (688ms)
      ✔ should delete 100 documents, all at once (13ms)
      ✔ should insert 100 documents, all at once (16ms)
      ✔ should read 100 documents, one at a time (551ms)
      ✔ should replace 100 documents, one at a time (1249ms)
      ✔ should read 100 documents, all at once (7ms)
      ✔ should update 100 documents, one at a time (693ms)
      ✔ should update 100 documents, all at once (9ms)
      ✔ should delete 100 documents, one at a time (599ms)
    B) Rainbow Tests
      Nested Fields (explicit)
        ✔ should not perform matching on nested fields using implicit $eq
        ✔ should not perform matching on nested fields using explicit $eq (6ms)
      Nested Fields (dot notation)
        ✔ should perform matching on nested fields using implicit $eq and dot notation
        ✔ should perform matching on nested fields using explicit $eq and dot notation
      Operator $eq (===)
        ✔ should perform strict equality (===) on 'bns' (29ms)
        ✔ should perform strict equality (===) on 'o' (9ms)
        ✔ should perform strict equality (===) on 'a' (13ms)
        ✔ should not perform loose equality (==) on 'bns' (31ms)
        ✔ should not perform loose equality (==) on 'o' (11ms)
        ✔ should not perform loose equality (==) on 'a' (9ms)
        ✔ should equate null with an undefined field
      Operator $ne (!==)
        ✔ should perform strict inequality (!==) on 'bns' (31ms)
        ✔ should perform strict inequality (!==) on 'o' (9ms)
        ✔ should perform strict inequality (!==) on 'a'
        ✔ should not perform loose inequality (!=) on 'bns' (18ms)
        ✔ should not perform loose inequality (!=) on 'o' (6ms)
        ✔ should not perform loose inequality (!=) on 'a' (6ms)
      Operator $gte (>=)
        ✔ should perform strict comparison (>=) on 'bns' (30ms)
        ✔ should not perform loose comparison (>=) on 'bns' (15ms)
        ✔ should equate null with an undefined field (6ms)
      Operator $gt (>)
        ✔ should perform strict comparison (>=) on 'bns' (14ms)
        ✔ should not perform loose comparison (>=) on 'bns' (14ms)
      Operator $lte (<=)
        ✔ should perform strict comparison (<=) on 'bns' (15ms)
        ✔ should not perform loose comparison (<=) on 'bns' (14ms)
        ✔ should equate null with an undefined field
      Operator $lt (<)
        ✔ should perform strict comparison (<) on 'bns' (14ms)
        ✔ should not perform loose comparison (<) on 'bns' (15ms)
    C) MongoDB Tutorial
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
          ✔ Match Fields Using AND and OR (6ms)
      Query on Embedded/Nested Documents (https://www.mongodb.com/docs/manual/tutorial/query-embedded-documents/)
        Query on Embedded/Nested Documents
          ✔ Specify Equality Match on a Nested Field
          ✔ Specify Match using Query Operator (6ms)
          ✔ Specify AND Condition
        Match an Embedded/Nested Document
          ✔ Specify Equality Match on an Embedded Document (9ms)
      Query an Array (https://www.mongodb.com/docs/manual/tutorial/query-arrays/)
        Match an Array
          ✔ Match an Array Exactly
          ✔ Match Array Elements
        Query an Array for an Element
          ✔ Match a Single Array Element
          ✔ Match Array Elements by Comparison
        Specify Multiple Conditions for Array Elements
          ✔ Query an Array with Compound Filter Conditions on the Array Elements
          ✔ Query for an Array Element that Meets Multiple Criteria (6ms)
          ✔ Query for an Element by the Array Index Position (6ms)
          ✔ Query an Array by Array Length
      Query an Array of Embedded Documents (https://www.mongodb.com/docs/manual/tutorial/query-array-of-documents/)
        Query for a Document Nested in an Array
          ✔ Match a Document Exactly
        Specify a Query Condition on a Field in an Array of Documents
          ✔ Specify a Query Condition on a Field Embedded in an Array of Documents
          ✔ Use the Array Index to Query for a Field in the Embedded Document
        Specify Multiple Conditions for Array of Documents
          ✔ A Single Nested Document Meets Multiple Query Conditions on Nested Fields (9ms)
          ✔ Combination of Elements Satisfies the Criteria (9ms)
      Query for Null or Missing Fields (https://www.mongodb.com/docs/manual/tutorial/query-for-null-fields/)
        Equality Filter
          ✔ Match Fields that are Null or Missing
        Type Check
          ✔ Match Fields that Exist And are Null
        Existence Check
          ✔ Match Fields that are Missing
    D) MongoDB Reference
      Comparison Query Operators
        Comparison Operator: $eq (https://www.mongodb.com/docs/manual/reference/operator/query/eq/)
          Equals an Array Value
            ✔ Match an Array Element
            ✔ Match an Array Element Using Implicit $eq
          Regex Match Behaviour
            ✔ $eq match on a string (11ms)
            ✔ $eq match on a regular expression
            ✔ Use the $in Operator with a Regular Expression (10ms)
        Comparison Operator: $gt (https://www.mongodb.com/docs/manual/reference/operator/query/gt/)
          ✔ Match Document Fields
        Comparison Operator: $gte (https://www.mongodb.com/docs/manual/reference/operator/query/gte/)
          ✔ Match Document Fields
        Comparison Operator: $in (https://www.mongodb.com/docs/manual/reference/operator/query/in/)
          ✔ Use the $in Operator to Match Values
          ✔ Use the $in Operator to Match Values in an Array
          ✔ Use the $in Operator with a Regular Expression (7ms)
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
          ✔ AND Queries With Multiple Expressions Specifying the Same Field (10ms)
          ✔ AND Queries With Multiple Expressions Specifying the Same Operator
        Logical Operator: $not (https://www.mongodb.com/docs/manual/reference/operator/query/not/)
          ✔ Match Document Fields
          ✔ $not and Regular Expressions (14ms)
        Logical Operator: $nor (https://www.mongodb.com/docs/manual/reference/operator/query/nor/)
          ✔ $nor Query with Two Expressions
          ✔ $nor and Additional Comparisons
          ✔ $nor and $exists
        Logical Operator: $or (https://www.mongodb.com/docs/manual/reference/operator/query/or/)
          ✔ Match Document Fields (7ms)
          ✔ $or versus $in (10ms)
          ✔ Nested $or Clauses
      Element Query Operators
        Element Query Operator: $exists (https://www.mongodb.com/docs/manual/reference/operator/query/exists/)
          ✔ Exists and Not Equal To (22ms)
          ✔ Null Values (24ms)
        Element Query Operator: $type (https://www.mongodb.com/docs/manual/reference/operator/query/type/)
          ✔ Querying by Data Type (BSON Code) (10ms)
          ✔ Querying by Data Type (BSON Alias) (11ms)
          ✔ Querying by Data Type ("number")
          ✔ Querying by Multiple Data Type (BSON Code) (22ms)
          ✔ Querying by Multiple Data Type (BSON Alias) (19ms)
      Array Query Operators
        Array Query Operator: $all (https://www.mongodb.com/docs/manual/reference/operator/query/all/)
          ✔ Use $all to Match Values
          ✔ Use $all with $elemMatch
          ✔ Use $all with Scalar Values
        Array Query Operator: $elemMatch (https://www.mongodb.com/docs/manual/reference/operator/query/elemMatch/)
          ✔ Element Match (19ms)
          ✔ Array of Embedded Documents (19ms)
          ✔ Single Query Condition (24ms)
        Array Query Operator: $size (https://www.mongodb.com/docs/manual/reference/operator/query/size/)
          ✔ Use $size to Match Array Sizes (35ms)
    Z) Ad-Hoc Tests
      ✔ should not match explicit nested fields (15ms)

  500) UserStorage Storage Tests
    A) CRUD Tests
      ✔ should insert 100 documents, one at a time
      ✔ should delete 100 documents, all at once
      ✔ should insert 100 documents, all at once
      ✔ should read 100 documents, one at a time (11ms)
      ✔ should replace 100 documents, one at a time (25ms)
      ✔ should read 100 documents, all at once
      ✔ should update 100 documents, one at a time (24ms)
      ✔ should update 100 documents, all at once (14ms)
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
    C) MongoDB Tutorial
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
    D) MongoDB Reference
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

  510) jsonstor-userinfo Permissions Tests
    Alice, Bob, and Eve scenario
      ✔ Should add documents and set permissions
      ✔ Alice should read all documents and write all documents
      ✔ Bob should read some documents and write some documents
      ✔ Eve should read some documents and write some documents
      ✔ Public objects should be readable by everyone
      ✔ Public objects should only be writable by the owner
      ✔ Should not allow readers to update documents


  517 passing (12s)

```