# @liquicode/jsonstor


# Project History


v0.1.0 (current)
---------------------------------------------------------------------

Built on `jsongin` 0.1.0, which carries many breaking changes of its own. Read
  [jsongin's history](https://github.com/liquicode/jsongin/blob/main/history.md) alongside this
  one, because most of what changed for a caller of `jsonstor` changed inside the engine.

Parity across storage mediums is ***100%***, across 360 compared behaviors: one shared
  inventory of 120 tests run against `jsonstor-memory`, `jsonstor-folder`, and
  `jsonstor-jsonfile`, and matched test by test against the same inventory run on a live
  MongoDB server through `jsonstor-mongodb`. Run `npm run parity-report` to measure it.


### Breaking

- ***A malformed criteria or update is refused rather than answered.*** A query naming an
  unknown operator, or an update which cannot be applied, rejects the promise instead of
  producing an empty result or a silent no-op.
  *Was: `Count( { $nope: 1 } )` returned `0`, which a caller could not tell from a query that
  genuinely matched nothing.* This follows `jsongin` 0.1.0 and applies to every storage
  function on every adapter.

- ***A document handed back is a copy.*** `FindOne()` and `FindMany()` with no projection used
  to return references into the adapter's own store, so a caller who modified a result modified
  the stored document. They return copies now.
  *Code which relied on mutating a result to write it back must call an update function.*

- ***`FindMany2()` orders documents the way MongoDB orders them.*** A document missing the sort
  field sorts as `null`; types order `null` < numbers < strings < objects < arrays < booleans <
  dates < regular expressions.
  *Was: compared with `>` and `<`, which report every comparison against a missing field as
  equal, so one such document made the whole order arbitrary.*

- ***`jsonstor-folder` names its files differently.*** Every component of the name is padded to
  a fixed width, so the listing sorts in the order the documents were written. A folder written
  by an earlier version keeps whatever order it had; the names are not migrated.


### Fixed

- ***`SqlExpression` dropped or corrupted a logical operator holding one condition.*** The
  `$and`, `$or`, and `$nor` branches each read the accumulator of clauses built so far where
  they meant the clauses they had just built. `{ $or: [ { a: 1 } ] }` rendered as an empty
  string and the constraint vanished from the statement; `{ z: 9, $or: [ { a: 1 } ] }` rendered
  as `((z = 9) AND ((z = 9)))`, the condition replaced by a duplicate of its neighbour. Both
  produced a statement which ran and returned the wrong rows. This affects `jsonstor-mysql` and
  any adapter built on `SqlExpression`, and it is a ***permissions*** defect wherever a
  single-condition `$or` restricts a read.

- ***`SqlExpression` rendered an empty logical operator as an empty string.*** `{ $or: [] }`
  contributed nothing to the statement. It is refused now, as `jsongin` 0.1.0 refuses it.

- ***`jsonstor-folder` returned documents in an order which changed between runs***, measured at
  two failures in eight runs of its suite. The file name was the sort key and its components
  were not padded, so a nanosecond field of `9000000` sorted after one of `564003000`; and
  `readdirSync` was trusted to return a sorted listing, which it does not promise. Both are
  fixed, and the natural order of a folder storage is now deterministic.

- `FindOne()` and `FindMany()` no longer alias their results to the store. See Breaking, above;
  it is listed twice because it is a fix for anyone who was not relying on it.


### Added

- ***A parity report.*** `npm run parity-report` runs one shared inventory against every
  built-in storage and against a live MongoDB through `jsonstor-mongodb`, matches the results
  test by test, and reports where any medium disagrees. `jsonstor`'s claim is that one
  interface carries across many mediums, and this measures that claim rather than asserting it.
  Requires a server at `localhost:27017`.

- ***`npm test` runs the tests.*** It ran `mocha tests/*.js` against a folder named `test/`, so
  it matched no files and exited green having run nothing. It now runs the unit tests and the
  parity inventory and reports both.

- ***`npm run coverage`***, which reports the parts of `src/` the suite never executes. It uses
  Node's own coverage collector and adds no dependency.

- ***`test/Storage Tests/D) Engine Contract Tests.js`***, a shared suite asserting the three
  things nothing asserted before: that a malformed criteria is refused, that a result is not
  aliased to the store, and that `FindMany2()` sorts the way MongoDB sorts.

- ***`test/Unit Tests/020) OpLog Filter Tests.js`***. Coverage reported the whole of
  `jsonstor-oplog`'s `GetFilter` as never executed; nothing had exercised the filter at all.

- ***Project documents.*** `CLAUDE.md`, `.plans/story.md` carrying the standing decisions this
  project should not silently reverse, and `.guides/upgrading-jsongin.md`.


v0.0.20 (2024-05-20)
---------------------------------------------------------------------

- Updated version to v0.0.20
- Added tests for FindMany2.


v0.0.14 (2024-05-20)
---------------------------------------------------------------------

- Added FindMany2 function to the data interface: FindMany2( Criteria, Projection, Sort, Limit, Options )


v0.0.12 (2024-03-03)
---------------------------------------------------------------------

- Updated npm library `@liquicode/jsongin` to `v0.0.20`.
- Fixed test headings.


v0.0.11 (2023-12-03)
---------------------------------------------------------------------

- More fixes to `SqlExpression()`.
	- Added `Options.AllowedFields` to control field processing.


v0.0.10 (2023-12-02)
---------------------------------------------------------------------

- Fixes to `SqlExpression()`.


v0.0.9 (2023-12-01)
---------------------------------------------------------------------

- Fixed dependency issue.


v0.0.8 (2023-12-01)
---------------------------------------------------------------------

- Added `SqlExpression()`.


v0.0.7 (2023-11-26)
---------------------------------------------------------------------

- Fixed docs more


v0.0.6 (2023-11-26)
---------------------------------------------------------------------

- Remove unsused dev-dependencies
- Fixed docs images
- Aded link to official docs in readme.md


v0.0.5 (2023-11-26)
---------------------------------------------------------------------

- Rename `json-storages` to `jsonstor`.
- Build external plugin projects.
- Restructure tests so that external plugins can easily validate compliance.

