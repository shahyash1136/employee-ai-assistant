import type { Request, Response } from "express";
import { authService } from "../services/auth.service.js";

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (typeof username !== "string" || typeof password !== "string") {
    return res
      .status(400)
      .json({ success: false, message: "username and password are required" });
  }

  const user = await authService.validateCredentials(username, password);
  if (!user) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid username or password" });
  }

  const token = authService.issueToken(user);
  res.json({
    success: true,
    token,
    user: {
      userId: user.userId,
      employeeId: user.employeeId,
      username: user.username,
      role: user.role,
    },
  });
};
