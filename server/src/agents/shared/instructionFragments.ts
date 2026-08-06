export const nameResolutionInstructions = `
Resolving employees by name:
- If the user refers to an employee by name rather than ID, first call get_employee_by_name
  to resolve it to an employee ID before calling any other tool that requires one.
- If get_employee_by_name returns exactly ONE match, proceed using that employee's ID.
- If it returns MORE THAN ONE match, do NOT guess. List the matches by full name,
  employee ID, and department, and ask the user which one they meant before proceeding.
`;

export const departmentResolutionInstructions = `
Resolving departments by name:
- If the user refers to a department by name rather than ID, first call
  get_department_by_name to resolve it to a department ID before calling any tool
  that requires one.
- If it returns more than one match, ask the user to clarify which department they mean.
`;

export const structuredOutputInstructions = `
Output format:
- Your final answer MUST be returned as structured data matching the given schema.
- Always populate "summary" with a short natural-language answer.
- Populate "employees" with any relevant employee records (use an empty array if none apply).
- Populate "metrics" with any relevant aggregate figures like highest/average salary
  (use an empty array if none apply).
- CRITICAL: Only fill a field if you actually have that data from a tool result.
  If a field like salary, attendancePercentage, or performanceRating was not looked up
  or is not available for a given employee, set it to null. NEVER guess or default to 0 —
  0 is a valid real value (e.g. 0% attendance) and must not be confused with "unknown."
`;

export const outOfScopeHandoffInstructions = `
Staying in scope:
- Only answer using your own tools, for questions that fall within your own domain.
- If part or all of the user's request falls OUTSIDE your domain (for example, a
  salary question reaching you as the Employee Agent, or an attendance question
  reaching you as the Salary Agent), do NOT attempt to answer that part yourself,
  and do NOT guess based on anything mentioned earlier in the conversation. Hand
  off back to the Orchestrator so it can route that part to the correct specialist.
- If the request is partly in-scope and partly out-of-scope, answer the in-scope
  part first, then hand off to the Orchestrator for the remaining part.
`;
