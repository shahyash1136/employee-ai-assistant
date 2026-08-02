/**
 * Wraps a tool's execute function so any unexpected error (CSV read failure,
 * corrupt data, etc.) is caught and returned as a structured JSON error
 * string instead of throwing and breaking the agent run.
 */
export function safeToolExecute<TArgs extends unknown[]>(
  toolName: string,
  fn: (...args: TArgs) => Promise<string>,
) {
  return async (...args: TArgs): Promise<string> => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error(`[tool:${toolName}] execution failed:`, error);
      return JSON.stringify({
        error: `Something went wrong while running ${toolName}. Please try again.`,
      });
    }
  };
}
