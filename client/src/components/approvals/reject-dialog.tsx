import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { humanizeToolName } from "@/lib/format";
import type { ApprovalSummary } from "@/types/api";

interface RejectDialogProps {
  approval: ApprovalSummary | null;
  onCancel: () => void;
  onConfirm: (approval: ApprovalSummary, reason: string) => void;
}

export function RejectDialog({ approval, onCancel, onConfirm }: RejectDialogProps) {
  return (
    <Dialog open={approval !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        {/* Remounted per approval so the reason field starts empty each time. */}
        {approval && (
          <RejectForm
            key={approval.approvalId}
            approval={approval}
            onCancel={onCancel}
            onConfirm={onConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RejectForm({
  approval,
  onCancel,
  onConfirm,
}: RejectDialogProps & { approval: ApprovalSummary }) {
  const [reason, setReason] = useState("");

  return (
    <>
      <DialogHeader>
        <DialogTitle>Reject request</DialogTitle>
        <DialogDescription>
          {humanizeToolName(approval.toolName)} will not run. Optionally tell the
          assistant why.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reject-reason">Reason (optional)</Label>
        <Textarea
          id="reject-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={() => onConfirm(approval, reason.trim())}
        >
          Reject
        </Button>
      </DialogFooter>
    </>
  );
}
