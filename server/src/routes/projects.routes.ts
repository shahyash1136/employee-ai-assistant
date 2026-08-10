import { Router } from "express";
import {
  getProjects,
  getProjectsByEmployee,
} from "../controllers/projects.controller.js";

const router = Router();

/**
 * @openapi
 * /projects:
 *   get:
 *     summary: List all projects
 *     tags: [Projects]
 *     responses:
 *       200:
 *         description: List of projects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Project' }
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", getProjects);

/**
 * @openapi
 * /projects/employee/{employeeId}:
 *   get:
 *     summary: List projects an employee is assigned to
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema: { type: string, example: E001 }
 *     responses:
 *       200:
 *         description: Projects for the employee
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Project' }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/employee/:employeeId", getProjectsByEmployee); // GET /projects/employee/E001

export default router;
