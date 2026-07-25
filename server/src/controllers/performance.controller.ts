import type { Request, Response } from "express";
import { performanceService } from "../services/performance.service.js";

export const getPerformance = async (req: Request, res: Response) => {
  try {
    const performance = await performanceService.getPerformance();
    res.json({ success: true, data: performance });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to read CSV" });
  }
};

export const getTopPerformers = async (req: Request, res: Response) => {
  try {
    const ratingParam = req.query.rating;
    const minRating =
      ratingParam !== undefined ? Number(ratingParam) : undefined;

    if (ratingParam !== undefined && Number.isNaN(minRating)) {
      return res.status(400).json({
        success: false,
        message: "Query param 'rating' must be a valid number",
      });
    }

    const topPerformers =
      minRating !== undefined
        ? await performanceService.getTopPerformers(minRating)
        : await performanceService.getTopPerformers();

    res.json({ success: true, data: topPerformers });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to read CSV" });
  }
};
