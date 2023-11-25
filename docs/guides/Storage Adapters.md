# Json Storages


## Storage Adapters


### jsonstor-memory


### jsonstor-jsonfile

If the file `Settings.Path` does not exist, it will be created on the first insert.
Also, all queries against a non-existant `Settings.Path` will return empty results rather resulting in an error.


### jsonstor-folder

If the folder `Settings.Path` does not exist, it will be created on the first insert.
Also, all queries against a non-existant `Settings.Path` will return empty results rather resulting in an error.


### jsonstor-mongodb

If the database `Settings.DatabaseName` or the collection `Settings.CollectionName` do not exist,
  they will be created on the first storage call.


