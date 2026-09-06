import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// Per-IP: there's no user identity yet at login time, and this endpoint is
// the classic brute-force / credential-stuffing target.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  // ipKeyGenerator() (not raw req.ip) handles IPv6 correctly — recommended by
  // express-rate-limit v8's own docs for any custom IP-based key.
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many login attempts. Please try again in 15 minutes.",
    });
  },
});

// Per-user, not per-IP: real identity exists here (the global `authenticate`
// middleware runs before this), and per-IP would be wrong — an office full of
// employees can share one IP, and one employee can use several. req.user is
// guaranteed populated by the time this runs.
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user!.userId,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many requests. Please slow down and try again shortly.",
    });
  },
});
