import { sessionStore } from "./session.store.js";
import type { ConversationMessage } from "./types.js";

// Cap on how many past messages get replayed into the model per turn.
const RECENT_HISTORY_LIMIT = 20;

export class ConversationService {
  getHistory(sessionId: string): ConversationMessage[] {
    return sessionStore.get(sessionId);
  }

  // Capped slice for the LLM; getHistory() stays available for anything that
  // genuinely needs the full transcript.
  getRecentHistory(sessionId: string): ConversationMessage[] {
    return sessionStore.getRecent(sessionId, RECENT_HISTORY_LIMIT);
  }

  getSessionOwner(sessionId: string): string | undefined {
    return sessionStore.getSessionOwner(sessionId);
  }

  addUserMessage(sessionId: string, userId: string, content: string) {
    sessionStore.append(sessionId, userId, {
      role: "user",
      content,
      timestamp: new Date(),
    });
  }

  addAssistantMessage(sessionId: string, userId: string, content: string) {
    sessionStore.append(sessionId, userId, {
      role: "assistant",
      content,
      timestamp: new Date(),
    });
  }

  clearConversation(sessionId: string) {
    sessionStore.clear(sessionId);
  }
}

export const conversationService = new ConversationService();
