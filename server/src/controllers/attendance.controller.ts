import type { Request, Response } from "express";
import { attendanceService } from "../services/attendance.service.js";

export const getAttendances = async (req: Request, res: Response) => {
  try {
    const attendance = await attendanceService.getAttendance();
    res.json({ success: true, data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to read CSV" });
  }
};

export const getAttendanceByEmployee = async (req: Request, res: Response) => {
  try {
    const employeeId = req.params.employeeId;
    if (typeof employeeId !== "string") {
      return res.status(400).json({ success: false, message: "Invalid employeeId" });
    }

    const attendance = await attendanceService.getAttendanceByEmployee(employeeId);
    res.json({ success: true, data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to read CSV" });
  }
};

export const getAttendancePercentage = async (req: Request, res: Response) => {
  try {
    const employeeId = req.params.employeeId;
    if (typeof employeeId !== "string") {
      return res.status(400).json({ success: false, message: "Invalid employeeId" });
    }

    const percentage = await attendanceService.getAttendancePercentage(employeeId);
    res.json({
      success: true,
      data: {
        employeeId,
        attendancePercentage: percentage,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to read CSV" });
  }
};
