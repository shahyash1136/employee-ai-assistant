import type { Request, Response } from "express";
import { performanceService } from "../services/performance.service.js";

export const getPerformance = async (req: Request, res: Response) => {
  try {
    const performance = await performanceService.getPerformance();

    res.json({
      success: true,
      data: performance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to read CSV",
    });
  }
};
