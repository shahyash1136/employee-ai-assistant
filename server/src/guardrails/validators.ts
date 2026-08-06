const EMPLOYEE_ID_PATTERN = /^E\d{3,}$/;
const DEPARTMENT_ID_PATTERN = /^D\d{3,}$/;

export function isValidEmployeeId(value: unknown): string | null {
  if (typeof value !== "string" || !EMPLOYEE_ID_PATTERN.test(value)) {
    return `"${String(value)}" is not a valid employee ID format (expected something like "E001").`;
  }
  return null;
}

export function isValidDepartmentId(value: unknown): string | null {
  if (typeof value !== "string" || !DEPARTMENT_ID_PATTERN.test(value)) {
    return `"${String(value)}" is not a valid department ID format (expected something like "D001").`;
  }
  return null;
}

// Not wired to any shipped tool yet — none of your current tools accept a raw
// date parameter (get_attendance_by_employee, for example, takes only an
// employeeId, not a month/year). Included so a future date-taking tool can
// reuse this immediately instead of writing date validation from scratch.
export function isValidDateString(value: unknown): string | null {
  if (typeof value !== "string") {
    return `"${String(value)}" is not a valid date.`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return `"${value}" could not be parsed as a valid date.`;
  }
  const year = parsed.getFullYear();
  if (year < 2000 || year > new Date().getFullYear() + 1) {
    return `"${value}" is outside a plausible employment date range.`;
  }
  return null;
}
