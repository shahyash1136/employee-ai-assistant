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

const deleteMessages = db.prepare(`DELETE FROM messages WHERE session_id = ?`);
const deleteSession = db.prepare(`DELETE FROM sessions WHERE session_id = ?`);

function toMessage(row: MessageRow): ConversationMessage {
  return {
    role: row.role as ConversationRole,
    content: row.content,
    timestamp: new Date(row.timestamp),
  };
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

  clear(sessionId: string) {
    deleteMessages.run(sessionId);
    deleteSession.run(sessionId);
  }
}

export const sessionStore = new SessionStore();
