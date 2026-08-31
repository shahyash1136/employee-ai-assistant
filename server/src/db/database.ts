import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// server/src/db -> repo root. Same anchoring trick csv.service.ts uses so the
// db lives next to the seed CSVs in data/.
const repoRoot = path.resolve(__dirname, "../../../");
const dbPath = path.join(repoRoot, "data", "app.db");

export const db = new DatabaseSync(dbPath);

// WAL keeps readers (GET /traces, GET /approvals) from blocking the writer
// mid-chat. The -wal / -shm sidecar files are runtime-only and gitignored.
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    role       TEXT NOT NULL,
    content    TEXT NOT NULL,
    timestamp  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_session ON messages (session_id, id);

  CREATE TABLE IF NOT EXISTS traces (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_id   TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    session_id TEXT,
    started_at TEXT NOT NULL,
    ended_at   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_traces_session ON traces (session_id);

  CREATE TABLE IF NOT EXISTS spans (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    span_id    TEXT NOT NULL,
    trace_id   TEXT NOT NULL,
    span_type  TEXT NOT NULL,
    started_at TEXT,
    ended_at   TEXT,
    error      TEXT,
    extra      TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX IF NOT EXISTS idx_spans_trace ON spans (trace_id, id);

  CREATE TABLE IF NOT EXISTS approvals (
    approval_id      TEXT PRIMARY KEY,
    session_id       TEXT NOT NULL,
    tool_name        TEXT NOT NULL,
    tool_arguments   TEXT,
    agent_name       TEXT NOT NULL,
    serialized_state TEXT NOT NULL,
    format           TEXT NOT NULL,
    status           TEXT NOT NULL,
    created_at       TEXT NOT NULL,
    resolved_at      TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_approvals_session ON approvals (session_id);
`);
