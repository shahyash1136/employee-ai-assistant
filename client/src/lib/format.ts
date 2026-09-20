import type { ChatSessionSummary } from "@/types/api";

// Turns snake_case tool names like "update_salary" into "Update salary".
export function humanizeToolName(name: string): string {
  const spaced = name.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function parseToolArguments(
  raw: string | null,
): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* fall through: show raw text */
  }
  return null;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export interface SessionGroup {
  label: string;
  sessions: ChatSessionSummary[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Buckets conversations the way ChatGPT/Claude do. Input is already newest
// first, so each bucket stays in order.
export function groupSessionsByDate(
  sessions: ChatSessionSummary[],
  now: Date = new Date(),
): SessionGroup[] {
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const buckets: SessionGroup[] = [
    { label: "Today", sessions: [] },
    { label: "Yesterday", sessions: [] },
    { label: "Previous 7 days", sessions: [] },
    { label: "Older", sessions: [] },
  ];

  for (const session of sessions) {
    const updated = new Date(session.updatedAt).getTime();
    if (updated >= startOfToday) buckets[0].sessions.push(session);
    else if (updated >= startOfToday - DAY_MS) buckets[1].sessions.push(session);
    else if (updated >= startOfToday - 7 * DAY_MS) buckets[2].sessions.push(session);
    else buckets[3].sessions.push(session);
  }
  return buckets.filter((bucket) => bucket.sessions.length > 0);
}
