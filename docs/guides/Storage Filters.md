# Json Storages


## Storage Filters


### jsonstor-oplog


### jsonstor-userinfo

If you see errors like `The required parameter is missing: [UserInfo] of type [object].`
  or `Unknown modifier: _user.updated_at`,
  this means that `jsonstor` encountered a document in the storage which is missing
  the user info portion of the document.
This can occur when data that was generated without the `jsonstor-userinfo` filter
  is accessed later inserted with the `jsonstor-userinfo` filter.



