import { Router } from "express";
import {
  getPerformance,
  getPerformanceByEmployee,
  getTopPerformers,
} from "../controllers/performance.controller.js";

const router = Router();

/**
 * @openapi
 * /performance:
 *   get:
 *     summary: List all performance records
 *     tags: [Performance]
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
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", getPerformance);

/**
 * @openapi
 * /performance/top:
 *   get:
 *     summary: List top performers
 *     tags: [Performance]
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
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/top", getTopPerformers); // GET /performance/top?rating=4.5

/**
 * @openapi
 * /performance/employee/{employeeId}:
 *   get:
 *     summary: List performance records for one employee
 *     tags: [Performance]
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
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/employee/:employeeId", getPerformanceByEmployee); // GET /performance/employee/E001

export default router;
