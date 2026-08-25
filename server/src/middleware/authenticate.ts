import type { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service.js";

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Missing or invalid Authorization header",
    });
  }

  const token = header.slice("Bearer ".length);
  const payload = authService.verifyToken(token);

  if (!payload) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }

  req.user = payload;
  next();
}
