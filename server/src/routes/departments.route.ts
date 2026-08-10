import { Router } from "express";
import { getDepartments } from "../controllers/departments.controller.js";

const router = Router();

/**
 * @openapi
 * /departments:
 *   get:
 *     summary: List all departments
 *     tags: [Departments]
 *     responses:
 *       200:
 *         description: List of departments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Department' }
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", getDepartments);

export default router;
