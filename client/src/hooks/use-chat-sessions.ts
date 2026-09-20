import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ChatSessionSummary } from "@/types/api";

// The user's saved conversations, for the history sidebar.
export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumping this re-runs the fetch below.
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const { data } = await api.chat.sessions(controller.signal);
        setSessions(data);
        setError(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load chats.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [reloadKey]);

  // Throws on failure (e.g. 409 while an approval is pending) so the caller can
  // show the server's message; the list is only touched on success.
  const remove = useCallback(async (sessionId: string) => {
    await api.chat.deleteSession(sessionId);
    setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
  }, []);

  return { sessions, loading, error, refresh, remove };
}
