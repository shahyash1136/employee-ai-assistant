import type { Request, Response } from "express";
import { runEmployeeAgent } from "../orchestrator/runner.js";
import { conversationService } from "../conversation/conversation.service.js";

export async function chatController(req: Request, res: Response) {
  try {
    const { sessionId, message } = req.body;

    conversationService.addUserMessage(sessionId, message);

    const history = conversationService.getHistory(sessionId);

    const stream = await runEmployeeAgent(history);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let assistantResponse = "";

    for await (const event of stream) {
      if (
        event.type === "raw_model_stream_event" &&
        event.data.type === "output_text_delta"
      ) {
        const token = event.data.delta;

        assistantResponse += token;

        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    }

    await stream.completed;

    conversationService.addAssistantMessage(sessionId, assistantResponse);

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (err) {
    console.error(err);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
}
