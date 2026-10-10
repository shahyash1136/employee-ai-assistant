# Database

## Purpose and responsibility

Open the application's SQLite database and make sure its tables exist. One file, one exported handle. Every store that persists runtime data imports `db` from here.

For the meaning of each table and column, see [06-DATA-AND-STATE.md](../06-DATA-AND-STATE.md). This doc covers the mechanics.

This module is SQLite only. HR policy passages live in a separate Postgres database with its own connection code in the same folder (`vectorDb.ts`, `knowledgeSchema.ts`); that is documented in [policy-knowledge.md](policy-knowledge.md#storage).

## Where it sits

Bottom of the data layer. See [Architecture 2.1](../03-ARCHITECTURE-AND-LIFECYCLE.md#21-server) and step 8 of the [startup sequence](../03-ARCHITECTURE-AND-LIFECYCLE.md#31-server-startup).

## Key file

[server/src/db/database.ts](../../server/src/db/database.ts)

| Lines | What happens |
| --- | --- |
| [5-11](../../server/src/db/database.ts#L5-L11) | Compute `<repo>/data/app.db` from this file's own location. |
| [13](../../server/src/db/database.ts#L13) | `new DatabaseSync(dbPath)` opens the file, creating it if missing. |
| [17](../../server/src/db/database.ts#L17) | `PRAGMA journal_mode = WAL`. |
| [19-84](../../server/src/db/database.ts#L19-L84) | One `db.exec` with six `CREATE TABLE IF NOT EXISTS` and their indexes. |

## Who uses it

| Importer | Tables |
| --- | --- |
| [conversation/session.store.ts](../../server/src/conversation/session.store.ts) | `sessions`, `messages` |
| [approvals/approvalStore.ts](../../server/src/approvals/approvalStore.ts) | `approvals` |
| [tracing/traceStore.ts](../../server/src/tracing/traceStore.ts) | `traces`, `spans` |
| [logging/requestLogStore.ts](../../server/src/logging/requestLogStore.ts) | `request_logs` |
| [logging/metricsService.ts](../../server/src/logging/metricsService.ts) | `request_logs` (read) |

## Non-obvious logic

### `node:sqlite` is synchronous

`DatabaseSync` is Node's built-in SQLite binding. Every `.run()`, `.get()`, and `.all()` blocks the event loop until it finishes. That has two effects worth understanding:

- **No interleaving.** Between two consecutive statements with no `await` in between, no other request can run. Code like "check owner, then insert" in the chat controller is safe without transactions.
- **Blocking cost.** A slow query stalls every request. At this data size (capped tables, small rows) it is not noticeable.

### Schema creation is an import side effect

There is no migration system and no "init" function. Importing `database.ts` runs the DDL. ES modules guarantee a module finishes evaluating before its importers continue, so by the time a store calls `db.prepare(...)` at its own top level, the tables are there.

`IF NOT EXISTS` makes this safe to run on every start. It also means **schema changes are not applied to an existing database**. If you add a column to a `CREATE TABLE` here, an existing `data/app.db` keeps its old shape until you delete the file or alter it by hand.

### WAL mode

Write-ahead logging lets readers proceed while a write is in progress. The comment gives the scenario: a manager loading `/traces` or `/approvals` should not block a chat that is writing spans ([database.ts:15-16](../../server/src/db/database.ts#L15-L16)). WAL creates two sidecar files, `app.db-wal` and `app.db-shm`, both git-ignored.

Within this single process all access is synchronous anyway, so the practical benefit applies mainly when another process (a script, a DB browser) reads the file while the server runs.

### No foreign keys

Relationships are by convention: `messages.session_id` refers to `sessions.session_id`, `spans.trace_id` to `traces.trace_id`, and so on, but no `REFERENCES` clauses exist and nothing cascades. Cleanup is done in code, for example `pruneSpans` deletes spans whose trace is gone ([traceStore.ts:112-114](../../server/src/tracing/traceStore.ts#L112-L114)).

### Timestamps are ISO strings

Every time column is `TEXT` holding `toISOString()` output. ISO-8601 strings in UTC sort correctly as text, which is why `MAX(timestamp)` works in the session list query.

### Caps

| Table | Cap | Enforced in |
| --- | --- | --- |
| `approvals` | 200 rows | [approvalStore.ts:35](../../server/src/approvals/approvalStore.ts#L35) |
| `traces` | 200 rows (spans follow) | [traceStore.ts:58](../../server/src/tracing/traceStore.ts#L58) |
| `request_logs` | 1000 rows | [requestLogStore.ts:18](../../server/src/logging/requestLogStore.ts#L18) |
| `sessions`, `messages` | None | |

Each capped store deletes surplus rows immediately after every insert.

## Inputs, outputs, side effects, dependencies

- **Inputs:** none (the path is fixed).
- **Outputs:** the `db` handle.
- **Side effects:** creates `data/app.db` and sidecar files; creates tables.
- **Depends on:** Node 22.13+ for `node:sqlite`.

## Why it is built this way, and trade-offs

- **Built-in SQLite** means zero database setup and no native add-on to compile.
- **One process-wide handle** is the simplest possible sharing model. It rules out running several server instances against the same data without more thought.
- **No migrations** is fine for a practice project where the file can be deleted, and a real gap otherwise.
- **The handle is never closed.** See [09](../09-ISSUES-AND-OPEN-QUESTIONS.md#missing-error-handling).

## Source files covered

- `server/src/db/database.ts`
