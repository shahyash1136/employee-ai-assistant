import type { Request, Response } from "express";
import { runEmployeeAgent } from "../orchestrator/runner.js";

export async function chatController(req: Request, res: Response) {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    const response = await runEmployeeAgent(message);

    return res.json({
      success: true,
      response,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
}
