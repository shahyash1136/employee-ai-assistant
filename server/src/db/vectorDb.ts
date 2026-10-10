import { Pool } from "pg";
import { logger } from "../logging/logger.js";

// Postgres + pgvector store for knowledge/RAG data (schema: knowledge). Kept
// separate from database.ts, which is node:sqlite for operational data.

let pool: Pool | undefined;

// Lazy on purpose. dotenv is loaded in server.ts, but the ingestion script is a
// second entry point. A module-level `new Pool({ connectionString: process.env... })`
// reads the env at import time; if dotenv hasn't run yet, pg silently falls back
// to its own defaults (OS user, default db) instead of failing.
export function getVectorPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Expected e.g. postgresql://user@localhost:5432/employee_ai_assistant",
    );
  }

  // Without a connection timeout, pg waits forever on a host that accepts the
  // connection but never answers, and the chat request hangs with it.
  pool = new Pool({ connectionString, connectionTimeoutMillis: 5_000 });

  // An error on an idle client is emitted on the pool; with no listener Node
  // treats it as unhandled and takes the whole process down.
  // Log only the message and code. pino's `err` serializer would also dump the
  // pg client object attached to the error, connection parameters included
  // (and the password, if DATABASE_URL has one).
  pool.on("error", (err) => {
    logger.error(
      { message: err.message, code: (err as { code?: string }).code },
      "vector_db_idle_client_error",
    );
  });

  return pool;
}

// Scripts must call this when done: an open pool keeps the event loop alive, so
// the process would finish its work and then hang.
export async function closeVectorDb(): Promise<void> {
  if (!pool) return;
  const closing = pool;
  pool = undefined;
  await closing.end();
}
