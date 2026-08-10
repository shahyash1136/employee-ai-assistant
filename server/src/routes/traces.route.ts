import { Router } from "express";
import { listTraces, getTrace } from "../controllers/traces.controller.js";

const router = Router();

/**
 * @openapi
 * /traces:
 *   get:
 *     summary: List recent agent-run traces
 *     description: >
 *       Backed by a capped, in-memory store (last 200 traces) — data does not
 *       survive a server restart.
 *     tags: [Traces]
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         schema: { type: string }
 *         description: Filter to traces from one chat session
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *         description: Max traces to return, most recent first
 *     responses:
 *       200:
 *         description: List of trace summaries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/TraceSummary' }
 */
router.get("/", listTraces);

/**
 * @openapi
 * /traces/{traceId}:
 *   get:
 *     summary: Get full span detail for one trace
 *     tags: [Traces]
 *     parameters:
 *       - in: path
 *         name: traceId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The trace, including every span
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/TraceRecord' }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:traceId", getTrace);

export default router;
