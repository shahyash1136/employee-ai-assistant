import type { Request, Response } from "express";
import {
  runEmployeeAgentStream,
  runEmployeeAgentStructured,
} from "../orchestrator/runner.js";
import { conversationService } from "../conversation/conversation.service.js";
import {
  InputGuardrailTripwireTriggered,
  OutputGuardrailTripwireTriggered,
} from "@openai/agents";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// Generic wording is deliberate for BOTH input-guardrail categories (scope,
// injection) — one uniform decline message means a user probing the system
// can't tell which check they tripped from the response text alone.
const REQUEST_DECLINED_MESSAGE =
  "I can only help with questions about employees, attendance, departments, salaries, performance, or projects. Could you rephrase your request around one of those topics?";

// Returns a user-facing decline message if `error` is a known guardrail
// tripwire, or null if it's some other error the caller should handle as a
// genuine failure. Shared between the structured and streaming branches
// below, since both now run the agent to completion before responding.
function describeGuardrailFailure(error: unknown): string | null {
  if (error instanceof InputGuardrailTripwireTriggered) {
    console.warn(
      "Input guardrail tripped:",
      error.result.guardrail.name,
      error.result.output.outputInfo,
    );
    return REQUEST_DECLINED_MESSAGE;
  }

  if (error instanceof OutputGuardrailTripwireTriggered) {
    const guardrailName = error.result.guardrail.name;
    console.warn(
      "Output guardrail tripped:",
      guardrailName,
      error.result.output.outputInfo,
    );
    return guardrailName === "Hallucination Prevention Guardrail"
      ? "I wasn't able to fully verify part of that answer against the actual records, so I don't want to guess. Could you try asking again?"
      : "I wasn't able to safely return that response. Could you try rephrasing your question?";
  }

  return null;
}

const REPLAY_CHUNK_SIZE = 4; // characters per simulated "token"
const REPLAY_CHUNK_DELAY_MS = 15;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function chatController(req: Request, res: Response) {
  const { sessionId, message, format } = req.body;

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
        const decline = describeGuardrailFailure(agentError);
        if (decline) {
          const response = { summary: decline, employees: [], metrics: [] };
          conversationService.addAssistantMessage(sessionId, decline);
          return res.json({ success: true, response });
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
    // Fully generated and guardrail-checked BEFORE anything is written to
    // the response. See runner.ts / Concept Explanation for why this is no
    // longer true generation-time streaming.
    let assistantResponse: string;
    try {
      assistantResponse = await runEmployeeAgentStream(history);
    } catch (agentError) {
      const decline = describeGuardrailFailure(agentError);
      if (decline) {
        conversationService.addAssistantMessage(sessionId, decline);
        return res.json({ success: true, response: decline });
      }

      console.error("Agent run failed:", agentError);
      return res.status(502).json({
        success: false,
        message:
          "The assistant encountered an error while processing your request.",
      });
    }

    // Everything above this line either succeeded fully or returned early.
    // Nothing unvalidated can reach the code below.
    conversationService.addAssistantMessage(sessionId, assistantResponse);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    for (let i = 0; i < assistantResponse.length; i += REPLAY_CHUNK_SIZE) {
      const token = assistantResponse.slice(i, i + REPLAY_CHUNK_SIZE);
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
      await sleep(REPLAY_CHUNK_DELAY_MS);
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (err) {
    console.error("Unexpected error in chatController:", err);

    if (!res.headersSent) {
      res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    } else {
      res.write(
        `data: ${JSON.stringify({ error: "Internal Server Error" })}\n\n`,
      );
      res.write(`data: [DONE]\n\n`);
      res.end();
    }
  }
}
