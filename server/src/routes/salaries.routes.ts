import { Router } from "express";
import {
  getSalaries,
  getHighestSalary,
  getAverageSalary,
  getEmployeesBySalaryRange,
  getSalaryByEmployee,
} from "../controllers/salaries.controller.js";

const router = Router();

router.get("/", getSalaries);
router.get("/highest", getHighestSalary); // GET /salaries/highest
router.get("/average", getAverageSalary); // GET /salaries/average
router.get("/range", getEmployeesBySalaryRange); // GET /salaries/range?min=500000&max=1000000
router.get("/:employeeId", getSalaryByEmployee); // GET /salaries/E001 — keep LAST

export default router;
