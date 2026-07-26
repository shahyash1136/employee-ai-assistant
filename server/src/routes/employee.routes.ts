import { Router } from "express";
import {
  getAllEmployees,
  getEmployeeById,
  getEmployeeByName,
  getEmployeesByDepartment,
} from "../controllers/employee.controller.js";

const router = Router();

router.get("/", getAllEmployees);
router.get("/search", getEmployeeByName); // GET /employees/search?name=Shah
router.get("/department/:departmentId", getEmployeesByDepartment); // GET /employees/department/D001
router.get("/:id", getEmployeeById); // GET /employees/E001 — keep this LAST

export default router;
