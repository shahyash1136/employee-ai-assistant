import { Router } from "express";
import { chatController } from "../controllers/chat.controller.js";

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
 *       response is returned instead.
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
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *       502:
 *         description: The assistant failed to produce a usable response
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post("/", chatController);

export default router;
