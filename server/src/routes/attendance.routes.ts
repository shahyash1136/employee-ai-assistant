import { Router } from "express";
import {
  getAttendances,
  getAttendanceByEmployee,
  getAttendancePercentage,
} from "../controllers/attendance.controller.js";

const router = Router();

router.get("/", getAttendances);
router.get("/percentage/:employeeId", getAttendancePercentage); // GET /attendance/percentage/E001
router.get("/employee/:employeeId", getAttendanceByEmployee); // GET /attendance/employee/E001

export default router;
