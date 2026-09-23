import { getVectorPool } from "./vectorDb.js";

// text-embedding-3-small. Vectors from different models aren't comparable, so
// every row also records which model produced it (embedding_model) — switching
// models later then fails loudly instead of returning quietly-wrong neighbours.
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

// Idempotent, called explicitly by the ingestion script — NOT on import like
// database.ts does. pg is async, and the API server shouldn't create tables as
// a side effect of loading a module.
//
// No index on `embedding` on purpose: at ~50 chunks a sequential scan is faster
// than HNSW/IVFFlat and returns exact results. Add one when the corpus is in the
// tens of thousands of rows.
export async function initKnowledgeSchema(): Promise<void> {
  await getVectorPool().query(`
    CREATE EXTENSION IF NOT EXISTS vector;
    CREATE SCHEMA IF NOT EXISTS knowledge;

    CREATE TABLE IF NOT EXISTS knowledge.chunks (
      id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      source          TEXT NOT NULL,
      chunk_index     INTEGER NOT NULL,
      content         TEXT NOT NULL,
      embedding       vector(${EMBEDDING_DIMENSIONS}) NOT NULL,
      embedding_model TEXT NOT NULL,
      metadata        JSONB NOT NULL DEFAULT '{}',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      -- Also serves as the index for "delete all chunks of a source".
      UNIQUE (source, chunk_index)
    );
  `);
}
