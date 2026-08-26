import { Router } from "express";
import {
  getSalaries,
  getHighestSalary,
  getAverageSalary,
  getEmployeesBySalaryRange,
  getSalaryByEmployee,
} from "../controllers/salaries.controller.js";
import {
  requireRole,
  requireOwnRecordOrRole,
} from "../middleware/authorize.js";

const router = Router();

/**
 * @openapi
 * /salaries:
 *   get:
 *     summary: List all salary records
 *     tags: [Salaries]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of salary records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Salary' }
 *       403:
 *         description: Requires manager or admin role
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", requireRole(["manager", "admin"]), getSalaries);

/**
 * @openapi
 * /salaries/highest:
 *   get:
 *     summary: Get the highest salary record
 *     tags: [Salaries]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: The highest salary record
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Salary' }
 *       403:
 *         description: Requires manager or admin role
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/highest", requireRole(["manager", "admin"]), getHighestSalary); // GET /salaries/highest

/**
 * @openapi
 * /salaries/average:
 *   get:
 *     summary: Get the average CTC across all employees
 *     tags: [Salaries]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Average CTC
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     averageCTC: { type: number }
 *       403:
 *         description: Requires manager or admin role
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/average", requireRole(["manager", "admin"]), getAverageSalary); // GET /salaries/average

/**
 * @openapi
 * /salaries/range:
 *   get:
 *     summary: List employees with CTC within a range
 *     tags: [Salaries]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: min
 *         required: true
 *         schema: { type: number, example: 500000 }
 *       - in: query
 *         name: max
 *         required: true
 *         schema: { type: number, example: 1000000 }
 *     responses:
 *       200:
 *         description: Salary records within the range
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Salary' }
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
router.get(
  "/range",
  requireRole(["manager", "admin"]),
  getEmployeesBySalaryRange,
); // GET /salaries/range?min=500000&max=1000000

/**
 * @openapi
 * /salaries/{employeeId}:
 *   get:
 *     summary: Get a single employee's salary record
 *     description: >
 *       An 'employee' role may only request their own employeeId; manager
 *       and admin roles can request any employeeId.
 *     tags: [Salaries]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema: { type: string, example: E001 }
 *     responses:
 *       200:
 *         description: The salary record
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Salary' }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         description: Employees may only view their own salary record
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  "/:employeeId",
  requireOwnRecordOrRole(["manager", "admin"]),
  getSalaryByEmployee,
); // GET /salaries/E001 — keep LAST

export default router;
