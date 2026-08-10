import { Router } from "express";
import {
  getAllEmployees,
  getEmployeeById,
  getEmployeeByName,
  getEmployeesByDepartment,
} from "../controllers/employee.controller.js";

const router = Router();

/**
 * @openapi
 * /employees:
 *   get:
 *     summary: List all employees
 *     tags: [Employees]
 *     responses:
 *       200:
 *         description: List of employees
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Employee' }
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", getAllEmployees);

/**
 * @openapi
 * /employees/search:
 *   get:
 *     summary: Search employees by name
 *     tags: [Employees]
 *     parameters:
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *         description: Full or partial employee name to search for
 *     responses:
 *       200:
 *         description: Matching employees
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Employee' }
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/search", getEmployeeByName); // GET /employees/search?name=Shah

/**
 * @openapi
 * /employees/department/{departmentId}:
 *   get:
 *     summary: List employees in a department
 *     tags: [Employees]
 *     parameters:
 *       - in: path
 *         name: departmentId
 *         required: true
 *         schema: { type: string, example: D001 }
 *     responses:
 *       200:
 *         description: Employees in the department
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Employee' }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/department/:departmentId", getEmployeesByDepartment); // GET /employees/department/D001

/**
 * @openapi
 * /employees/{id}:
 *   get:
 *     summary: Get a single employee by ID
 *     tags: [Employees]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, example: E001 }
 *     responses:
 *       200:
 *         description: The employee
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Employee' }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/:id", getEmployeeById); // GET /employees/E001 — keep this LAST

export default router;
