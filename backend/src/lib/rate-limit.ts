import rateLimit from "express-rate-limit";

const handler = (
  _req: unknown,
  res: { status: (code: number) => { json: (body: unknown) => void } },
) => {
  res.status(429).json({
    error: {
      message: "You're moving a little fast. Please wait a moment and try again.",
      code: "RATE_LIMITED",
    },
  });
};

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});

export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 90,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});

export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});

// Nominatim asks clients to keep lookups rare; the service also caches and
// serialises them, so this only guards against a loop in a broken client.
export const geocodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});
