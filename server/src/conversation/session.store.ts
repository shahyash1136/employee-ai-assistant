import type { ConversationMessage } from "./types.js";

export class SessionStore {
  private conversations = new Map<string, ConversationMessage[]>();

  get(sessionId: string): ConversationMessage[] {
    return this.conversations.get(sessionId) ?? [];
  }

  save(sessionId: string, messages: ConversationMessage[]) {
    this.conversations.set(sessionId, messages);
  }

  clear(sessionId: string) {
    this.conversations.delete(sessionId);
  }
}

export const sessionStore = new SessionStore();
