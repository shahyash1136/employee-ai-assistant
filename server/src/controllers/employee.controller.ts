import type { Request, Response } from "express";
import { readEmployees } from "../services/employee.service.js";

export const getEmployees = async (req: Request, res: Response) => {
  try {
    const employees = await readEmployees();

    res.json({
      success: true,
      data: employees,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to read CSV",
    });
  }
};
