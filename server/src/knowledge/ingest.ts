// Usage (from server/):
//   npm run ingest:policies              chunk -> embed -> write to Postgres
//   npm run ingest:policies -- --dry-run chunk only; print boundaries, no API/DB
//
// Separate entry point from server.ts, so it loads dotenv itself. This import
// must stay first: config/openai.ts reads OPENAI_API_KEY at import time.
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeVectorDb, getVectorPool } from "../db/vectorDb.js";
import { EMBEDDING_MODEL, initKnowledgeSchema } from "../db/knowledgeSchema.js";
import { chunkPolicyDocument, type Chunk } from "./chunker.js";
import { embedTexts } from "./embedder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/src/knowledge -> repo root, same anchoring as db/database.ts.
const policiesDir = path.resolve(__dirname, "../../../data/policies");

async function loadChunks(): Promise<{ sources: string[]; chunks: Chunk[] }> {
  const sources = (await fs.readdir(policiesDir)).filter((f) => f.endsWith(".md")).sort();
  if (sources.length === 0) throw new Error(`No .md files found in ${policiesDir}`);

  const chunks: Chunk[] = [];
  for (const source of sources) {
    const raw = await fs.readFile(path.join(policiesDir, source), "utf8");
    const docChunks = chunkPolicyDocument(raw, source);
    if (docChunks.length === 0) throw new Error(`${source}: produced no chunks`);
    chunks.push(...docChunks);
  }
  return { sources, chunks };
}

function printChunks(chunks: Chunk[]): void {
  for (const c of chunks) {
    const sections = (c.metadata.sections as string[]).join(" | ");
    console.log(`${c.source} #${c.chunkIndex}  ~${c.metadata.approx_tokens} tok  ${sections}`);
  }
  console.log(`\n${chunks.length} chunks`);
}

async function main(): Promise<void> {
  const { sources, chunks } = await loadChunks();

  if (process.argv.includes("--dry-run")) {
    printChunks(chunks);
    return;
  }

  // Embed everything before touching the DB: an API failure then leaves the
  // existing data untouched, and no transaction is held open across network calls.
  const vectors = await embedTexts(chunks.map((c) => c.content));

  await initKnowledgeSchema();
  const client = await getVectorPool().connect();
  try {
    // One transaction for the whole sync so the table is never half-updated.
    await client.query("BEGIN");

    // Documents that no longer exist on disk must not keep answering questions.
    const stale = await client.query("DELETE FROM knowledge.chunks WHERE source <> ALL($1::text[])", [sources]);

    // Replace per source: upsert alone would leave stale rows when a document
    // shrinks (10 chunks -> 8).
    for (const source of sources) {
      await client.query("DELETE FROM knowledge.chunks WHERE source = $1", [source]);
    }
    for (const [i, chunk] of chunks.entries()) {
      await client.query(
        `INSERT INTO knowledge.chunks (source, chunk_index, content, embedding, embedding_model, metadata)
         VALUES ($1, $2, $3, $4::vector, $5, $6::jsonb)`,
        [
          chunk.source,
          chunk.chunkIndex,
          chunk.content,
          `[${vectors[i]!.join(",")}]`,
          EMBEDDING_MODEL,
          JSON.stringify(chunk.metadata),
        ],
      );
    }
    await client.query("COMMIT");
    console.log(`Ingested ${chunks.length} chunks from ${sources.length} documents (removed ${stale.rowCount} stale rows).`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeVectorDb);
