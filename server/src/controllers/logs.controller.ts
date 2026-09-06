import type { Request, Response } from "express";
import { requestLogStore } from "../logging/requestLogStore.js";

export const listLogs = async (req: Request, res: Response) => {
  const userId =
    typeof req.query.userId === "string" ? req.query.userId : undefined;
  const parsedLimit =
    typeof req.query.limit === "string" ? Number(req.query.limit) : NaN;
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 100;

  const logs = requestLogStore.list({ userId, limit });
  res.json({ success: true, data: logs });
};
