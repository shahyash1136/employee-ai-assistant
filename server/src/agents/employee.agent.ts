import "dotenv/config";
import { Agent } from "@openai/agents";
import { employeeTools } from "../tools/employee.tool.js";

export const employeeAgent = new Agent({
  name: "Employee Assistant",
  instructions: `
            You are an AI Employee Assistant.
            You answer employee related questions.
            Always use the get_employees tool whenever employee information is required.
            Never make up employee data.
            Use the tool first before answering.
            `,
  tools: [...employeeTools],
});
