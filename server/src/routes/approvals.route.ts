// server/src/routes/approvals.route.ts
import { Router } from "express";
import {
  listApprovals,
  decideApproval,
} from "../controllers/approvals.controller.js";

const router = Router();

/**
 * @openapi
 * /approvals:
 *   get:
 *     summary: List pending/resolved tool-call approvals
 *     description: >
 *       Backed by a capped, in-memory store (last 200 approvals) — data does
 *       not survive a server restart.
 *     tags: [Approvals]
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         schema: { type: string }
 *         description: Filter to approvals from one chat session
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, approved, rejected] }
 *     responses:
 *       200:
 *         description: List of approval summaries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ApprovalSummary' }
 */
router.get("/", listApprovals);

/**
 * @openapi
 * /approvals/{approvalId}/decision:
 *   post:
 *     summary: Approve or reject a paused tool call and resume the run
 *     tags: [Approvals]
 *     parameters:
 *       - in: path
 *         name: approvalId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [approve]
 *             properties:
 *               approve: { type: boolean }
 *               message:
 *                 type: string
 *                 description: Optional rejection reason shown to the model
 *     responses:
 *       200:
 *         description: The resumed run's final response (or a second approval request)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 response:
 *                   type: object
 *                   additionalProperties: true
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: This approval was already resolved
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post("/:approvalId/decision", decideApproval);

export default router;
