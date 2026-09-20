import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { humanizeToolName } from "@/lib/format";
import type { ApprovalSummary } from "@/types/api";

const REFRESH_INTERVAL_MS = 15000;

export function useApprovals() {
  const [approvals, setApprovals] = useState<ApprovalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Ids with a decision in flight. Resuming the agent run can take a while, so
  // each row shows its own busy state and can't be double-submitted.
  const [deciding, setDeciding] = useState<ReadonlySet<string>>(new Set());

  // Bumping this re-runs the fetch effect below (manual refresh, or resync
  // after a stale-row conflict).
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const { data } = await api.approvals.list("pending", controller.signal);
        setApprovals(data);
        setError(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error ? err.message : "Failed to load approvals.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void load();
    // New requests arrive from other users' chats, so keep the list fresh.
    const timer = setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [reloadKey]);

  const decide = useCallback(
    async (approval: ApprovalSummary, approve: boolean, reason?: string) => {
      const label = humanizeToolName(approval.toolName);
      setDeciding((prev) => new Set(prev).add(approval.approvalId));
      try {
        const result = await api.approvals.decide(
          approval.approvalId,
          approve,
          reason,
        );
        // Decided server-side: drop the row now instead of waiting for a poll.
        setApprovals((prev) =>
          prev.filter((a) => a.approvalId !== approval.approvalId),
        );
        toast.success(approve ? `Approved: ${label}` : `Rejected: ${label}`);
        if ("requiresApproval" in result) {
          toast.info("The resumed request needs another approval.");
          refresh();
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to record the decision.",
        );
        // 404/409 mean someone else already resolved it (or it's gone) — the
        // list is stale, so resync rather than leave a dead row.
        if (err instanceof ApiError && (err.status === 404 || err.status === 409)) {
          refresh();
        }
      } finally {
        setDeciding((prev) => {
          const next = new Set(prev);
          next.delete(approval.approvalId);
          return next;
        });
      }
    },
    [refresh],
  );

  return {
    approvals,
    loading,
    error,
    deciding,
    decide,
    refresh,
  };
}
