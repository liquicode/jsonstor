# Upgrading the jsongin Dependency

`jsonstor` is built on `jsongin`, and the engine moves faster than the storage layer. This is
  how to move `jsonstor` onto a new one.


## Point at the local engine

***Do not add a `file:` dependency.*** The checkouts are linked by the npm workspace at
  `jsonx/`, so `@liquicode/jsongin` already resolves to `jsongin.git` next door — see
  `jsonx/.guides/jsonx-workspace.md`.

What has to move is the ***range***, and only when the engine's version leaves it. A range npm
  cannot satisfy locally is fetched from the registry ***silently***, which means the suite runs
  green against the old engine and tells you nothing:

```json
"dependencies": { "@liquicode/jsongin": "^0.1.0" }
```

Then `npm install` at the workspace root. Confirm what actually resolved before believing
anything else:

```bash
node -e "console.log( require( '@liquicode/jsongin' ).Library.version )"
```

That range is also what gets published, so there is nothing to swap back afterwards.


## Measure before you fix

***Run the suite first and record the failures.*** That list is the specification for the work.
A list of breakages predicted from `jsongin`'s `history.md` is a list of things to ***measure***
  rather than a list of things to fix — most predictions turn out wrong, because `jsonstor`
  uses a narrow slice of the engine.

Both engines can be loaded at once, which settles a question about a changed behavior in one
  run rather than by reading two changelogs:

```js
const old_engine = require( '../some-repo/node_modules/@liquicode/jsongin' );
const new_engine = require( '@liquicode/jsongin' );
console.log( old_engine.Library.version, new_engine.Library.version );
console.log( old_engine.Query( Document, Criteria ), new_engine.Query( Document, Criteria ) );
```

Any repo which still has the previous version installed will serve as the old engine.


## What jsonstor actually uses

The whole surface, as of 0.1.0. A change to anything else cannot reach `jsonstor` directly:

| Function | Where |
|---|---|
| `ShortType` | everywhere, for parameter validation |
| `Clone`, `SafeClone` | the adapters, `jsonstor-userinfo` |
| `Query` | every adapter's `Count`, `Find*`, `Update*`, `Delete*` |
| `Project` | `FindOne`, `FindMany`, `FindMany2` |
| `Sort` | `FindMany2` |
| `Update` | `UpdateOne`, `UpdateMany` |

`jsonstor-mongodb` uses `ShortType` and `SafeClone` only — it hands criteria straight to the
  driver — so an engine change almost never reaches it.


## Turn what you find into a test

A behavior worth probing is a behavior worth asserting. Probes go in `~temp/`, which is
  excluded from source control, and what they establish goes into `test/Storage Tests/` so it
  runs against every adapter and, in the parity run, against a live MongoDB.

***Confirm a new test fails without the fix.*** A check which has never been seen to fail is a
  check nobody should believe. Revert the change, run the test, watch it go red, restore the
  change.
