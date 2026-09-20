import { Hourglass } from "lucide-react";
import { ToolArguments } from "@/components/tool-arguments";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { humanizeToolName } from "@/lib/format";
import type { WaitingApproval } from "@/types/chat";

// Shown INSTEAD of an assistant reply when the server pauses a tool call for a
// manager/admin. It is not a normal message and never enters the transcript.
export function ApprovalNotice({ approval }: { approval: WaitingApproval }) {
  return (
    <Alert className="mx-auto max-w-xl">
      <Hourglass />
      <AlertTitle className="flex flex-wrap items-center gap-2">
        Waiting for approval
        <Badge variant="secondary">{humanizeToolName(approval.toolName)}</Badge>
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>
          A manager or admin needs to approve this action before{" "}
          {approval.agentName} can continue. This page updates automatically.
        </span>
        <ToolArguments value={approval.toolArguments} />
      </AlertDescription>
    </Alert>
  );
}
