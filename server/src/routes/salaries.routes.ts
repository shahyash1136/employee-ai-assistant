import { Router } from "express";
import { getSalaries } from "../controllers/salaries.controller.js";

const router = Router();

router.get("/", getSalaries);

export default router;
