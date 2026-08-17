import { randomUUID } from "node:crypto";
import {
  Runner,
  RunState,
  user,
  assistant,
  withTrace,
  type RunToolApprovalItem,
} from "@openai/agents";
import {
  orchestratorAgent,
  orchestratorAgentStructured,
} from "../agents/orchestrator.agent.js";
import { sensitiveInfoGuardrail } from "../guardrails/sensitiveInfo.guardrail.js";
import { hallucinationGuardrail } from "../guardrails/hallucination.guardrail.js";
import type { ConversationMessage } from "../conversation/types.js";
import {
  approvalStore,
  type ApprovalRecord,
} from "../approvals/approvalStore.js";

function toInput(history: ConversationMessage[]) {
  return history.map((item) =>
    item.role === "assistant" ? assistant(item.content) : user(item.content),
  );
}

const OUTPUT_GUARDRAILS = [sensitiveInfoGuardrail, hallucinationGuardrail];
const runner = new Runner({ outputGuardrails: OUTPUT_GUARDRAILS });

export type RunOutcome<T> =
  | { status: "completed"; output: T }
  | {
      status: "needs_approval";
      approvalId: string;
      pendingTool: {
        name: string;
        arguments: string | undefined;
        agentName: string;
      };
    };

// Persists a pending approval and returns the outcome chat.controller.ts should
// respond with. If a turn somehow produces multiple simultaneous interruptions,
// only the first is surfaced here for display — but the serialized state still
// carries all of them, and they're all resolved together in resume() below via
// getInterruptions().
function recordApproval(
  result: {
    interruptions: RunToolApprovalItem[];
    state: { toString(): string };
  },
  sessionId: string,
  format: "json" | "text",
): RunOutcome<never> {
  const interruption = result.interruptions[0]!;
  const approvalId = randomUUID();

  const record: ApprovalRecord = {
    approvalId,
    sessionId,
    toolName: interruption.name ?? "unknown_tool",
    toolArguments: interruption.arguments,
    agentName: interruption.agent.name,
    serializedState: result.state.toString(),
    format,
    status: "pending",
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
  approvalStore.create(record);

  return {
    status: "needs_approval",
    approvalId,
    pendingTool: {
      name: record.toolName,
      arguments: record.toolArguments,
      agentName: record.agentName,
    },
  };
}

export async function runEmployeeAgentStream(
  history: ConversationMessage[],
  sessionId: string,
): Promise<RunOutcome<string>> {
  const input = toInput(history);
  return withTrace(
    "Employee Agent Stream",
    async (trace) => {
      try {
        const result = await runner.run(orchestratorAgent, input);
        if (result.interruptions.length > 0) {
          return recordApproval(result, sessionId, "text");
        }
        return { status: "completed", output: result.finalOutput ?? "" };
      } finally {
        await trace.end();
      }
    },
    { groupId: sessionId },
  );
}

export async function runEmployeeAgentStructured(
  history: ConversationMessage[],
  sessionId: string,
) {
  const input = toInput(history);
  return withTrace(
    "Employee Agent Structured",
    async (trace) => {
      try {
        const result = await runner.run(orchestratorAgentStructured, input);
        if (result.interruptions.length > 0) {
          return recordApproval(result, sessionId, "json");
        }
        return { status: "completed" as const, output: result.finalOutput };
      } finally {
        await trace.end();
      }
    },
    { groupId: sessionId },
  );
}

export type ResumeOutcome<T> = RunOutcome<T> | { status: "not_found" };

// Resumes a paused run after a human decision. Dispatches to the correct root
// agent variant (structured vs plain) based on what the original request used
// — RunState.fromString() requires the SAME agent that originally started the
// run, since it resolves the whole handoff graph's identifiers against it.
export async function resumeEmployeeAgent(
  approvalId: string,
  decision: { approve: boolean; message?: string },
): Promise<ResumeOutcome<unknown>> {
  const record = approvalStore.get(approvalId);
  if (!record || record.status !== "pending") {
    return { status: "not_found" };
  }

  // The type parameter differs per agent variant (plain string output vs a
  // Zod-typed structured output) so this cast is the one place we bridge that
  // — safe here because `format` is exactly what recordApproval() stored based
  // on which variant actually started this run.
  const rootAgent =
    record.format === "json" ? orchestratorAgentStructured : orchestratorAgent;
  const state = await RunState.fromString(
    rootAgent as any,
    record.serializedState,
  );

  // The restored state still references the ORIGINAL trace — which we already
  // closed via trace.end() in the finally block when the run first paused.
  // clearTrace() detaches it, confirmed straight from the SDK's own type
  // declarations: "Use this before resuming a serialized state when the
  // resumed run should attach to the current ambient trace instead of the
  // trace persisted in the state." Without this, the resumed run would try to
  // add spans to a trace that's already ended.
  state.clearTrace();

  for (const interruption of state.getInterruptions()) {
    if (decision.approve) {
      state.approve(interruption);
    } else {
      state.reject(
        interruption,
        decision.message ? { message: decision.message } : {},
      );
    }
  }

  approvalStore.resolve(
    approvalId,
    decision.approve ? "approved" : "rejected",
    new Date().toISOString(),
  );

  const traceName =
    record.format === "json"
      ? "Employee Agent Structured (resumed)"
      : "Employee Agent Stream (resumed)";

  return withTrace(
    traceName,
    async (trace) => {
      try {
        const result = await runner.run(rootAgent as any, state as any);
        if (result.interruptions.length > 0) {
          // A second sensitive tool got requested after resuming — pause again.
          return recordApproval(result, record.sessionId, record.format);
        }
        return { status: "completed" as const, output: result.finalOutput };
      } finally {
        await trace.end();
      }
    },
    { groupId: record.sessionId },
  );
}
