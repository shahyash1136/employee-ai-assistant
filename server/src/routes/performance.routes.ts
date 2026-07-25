import { Router } from "express";
import {
  getPerformance,
  getTopPerformers,
} from "../controllers/performance.controller.js";

const router = Router();

router.get("/", getPerformance);
router.get("/top", getTopPerformers); // GET /performance/top?rating=4.5

export default router;
