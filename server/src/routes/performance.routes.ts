import { Router } from "express";
import {
  getPerformance,
  getPerformanceByEmployee,
  getTopPerformers,
} from "../controllers/performance.controller.js";

const router = Router();

router.get("/", getPerformance);
router.get("/top", getTopPerformers); // GET /performance/top?rating=4.5
router.get("/employee/:employeeId", getPerformanceByEmployee); // GET /performance/employee/E001

export default router;
