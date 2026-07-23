import type { Request, Response } from "express";
import { attendanceService } from "../services/attendance.service.js";

export const getAttendances = async (req: Request, res: Response) => {
  try {
    const attendance = await attendanceService.getAttendance();

    res.json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to read CSV",
    });
  }
};
