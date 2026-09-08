import { Router } from "express";
import { getMetrics } from "../controllers/metrics.controller.js";
import { requireRole } from "../middleware/authorize.js";

const router = Router();

/**
 * @openapi
 * /metrics:
 *   get:
 *     summary: Aggregate operational metrics computed from request logs
 *     tags: [Metrics]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Aggregate metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Metrics' }
 *       403:
 *         description: Requires manager or admin role
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get("/", requireRole(["manager", "admin"]), getMetrics);

export default router;
