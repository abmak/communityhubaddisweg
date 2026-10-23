import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { allowedOrigins } from "./config/env";
import { logger } from "./lib/logger";
import { authenticate } from "./middleware/auth";
import { csrfProtection, originGuard } from "./middleware/csrf";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { apiLimiter } from "./lib/rate-limit";
import { apiRouter } from "./routes";
import { uploadDir } from "./lib/storage";
import { prisma } from "./lib/prisma";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === "/api/health" },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "debug";
      },
    }),
  );

  app.use(originGuard);
  app.use(csrfProtection);

  app.use(
    "/uploads",
    express.static(uploadDir, {
      maxAge: "7d",
      index: false,
      fallthrough: true,
      setHeaders: (res) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
      },
    }),
  );

  app.get("/api/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", database: "connected", timestamp: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: "degraded", database: "unavailable" });
    }
  });

  app.use("/api", apiLimiter, authenticate, apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
