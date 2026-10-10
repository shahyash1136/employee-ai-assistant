# Policy Knowledge

## Purpose and responsibility

Lets the assistant answer "what do the rules say?" questions from the company's HR policy documents. This is **retrieval-augmented generation (RAG)**: the policy text is cut into passages, each passage is turned into a vector and stored, and at question time the passages closest in meaning to the question are fetched and handed to the model as the only material it may answer from.

The module has two halves that never run in the same process:

- **Ingestion** (offline, a script you run by hand): markdown files → chunks → embeddings → Postgres.
- **Retrieval** (online, inside a chat turn): query → embedding → nearest chunks → passages for the Policy Agent.

It is separate from everything else in the data layer. HR records come from CSVs, operational data lives in SQLite, and policy knowledge lives in Postgres.

## Where it sits

Data layer, reached only through one tool. See [Architecture 2.3](../03-ARCHITECTURE-AND-LIFECYCLE.md#23-policy-knowledge), the ingestion lifecycle in [3.7](../03-ARCHITECTURE-AND-LIFECYCLE.md#37-ingestion-script-lifecycle), and the request flow in [4.5](../03-ARCHITECTURE-AND-LIFECYCLE.md#45-policy-question-retrieval).

The agent and the tool that sit on top of this module are documented where the other agents and tools are: the Policy Agent in [agents.md](agents.md#the-policy-agent-and-forced-tool-choice), `search_hr_policies` in [tools.md](tools.md#the-policy-search-tool).

## Key files

| File | What it does |
| --- | --- |
| [data/policies/*.md](../../data/policies/) | The four source documents: Leave Policy, Work From Home Policy, Expense Reimbursement Policy, Code of Conduct. |
| [knowledge/chunker.ts](../../server/src/knowledge/chunker.ts) | Pure function that splits one markdown document into chunks. No I/O. |
| [knowledge/embedder.ts](../../server/src/knowledge/embedder.ts) | `embedTexts`: turns strings into vectors with the OpenAI embeddings API. Used by both halves. |
| [knowledge/ingest.ts](../../server/src/knowledge/ingest.ts) | The ingestion script. A second entry point next to `server.ts`. |
| [db/vectorDb.ts](../../server/src/db/vectorDb.ts) | Lazy `pg` connection pool and `closeVectorDb`. |
| [db/knowledgeSchema.ts](../../server/src/db/knowledgeSchema.ts) | Embedding model constants and `initKnowledgeSchema` (creates the extension, schema, and table). |
| [services/knowledgeRetrieval.service.ts](../../server/src/services/knowledgeRetrieval.service.ts) | `searchPolicies`: the similarity search used by the tool. |

## The source documents

Each file starts with flat `key: value` frontmatter between `---` lines, then a `#` title and numbered `##` sections:

| File | `title` | `policy_id` | `version` | Sections | Chunks |
| --- | --- | --- | --- | --- | --- |
| `leave-policy.md` | Leave Policy | HR-POL-001 | 2.1 | 15 | 14 |
| `work-from-home-policy.md` | Work From Home Policy | HR-POL-002 | 1.4 | 13 | 12 |
| `code-of-conduct.md` | Code of Conduct | HR-POL-003 | 2.0 | 13 | 11 |
| `expense-reimbursement-policy.md` | Expense Reimbursement Policy | FIN-POL-001 | 3.0 | 15 | 12 |

49 chunks in total. The chunk counts were confirmed with `npm run ingest:policies -- --dry-run`, which touches neither OpenAI nor the database.

`title` is required; the chunker throws without it ([chunker.ts:182](../../server/src/knowledge/chunker.ts#L182)). `effective_date` and `owner` are carried into chunk metadata but nothing reads them later.

## Chunking, step by step

[chunkPolicyDocument](../../server/src/knowledge/chunker.ts#L180-L199) runs five stages.

1. **Parse frontmatter** into a `meta` map with a regex, not a YAML library ([chunker.ts:42-53](../../server/src/knowledge/chunker.ts#L42-L53)).
2. **Split on `##` headings** ([chunker.ts:55-78](../../server/src/knowledge/chunker.ts#L55-L78)). The `#` title line is dropped because the title comes from frontmatter. Text before the first `##` goes under the heading "Overview".
3. **Split oversized sections** ([chunker.ts:122-145](../../server/src/knowledge/chunker.ts#L122-L145)). A section over 500 estimated tokens is cut on blank lines first, which keeps tables and bullet lists whole. Only a single block that is still too large is cut by sentence, with a 60-token overlap ([chunker.ts:92-120](../../server/src/knowledge/chunker.ts#L92-L120)). The pieces are renamed "Heading (part 1/2)". No section in the current documents is large enough to trigger this.
4. **Merge tiny sections** ([chunker.ts:151-178](../../server/src/knowledge/chunker.ts#L151-L178)). A section under 60 tokens is joined with the next one. A second pass folds a tiny trailing section, such as a closing "Questions", into the chunk before it, since it has no next neighbour.
5. **Build the chunk** ([chunker.ts:190-198](../../server/src/knowledge/chunker.ts#L190-L198)). `content` is a label line such as `Leave Policy (HR-POL-001, v2.1)` followed by each section as `## heading` and body. That exact string is what gets embedded and later shown to the model, so a passage makes sense on its own. `metadata` is the frontmatter plus `sections` (the heading list) and `approx_tokens`.

### Why sections, not fixed-size windows

The comment at [chunker.ts:3-7](../../server/src/knowledge/chunker.ts#L3-L7) gives the reasoning. Each policy is short and made of 13 to 15 small sections. A common 500 to 800 token window would pack four to six unrelated sections into one chunk, and its embedding would be a blur of all of them. Making one section the unit of retrieval keeps each vector about one topic.

### Why the merge threshold is 60

[chunker.ts:10-13](../../server/src/knowledge/chunker.ts#L10-L13) records a measurement: with a threshold of 100, merged chunks buried a small section and the right passage ranked first for 8 of 10 sample questions; at 60 it was 10 of 10.

### Token counts are estimates

`estimateTokens` is `length / 4` ([chunker.ts:18](../../server/src/knowledge/chunker.ts#L18)). It is only used for sizing decisions, so the approximation avoids a tokenizer dependency.

## Embedding

[embedder.ts:9-31](../../server/src/knowledge/embedder.ts#L9-L31). `embedTexts` sends inputs in batches of 100 to `text-embedding-3-small` and returns one 1536-number vector per input, in input order.

- It sorts results by their `index` field instead of trusting response order ([embedder.ts:19](../../server/src/knowledge/embedder.ts#L19)).
- It checks every vector's length and throws a message naming the model if it is wrong ([embedder.ts:21-25](../../server/src/knowledge/embedder.ts#L21-L25)). The database column would reject it anyway; failing here says why.
- It uses the plain `openai` client from [config/openai.ts](../../server/src/config/openai.ts), not the Agents SDK. These calls therefore do not appear as spans in traces.

The model name and dimension live in [knowledgeSchema.ts:6-7](../../server/src/db/knowledgeSchema.ts#L6-L7) because the table definition depends on them.

## Storage

One table, `knowledge.chunks`, created by `initKnowledgeSchema` ([knowledgeSchema.ts:16-34](../../server/src/db/knowledgeSchema.ts#L16-L34)). Columns are listed in [06-DATA-AND-STATE.md](../06-DATA-AND-STATE.md#3-postgres-policy-knowledge).

Three decisions are explained in comments:

- **The schema is created by the ingestion script, not on import** ([knowledgeSchema.ts:9-11](../../server/src/db/knowledgeSchema.ts#L9-L11)). This is the opposite of `database.ts`. `pg` is asynchronous, and the API server should not create tables as a side effect of loading a module. Consequence: the server never creates this table. If ingestion has not been run, searches fail.
- **No index on `embedding`** ([knowledgeSchema.ts:13-15](../../server/src/db/knowledgeSchema.ts#L13-L15)). At about 50 rows a full scan is faster than an approximate index and gives exact results.
- **Every row records `embedding_model`** ([knowledgeSchema.ts:3-5](../../server/src/db/knowledgeSchema.ts#L3-L5)). Vectors from different models cannot be compared. Retrieval filters on this column, so after a model change old rows are ignored instead of returning wrong neighbours.

### The connection pool is lazy

[vectorDb.ts:13-40](../../server/src/db/vectorDb.ts#L13-L40). `getVectorPool()` builds the pool on first call, not at import.

- **Why lazy:** the ingestion script is its own entry point. A module-level `new Pool({ connectionString: process.env.DATABASE_URL })` would read the variable at import time. If `dotenv` had not run yet, `pg` would quietly fall back to its defaults (OS user, default database) instead of failing ([vectorDb.ts:9-12](../../server/src/db/vectorDb.ts#L9-L12)).
- **Missing `DATABASE_URL` throws** with an example value ([vectorDb.ts:16-21](../../server/src/db/vectorDb.ts#L16-L21)). Because of the laziness this happens on the first policy search, not at server startup.
- **5-second connection timeout** so a host that accepts the connection but never answers cannot hang a chat request ([vectorDb.ts:23-25](../../server/src/db/vectorDb.ts#L23-L25)).
- **An `error` listener on the pool** ([vectorDb.ts:32-37](../../server/src/db/vectorDb.ts#L32-L37)). Without one, an error on an idle client is an unhandled event and kills the process. It logs only the message and code, because pino's error serializer would also print the client's connection parameters, password included.
- **`closeVectorDb`** exists for scripts: an open pool keeps the event loop alive, so the process would finish and then hang ([vectorDb.ts:42-49](../../server/src/db/vectorDb.ts#L42-L49)). The API server never calls it.

## Ingestion, step by step

Run from `server/`:

```bash
npm run ingest:policies              # chunk, embed, write
npm run ingest:policies -- --dry-run # chunk only, print boundaries
```

[ingest.ts](../../server/src/knowledge/ingest.ts):

1. `import "dotenv/config"` first, for the same reason as in `server.ts` ([ingest.ts:5-7](../../server/src/knowledge/ingest.ts#L5-L7)).
2. Read every `.md` file in `data/policies/`, sorted, and chunk each. No files, or a file that yields no chunks, is an error ([ingest.ts:20-32](../../server/src/knowledge/ingest.ts#L20-L32)).
3. With `--dry-run`, print one line per chunk and stop ([ingest.ts:45-48](../../server/src/knowledge/ingest.ts#L45-L48)).
4. **Embed everything before touching the database** ([ingest.ts:50-52](../../server/src/knowledge/ingest.ts#L50-L52)). An API failure then leaves existing data untouched, and no transaction is held open across network calls.
5. Create the schema if needed, then open **one transaction** for the whole sync ([ingest.ts:54-58](../../server/src/knowledge/ingest.ts#L54-L58)).
6. Delete rows whose `source` file no longer exists on disk ([ingest.ts:60-61](../../server/src/knowledge/ingest.ts#L60-L61)). A removed policy must stop answering questions.
7. For each current file, delete its rows and insert the new chunks ([ingest.ts:63-81](../../server/src/knowledge/ingest.ts#L63-L81)). Replace rather than upsert: if a document shrinks from 10 chunks to 8, an upsert would leave chunks 9 and 10 behind.
8. Commit, or roll back on any error. Always release the client and close the pool ([ingest.ts:82-97](../../server/src/knowledge/ingest.ts#L82-L97)).

The script is idempotent: running it twice gives the same table. It always re-embeds every chunk; there is no change detection.

Vectors are passed to SQL as text, `[0.1,0.2,...]`, and cast with `$4::vector` ([ingest.ts:76](../../server/src/knowledge/ingest.ts#L76)). That avoids needing a pgvector type adapter for `pg`.

## Retrieval, step by step

[searchPolicies](../../server/src/services/knowledgeRetrieval.service.ts#L54-L89):

1. Trim the query; empty throws. Clamp `topK` to between 1 and 10. The tool always uses the default of 4.
2. Embed the query with the same `embedTexts`.
3. Run one SQL statement: `embedding <=> $1::vector AS distance`, filtered to the current `embedding_model`, ordered by distance, limited to `topK` ([knowledgeRetrieval.service.ts:67-74](../../server/src/services/knowledgeRetrieval.service.ts#L67-L74)). `<=>` is pgvector's cosine distance operator: 0 means identical direction, 2 means opposite.
4. Drop rows with distance above 0.75 and map the rest to `PolicyPassage` objects, pulling `title`, `policy_id`, `version`, and `sections` out of the JSON metadata ([knowledgeRetrieval.service.ts:36-49](../../server/src/services/knowledgeRetrieval.service.ts#L36-L49), [76](../../server/src/services/knowledgeRetrieval.service.ts#L76)).
5. Log one pino line, `policy_search`, with the query **length**, candidate count, returned count, and best distance ([knowledgeRetrieval.service.ts:78-87](../../server/src/services/knowledgeRetrieval.service.ts#L78-L87)). The query text is deliberately not logged because questions can contain personal details.

### The distance cutoff cannot tell "covered" from "not covered"

The comment at [knowledgeRetrieval.service.ts:19-25](../../server/src/services/knowledgeRetrieval.service.ts#L19-L25) records measured best-match distances:

| Kind of question | Top-1 distance |
| --- | --- |
| On-topic, answered by the policies | 0.33 to 0.69 |
| HR-sounding but not covered (notice period, insurance) | 0.49 to 0.76 |
| Unrelated | 0.73 to 0.94 |

The middle group overlaps the first, so no threshold separates them. The 0.75 cutoff is only a coarse noise filter. The real defence is in the Policy Agent's instructions, which tell it that search always returns the closest passages and that it must say the documents do not cover a topic when the passages do not actually answer the question ([policy.agent.ts:38-42](../../server/src/agents/domains/policy.agent.ts#L38-L42)).

## Failure behaviour

Every failure inside a search (missing `DATABASE_URL`, Postgres down or slow, table not created, OpenAI embedding error) is thrown from `searchPolicies`, caught by `safeToolExecute` in the tool, and returned to the model as a generic JSON error ([policy.tool.ts:22](../../server/src/tools/policy.tool.ts#L22), [safeToolExecute.ts:13-18](../../server/src/utils/safeToolExecute.ts#L13-L18)). The chat turn continues and the user gets an apology rather than a 502. The real cause is only in the server's console output.

The query is embedded before the pool is touched ([knowledgeRetrieval.service.ts:63-67](../../server/src/services/knowledgeRetrieval.service.ts#L63-L67)), so a search that fails for a database reason has already paid for one embedding call.

## Inputs, outputs, side effects, dependencies

- **Inputs:** markdown files (ingestion); a query string (retrieval).
- **Outputs:** rows in `knowledge.chunks`; `PolicyPassage[]`.
- **Side effects:** OpenAI embedding calls (one batch per ingestion run, one call per search); Postgres reads and writes; pino log lines.
- **Environment:** `DATABASE_URL`, `OPENAI_API_KEY`.
- **Depends on:** [Server Bootstrap](server-bootstrap.md) for `config/openai.ts`, [Observability](observability.md) for the pino `logger`. Used by [Tools](tools.md).

## Why it is built this way, and trade-offs

- **Postgres + pgvector instead of SQLite** gives a real vector type and distance operator. The cost is a second database to install and a second place state lives.
- **Section-based chunks** suit short, well-structured documents and would need rethinking for long unstructured ones.
- **Exact scan, no index** is right at 49 rows and is called out as something to revisit in the tens of thousands.
- **Policy text is open to every role.** The tool has no role check, by design: these are company-wide rules.
- **Ingestion is manual.** Editing a policy file changes nothing until someone runs the script. Nothing warns that the database is stale.
- **Full re-embed on every run** is simple and cheap at this size.

## Source files covered

- `server/src/knowledge/chunker.ts`
- `server/src/knowledge/embedder.ts`
- `server/src/knowledge/ingest.ts`
- `server/src/db/vectorDb.ts`
- `server/src/db/knowledgeSchema.ts`
- `server/src/services/knowledgeRetrieval.service.ts`
- `data/policies/code-of-conduct.md`
- `data/policies/expense-reimbursement-policy.md`
- `data/policies/leave-policy.md`
- `data/policies/work-from-home-policy.md`
