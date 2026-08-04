import type { Request, Response } from "express";
import {
  runEmployeeAgentStream,
  runEmployeeAgentStructured,
} from "../orchestrator/runner.js";
import { conversationService } from "../conversation/conversation.service.js";
import { InputGuardrailTripwireTriggered } from "@openai/agents";

// Renamed from OUT_OF_SCOPE_MESSAGE — deliberately generic wording. If this
// text differed for "out of scope" vs "injection detected," an attacker
// probing the system could use the response itself to figure out which
// guardrail they tripped. One decline message for any input guardrail keeps
// that information from leaking.
const REQUEST_DECLINED_MESSAGE =
  "I can only help with questions about employees, attendance, departments, salaries, performance, or projects. Could you rephrase your request around one of those topics?";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function chatController(req: Request, res: Response) {
  const { sessionId, message, format } = req.body;

  // --- Input validation ---
  if (!isNonEmptyString(sessionId) || !isNonEmptyString(message)) {
    return res.status(400).json({
      success: false,
      message:
        "sessionId and message are required and must be non-empty strings",
    });
  }

  if (format !== undefined && format !== "json" && format !== "text") {
    return res.status(400).json({
      success: false,
      message: "format must be either 'json' or 'text' if provided",
    });
  }

  try {
    conversationService.addUserMessage(sessionId, message);
    const history = conversationService.getHistory(sessionId);

    if (format === "json") {
      // --- Structured mode: buffered, single JSON response ---
      try {
        const structuredResponse = await runEmployeeAgentStructured(history);

        if (!structuredResponse) {
          return res.status(502).json({
            success: false,
            message:
              "The assistant could not produce a structured response. Please try again.",
          });
        }

        conversationService.addAssistantMessage(
          sessionId,
          JSON.stringify(structuredResponse),
        );
        return res.json({ success: true, response: structuredResponse });
      } catch (agentError) {
        if (agentError instanceof InputGuardrailTripwireTriggered) {
          // Internal-only log — safe to include guardrail name/reason here since
          // this never reaches the client.
          console.warn(
            "Input guardrail tripped:",
            agentError.result.guardrail.name,
            agentError.result.output.outputInfo,
          );

          const decline = {
            summary: REQUEST_DECLINED_MESSAGE,
            employees: [],
            metrics: [],
          };
          conversationService.addAssistantMessage(sessionId, decline.summary);
          return res.json({ success: true, response: decline });
        }

        console.error("Structured agent run failed:", agentError);
        return res.status(502).json({
          success: false,
          message:
            "The assistant encountered an error while processing your request.",
        });
      }
    }

    // --- Default: streaming plain-text mode ---
    let stream;
    try {
      stream = await runEmployeeAgentStream(history);
    } catch (agentError) {
      if (agentError instanceof InputGuardrailTripwireTriggered) {
        // Internal-only log — safe to include guardrail name/reason here since
        // this never reaches the client.
        console.warn(
          "Input guardrail tripped:",
          agentError.result.guardrail.name,
          agentError.result.output.outputInfo,
        );

        const decline = {
          summary: REQUEST_DECLINED_MESSAGE,
          employees: [],
          metrics: [],
        };
        conversationService.addAssistantMessage(sessionId, decline.summary);
        return res.json({ success: true, response: decline });
      }

      console.error("Streaming agent run failed to start:", agentError);
      return res.status(502).json({
        success: false,
        message:
          "The assistant encountered an error while starting the response.",
      });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let assistantResponse = "";

    try {
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
    } catch (streamError) {
      // Headers are already sent at this point — we can't send a 500 status,
      // but we CAN tell the client something broke via an SSE error event
      // instead of just silently dropping the connection.
      console.error("Error mid-stream:", streamError);
      res.write(
        `data: ${JSON.stringify({
          error:
            "The assistant encountered an error while generating the response.",
        })}\n\n`,
      );
      res.write(`data: [DONE]\n\n`);
    } finally {
      res.end();
    }
  } catch (err) {
    console.error("Unexpected error in chatController:", err);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    } else {
      res.write(
        `data: ${JSON.stringify({ error: "Internal Server Error" })}\n\n`,
      );
      res.write(`data: [DONE]\n\n`);
      res.end();
    }
  }
}
