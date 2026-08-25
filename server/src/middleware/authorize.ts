import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "../types/user.js";

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource",
      });
    }
    next();
  };
}

// For routes shaped like /salaries/:employeeId — allows an 'employee' role
// through ONLY when the URL's employeeId matches their own; manager/admin
// bypass this check entirely.
export function requireOwnRecordOrRole(
  elevatedRoles: UserRole[],
  paramName: string = "employeeId",
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    if (elevatedRoles.includes(req.user.role)) {
      return next();
    }

    const requestedId = req.params[paramName];
    if (requestedId === req.user.employeeId) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "You can only access your own records",
    });
  };
}
