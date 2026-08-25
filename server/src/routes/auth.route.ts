import { Router } from "express";
import { login } from "../controllers/auth.controller.js";

const router = Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in and receive a JWT
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string, example: manager1 }
 *               password: { type: string, example: manager123 }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 token: { type: string }
 *                 user:
 *                   type: object
 *                   properties:
 *                     userId: { type: string }
 *                     employeeId: { type: string }
 *                     username: { type: string }
 *                     role: { type: string, enum: [employee, manager, admin] }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post("/login", login);

export default router;
