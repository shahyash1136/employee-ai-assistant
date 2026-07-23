import type { Request, Response } from "express";
import { departmentService } from "../services/department.service.js";

export const getDepartments = async (req: Request, res: Response) => {
  try {
    const departments = await departmentService.getDepartment();

    res.json({
      success: true,
      data: departments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to read CSV",
    });
  }
};
