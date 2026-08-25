import { Router } from "express";
import {
  getPerformance,
  getPerformanceByEmployee,
  getTopPerformers,
} from "../controllers/performance.controller.js";
import {
  requireRole,
  requireOwnRecordOrRole,
} from "../middleware/authorize.js";

const router = Router();

/**
 * @openapi
 * /performance:
 *   get:
 *     summary: List all performance records
 *     tags: [Performance]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of performance records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Performance' }
 *       403:
 *         description: Requires manager or admin role
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", requireRole(["manager", "admin"]), getPerformance);

/**
 * @openapi
 * /performance/top:
 *   get:
 *     summary: List top performers
 *     tags: [Performance]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: rating
 *         schema: { type: number, example: 4.5 }
 *         description: Minimum rating threshold (omit for the service's default)
 *     responses:
 *       200:
 *         description: Top performers meeting the rating threshold
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Performance' }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         description: Requires manager or admin role
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/top", requireRole(["manager", "admin"]), getTopPerformers); // GET /performance/top?rating=4.5

/**
 * @openapi
 * /performance/employee/{employeeId}:
 *   get:
 *     summary: List performance records for one employee
 *     description: >
 *       An 'employee' role may only request their own employeeId; manager
 *       and admin roles can request any employeeId.
 *     tags: [Performance]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema: { type: string, example: E001 }
 *     responses:
 *       200:
 *         description: Performance records for the employee
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Performance' }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         description: Employees may only view their own performance records
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  "/employee/:employeeId",
  requireOwnRecordOrRole(["manager", "admin"]),
  getPerformanceByEmployee,
); // GET /performance/employee/E001

export default router;
