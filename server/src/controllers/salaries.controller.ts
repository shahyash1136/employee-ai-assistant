import type { Request, Response } from "express";
import { salaryServices } from "../services/salary.service.js";

export const getSalaries = async (req: Request, res: Response) => {
  try {
    const salaries = await salaryServices.getSalaries();

    res.json({
      success: true,
      data: salaries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to read CSV",
    });
  }
};
