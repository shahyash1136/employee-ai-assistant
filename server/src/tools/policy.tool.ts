import { tool } from "@openai/agents";
import { z } from "zod";
import { knowledgeRetrievalService } from "../services/knowledgeRetrieval.service.js";
import { safeToolExecute } from "../utils/safeToolExecute.js";
import { searchQueryGuardrail } from "../guardrails/toolMisuse.guardrail.js";

export const searchHrPoliciesTool = tool({
  name: "search_hr_policies",
  description:
    "Searches the company's HR policy documents (Leave Policy, Work From Home Policy, " +
    "Expense Reimbursement Policy, Code of Conduct) and returns the most relevant passages. " +
    "Use it for questions about what the policies say: entitlements, limits, rules and " +
    "approval processes. It does not access any individual employee's records.",
  parameters: z.object({
    query: z
      .string()
      .describe(
        "A short, self-contained search query with the key terms, e.g. 'sick leave entitlement for contract employees'",
      ),
  }),
  inputGuardrails: [searchQueryGuardrail],
  execute: safeToolExecute("search_hr_policies", async ({ query }) => {
    const passages = await knowledgeRetrievalService.searchPolicies(query);
    if (passages.length === 0) {
      return JSON.stringify({
        results: [],
        note: "No relevant passages were found in the HR policy documents.",
      });
    }
    return JSON.stringify({
      results: passages.map((p) => ({
        policy: p.policy,
        policyId: p.policyId,
        version: p.version,
        sections: p.sections,
        text: p.content,
      })),
    });
  }),
});

export const policyTools = [searchHrPoliciesTool];
