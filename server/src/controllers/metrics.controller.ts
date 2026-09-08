import type { Request, Response } from "express";
import { computeMetrics } from "../logging/metricsService.js";

export const getMetrics = async (_req: Request, res: Response) => {
  res.json({ success: true, data: computeMetrics() });
};
