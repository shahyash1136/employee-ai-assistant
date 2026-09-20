import { db } from "../db/database.js";
import type { ConversationMessage, ConversationRole } from "./types.js";

interface MessageRow {
  role: string;
  content: string;
  timestamp: string;
}

const upsertSession = db.prepare(
  `INSERT INTO sessions (session_id, user_id, created_at)
   VALUES (?, ?, ?)
   ON CONFLICT(session_id) DO NOTHING`,
);

const insertMessage = db.prepare(
  `INSERT INTO messages (session_id, user_id, role, content, timestamp)
   VALUES (?, ?, ?, ?, ?)`,
);

const selectAll = db.prepare(
  `SELECT role, content, timestamp FROM messages
   WHERE session_id = ? ORDER BY id ASC`,
);

const selectRecent = db.prepare(
  `SELECT role, content, timestamp FROM messages
   WHERE session_id = ? ORDER BY id DESC LIMIT ?`,
);

const selectOwner = db.prepare(
  `SELECT user_id FROM sessions WHERE session_id = ?`,
);

// One row per session the user owns, newest activity first. The first user
// message doubles as the conversation title. Sessions are only created by a
// message insert, so every row has at least one message.
const selectForUser = db.prepare(
  `SELECT s.session_id AS session_id,
          s.created_at AS created_at,
          (SELECT content FROM messages m
             WHERE m.session_id = s.session_id AND m.role = 'user'
             ORDER BY m.id ASC LIMIT 1) AS first_message,
          (SELECT MAX(timestamp) FROM messages m
             WHERE m.session_id = s.session_id) AS updated_at
   FROM sessions s
   WHERE s.user_id = ?
   ORDER BY updated_at DESC
   LIMIT ?`,
);

const deleteMessages = db.prepare(`DELETE FROM messages WHERE session_id = ?`);
const deleteSession = db.prepare(`DELETE FROM sessions WHERE session_id = ?`);

function toMessage(row: MessageRow): ConversationMessage {
  return {
    role: row.role as ConversationRole,
    content: row.content,
    timestamp: new Date(row.timestamp),
  };
}

interface SessionRow {
  session_id: string;
  created_at: string;
  first_message: string | null;
  updated_at: string | null;
}

export interface SessionSummary {
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

const TITLE_MAX_LENGTH = 60;

function toTitle(firstMessage: string | null): string {
  const collapsed = (firstMessage ?? "").replace(/\s+/g, " ").trim();
  if (!collapsed) return "New conversation";
  return collapsed.length > TITLE_MAX_LENGTH
    ? `${collapsed.slice(0, TITLE_MAX_LENGTH - 1)}…`
    : collapsed;
}

export class SessionStore {
  // Appends one message, creating the owning session row on first write.
  // Replaces the old read-modify-write save(): SQLite makes single-row inserts
  // the natural unit.
  append(sessionId: string, userId: string, message: ConversationMessage) {
    upsertSession.run(sessionId, userId, new Date().toISOString());
    insertMessage.run(
      sessionId,
      userId,
      message.role,
      message.content,
      message.timestamp.toISOString(),
    );
  }

  get(sessionId: string): ConversationMessage[] {
    return (selectAll.all(sessionId) as unknown as MessageRow[]).map(toMessage);
  }

  // Last `limit` messages, returned in chronological order — what the LLM
  // gets so its context window doesn't grow unbounded with the session.
  getRecent(sessionId: string, limit: number): ConversationMessage[] {
    const rows = selectRecent.all(sessionId, limit) as unknown as MessageRow[];
    return rows.reverse().map(toMessage);
  }

  // Who started this session. chat.controller uses this to refuse turns from
  // any user other than the one who first wrote to the sessionId.
  getSessionOwner(sessionId: string): string | undefined {
    const row = selectOwner.get(sessionId) as { user_id: string } | undefined;
    return row?.user_id;
  }

  listForUser(userId: string, limit: number): SessionSummary[] {
    const rows = selectForUser.all(userId, limit) as unknown as SessionRow[];
    return rows.map((row) => ({
      sessionId: row.session_id,
      title: toTitle(row.first_message),
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? row.created_at,
    }));
  }

  clear(sessionId: string) {
    deleteMessages.run(sessionId);
    deleteSession.run(sessionId);
  }
}

export const sessionStore = new SessionStore();
