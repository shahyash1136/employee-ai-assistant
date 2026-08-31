// server/src/controllers/approvals.controller.ts
import type { Request, Response } from "express";
import { approvalStore } from "../approvals/approvalStore.js";
import { resumeEmployeeAgent } from "../orchestrator/runner.js";
import { conversationService } from "../conversation/conversation.service.js";

export const listApprovals = async (req: Request, res: Response) => {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  const status =
    typeof req.query.status === "string" &&
    ["pending", "approved", "rejected"].includes(req.query.status)
      ? (req.query.status as "pending" | "approved" | "rejected")
      : undefined;

  const approvals = approvalStore.list({ sessionId, status });
  res.json({ success: true, data: approvals });
};

export const decideApproval = async (req: Request, res: Response) => {
  const approvalId = req.params.approvalId as string;
  const { approve, message } = req.body;

  if (typeof approve !== "boolean") {
    return res
      .status(400)
      .json({ success: false, message: "approve must be a boolean" });
  }

  const existing = approvalStore.get(approvalId);
  if (!existing) {
    return res
      .status(404)
      .json({ success: false, message: "Approval not found" });
  }

  // No session-ownership check here on purpose: the whole point of HITL is
  // that a *different* person (a manager/admin) signs off on an employee's
  // paused action. Access is gated by requireRole(["manager","admin"]) on the
  // route — that's the correct and sufficient rule for deciding approvals.
  if (existing.status !== "pending") {
    return res.status(409).json({
      success: false,
      message: `This approval was already ${existing.status}`,
    });
  }

  const outcome = await resumeEmployeeAgent(approvalId, { approve, message });

  if (outcome.status === "not_found") {
    return res
      .status(404)
      .json({ success: false, message: "Approval not found" });
  }

  if (outcome.status === "needs_approval") {
    // Resuming triggered a second sensitive tool call — pause again.
    return res.json({
      success: true,
      requiresApproval: true,
      approvalId: outcome.approvalId,
      message: `Another approval is required. (approvalId: ${outcome.approvalId})`,
      pendingTool: outcome.pendingTool,
    });
  }

  const responseText =
    typeof outcome.output === "string"
      ? outcome.output
      : JSON.stringify(outcome.output);
  // The resumed turn's reply belongs to the same session; attribute it to
  // whoever owns that session (the deciding manager is not that person).
  const ownerId = conversationService.getSessionOwner(existing.sessionId);
  if (ownerId) {
    conversationService.addAssistantMessage(
      existing.sessionId,
      ownerId,
      responseText,
    );
  }

  res.json({ success: true, response: outcome.output });
};
