import { useState } from "react";
import { CircleAlert, Inbox, RefreshCw } from "lucide-react";
import { ApprovalsTable } from "@/components/approvals/approvals-table";
import { RejectDialog } from "@/components/approvals/reject-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApprovals } from "@/hooks/use-approvals";
import type { ApprovalSummary } from "@/types/api";

export function ApprovalsPage() {
  const { approvals, loading, error, deciding, decide, refresh } = useApprovals();
  const [rejecting, setRejecting] = useState<ApprovalSummary | null>(null);

  return (
    <div className="flex flex-col gap-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Sensitive tool calls paused until a manager or admin signs off.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCw />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pending requests</CardTitle>
          <CardDescription>
            {loading ? "Loading…" : `${approvals.length} awaiting a decision`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : approvals.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <Inbox className="size-8" />
              <p className="text-sm">Nothing pending — you're all caught up.</p>
            </div>
          ) : (
            <ApprovalsTable
              approvals={approvals}
              deciding={deciding}
              onApprove={(a) => void decide(a, true)}
              onReject={setRejecting}
            />
          )}
        </CardContent>
      </Card>

      <RejectDialog
        approval={rejecting}
        onCancel={() => setRejecting(null)}
        onConfirm={(approval, reason) => {
          setRejecting(null);
          void decide(approval, false, reason || undefined);
        }}
      />
    </div>
  );
}
