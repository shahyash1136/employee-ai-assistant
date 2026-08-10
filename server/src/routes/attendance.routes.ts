import { Router } from "express";
import {
  getAttendances,
  getAttendanceByEmployee,
  getAttendancePercentage,
} from "../controllers/attendance.controller.js";

const router = Router();

/**
 * @openapi
 * /attendance:
 *   get:
 *     summary: List all attendance records
 *     tags: [Attendance]
 *     responses:
 *       200:
 *         description: List of attendance records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Attendance' }
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", getAttendances);

/**
 * @openapi
 * /attendance/percentage/{employeeId}:
 *   get:
 *     summary: Get an employee's attendance percentage
 *     tags: [Attendance]
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema: { type: string, example: E001 }
 *     responses:
 *       200:
 *         description: Attendance percentage
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     employeeId: { type: string }
 *                     attendancePercentage: { type: number, example: 92.5 }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/percentage/:employeeId", getAttendancePercentage); // GET /attendance/percentage/E001

/**
 * @openapi
 * /attendance/employee/{employeeId}:
 *   get:
 *     summary: List attendance records for one employee
 *     tags: [Attendance]
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema: { type: string, example: E001 }
 *     responses:
 *       200:
 *         description: Attendance records for the employee
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Attendance' }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/employee/:employeeId", getAttendanceByEmployee); // GET /attendance/employee/E001

export default router;
