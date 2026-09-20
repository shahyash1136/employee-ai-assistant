import type { UserRole } from "@/types/api";

// Mirrors requireRole(["manager", "admin"]) on GET /approvals and
// POST /approvals/:id/decision. This only drives what the UI shows — the
// server is the real enforcement and answers 403 regardless of what the
// client thinks.
export const APPROVER_ROLES: UserRole[] = ["manager", "admin"];

export function canReviewApprovals(role: UserRole): boolean {
  return APPROVER_ROLES.includes(role);
}
