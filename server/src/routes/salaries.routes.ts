import { Router } from "express";
import {
  getSalaries,
  getHighestSalary,
  getAverageSalary,
  getEmployeesBySalaryRange,
  getSalaryByEmployee,
} from "../controllers/salaries.controller.js";

const router = Router();

/**
 * @openapi
 * /salaries:
 *   get:
 *     summary: List all salary records
 *     tags: [Salaries]
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
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", getSalaries);

/**
 * @openapi
 * /salaries/highest:
 *   get:
 *     summary: Get the highest salary record
 *     tags: [Salaries]
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
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/highest", getHighestSalary); // GET /salaries/highest

/**
 * @openapi
 * /salaries/average:
 *   get:
 *     summary: Get the average CTC across all employees
 *     tags: [Salaries]
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
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/average", getAverageSalary); // GET /salaries/average

/**
 * @openapi
 * /salaries/range:
 *   get:
 *     summary: List employees with CTC within a range
 *     tags: [Salaries]
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
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/range", getEmployeesBySalaryRange); // GET /salaries/range?min=500000&max=1000000

/**
 * @openapi
 * /salaries/{employeeId}:
 *   get:
 *     summary: Get a single employee's salary record
 *     tags: [Salaries]
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
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/:employeeId", getSalaryByEmployee); // GET /salaries/E001 — keep LAST

export default router;
