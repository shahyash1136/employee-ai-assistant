import { Router } from "express";
import {
  getProjects,
  getProjectsByEmployee,
} from "../controllers/projects.controller.js";

const router = Router();

router.get("/", getProjects);
router.get("/employee/:employeeId", getProjectsByEmployee); // GET /projects/employee/E001

export default router;
