import { Router } from "express";
import { listLogs } from "../controllers/logs.controller.js";
import { requireRole } from "../middleware/authorize.js";

const router = Router();

/**
 * @openapi
 * /logs:
 *   get:
 *     summary: List recent HTTP request logs
 *     description: >
 *       Backed by a capped SQLite store (last 1000 requests). Every request is
 *       logged, including unauthenticated ones — userId is null for those.
 *     tags: [Logs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *         description: Filter to requests made by one user
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *     responses:
 *       200:
 *         description: List of request log entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/RequestLog' }
 *       403:
 *         description: Requires manager or admin role
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get("/", requireRole(["manager", "admin"]), listLogs);

export default router;
