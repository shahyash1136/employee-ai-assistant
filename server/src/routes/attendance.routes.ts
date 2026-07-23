import { Router } from "express";
import { getAttendances } from "../controllers/attendance.controller.js";

const router = Router();

router.get("/", getAttendances);

export default router;
