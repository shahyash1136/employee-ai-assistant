import type { Request, Response } from "express";
import { traceStore } from "../tracing/traceStore.js";

export const listTraces = async (req: Request, res: Response) => {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  const parsedLimit =
    typeof req.query.limit === "string" ? Number(req.query.limit) : NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50;

  const traces = traceStore.list({ ...(sessionId ? { sessionId } : {}), limit });
  res.json({ success: true, data: traces });
};

export const getTrace = async (req: Request, res: Response) => {
  const trace = traceStore.get(req.params.traceId as string);

  if (!trace) {
    return res.status(404).json({ success: false, message: "Trace not found" });
  }

  res.json({ success: true, data: trace });
};
