// Session ids are chosen by the client, and the first user to write to an id
// owns it. Requiring an unguessable UUID means nobody can pre-claim a
// predictable id (like "session-1") and lock someone else out of it.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidSessionId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export const INVALID_SESSION_ID_MESSAGE = "sessionId must be a valid UUID";
