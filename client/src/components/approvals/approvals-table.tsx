import { Check, Loader2, X } from "lucide-react";
import { ToolArguments } from "@/components/tool-arguments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, humanizeToolName } from "@/lib/format";
import type { ApprovalSummary } from "@/types/api";

interface ApprovalsTableProps {
  approvals: ApprovalSummary[];
  deciding: ReadonlySet<string>;
  onApprove: (approval: ApprovalSummary) => void;
  onReject: (approval: ApprovalSummary) => void;
}

export function ApprovalsTable({
  approvals,
  deciding,
  onApprove,
  onReject,
}: ApprovalsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tool</TableHead>
          <TableHead>Agent</TableHead>
          <TableHead>Arguments</TableHead>
          <TableHead>Requested</TableHead>
          <TableHead className="text-right">Decision</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {approvals.map((approval) => {
          const busy = deciding.has(approval.approvalId);
          return (
            <TableRow key={approval.approvalId}>
              <TableCell className="font-medium">
                {humanizeToolName(approval.toolName)}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{approval.agentName}</Badge>
              </TableCell>
              <TableCell className="max-w-xs whitespace-normal">
                <ToolArguments value={approval.toolArguments} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatDateTime(approval.createdAt)}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button size="sm" disabled={busy} onClick={() => onApprove(approval)}>
                    {busy ? <Loader2 className="animate-spin" /> : <Check />}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => onReject(approval)}
                  >
                    <X />
                    Reject
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
