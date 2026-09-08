import type { Request, Response, NextFunction } from "express";
import { logger } from "../logging/logger.js";
import {
  requestLogStore,
  type RequestLogEntry,
} from "../logging/requestLogStore.js";

// Mounted before EVERYTHING — even before authenticate — so every request
// gets logged, including failed logins and unauthenticated attempts. req.user
// is read inside the 'finish' handler, which only fires after the entire
// middleware chain (including authenticate, if it ran) has completed — so it's
// correctly populated for authenticated requests by the time we read it, even
// though this middleware itself runs first.
export function httpLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    const entry: RequestLogEntry = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      userId: req.user?.userId ?? null,
      timestamp: new Date().toISOString(),
    };

    logger.info(entry, "http_request");
    requestLogStore.create(entry);
  });

  next();
}
