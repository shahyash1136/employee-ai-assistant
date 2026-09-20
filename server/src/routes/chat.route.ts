import { Router } from "express";
import {
  chatController,
  getSessionMessages,
  getSessionApprovals,
  listSessions,
  deleteSession,
} from "../controllers/chat.controller.js";
import { chatLimiter } from "../middleware/rateLimiters.js";

const router = Router();

/**
 * @openapi
 * /chat:
 *   post:
 *     summary: Send a message to the employee AI assistant
 *     description: >
 *       Runs the orchestrator agent to completion, guardrail-checks the output,
 *       then responds. With no `format` (or `format: "text"`), the fully-generated
 *       response is replayed to the client as a simulated SSE token stream
 *       (`text/event-stream`, lines like `data: {"token":"..."}`, ending with
 *       `data: [DONE]`). With `format: "json"`, one buffered structured JSON
 *       response is returned instead. Limited to 10 requests per minute per user.
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ChatRequest' }
 *     responses:
 *       200:
 *         description: >
 *           An SSE token stream (default) or a structured JSON response
 *           (format=json). A guardrail tripwire also returns 200 with a
 *           decline message rather than an error.
 *         content:
 *           text/event-stream:
 *             schema: { type: string }
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 response: { $ref: '#/components/schemas/StructuredResponse' }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *       502:
 *         description: The assistant failed to produce a usable response
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post("/", chatLimiter, chatController);

/**
 * @openapi
 * /chat/{sessionId}/messages:
 *   get:
 *     summary: Get the transcript of one of your own chat sessions
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Messages in chronological order
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       role: { type: string, enum: [user, assistant] }
 *                       content: { type: string }
 *                       timestamp: { type: string, format: date-time }
 *       403:
 *         description: The session belongs to another user
 *       404:
 *         description: Unknown session
 */
router.get("/:sessionId/messages", getSessionMessages);

/**
 * @openapi
 * /chat/{sessionId}/approvals:
 *   get:
 *     summary: List approvals raised in one of your own chat sessions
 *     description: >
 *       Unlike GET /approvals this needs no manager/admin role, but only
 *       returns approvals from a session the caller owns.
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Approval summaries, newest first
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ApprovalSummary' }
 *       403:
 *         description: The session belongs to another user
 *       404:
 *         description: Unknown session
 */
router.get("/:sessionId/approvals", getSessionApprovals);


/**
 * @openapi
 * /chat/sessions:
 *   get:
 *     summary: List your own chat sessions, newest activity first
 *     description: >
 *       Each session's title is its first user message. Returns at most 100.
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Session summaries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       sessionId: { type: string }
 *                       title: { type: string }
 *                       createdAt: { type: string, format: date-time }
 *                       updatedAt: { type: string, format: date-time }
 */
router.get("/sessions", listSessions);

/**
 * @openapi
 * /chat/{sessionId}:
 *   delete:
 *     summary: Delete one of your own chat sessions and its messages
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted
 *       403:
 *         description: The session belongs to another user
 *       404:
 *         description: Unknown session
 *       409:
 *         description: The session has an approval still pending
 */
router.delete("/:sessionId", deleteSession);

export default router;
