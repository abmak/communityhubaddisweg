import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import multer from "multer";
import { ApiError } from "../lib/errors";
import { logger } from "../lib/logger";
import { isProduction } from "../config/env";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new ApiError(404, `No API route matches ${req.method} ${req.originalUrl}`, "NOT_FOUND"));
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) return;

  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "Something went wrong on our side. Please try again.";
  let details: unknown;

  if (error instanceof ApiError) {
    status = error.status;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "Please check the highlighted fields and try again.";
    details = error.flatten();
  } else if (error instanceof multer.MulterError) {
    status = 400;
    code = "UPLOAD_ERROR";
    message =
      error.code === "LIMIT_FILE_SIZE"
        ? "That file is larger than the upload limit."
        : "The file could not be uploaded.";
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      status = 404;
      code = "NOT_FOUND";
      message = "That item no longer exists.";
    } else if (error.code === "P2002") {
      status = 409;
      code = "CONFLICT";
      message = "That value is already in use.";
    } else if (error.code === "P2003") {
      status = 400;
      code = "INVALID_REFERENCE";
      message = "That action references something that no longer exists.";
    }
  } else if (error instanceof SyntaxError && "body" in error) {
    status = 400;
    code = "INVALID_JSON";
    message = "The request body was not valid JSON.";
  }

  if (status >= 500) {
    logger.error(
      { err: error, method: req.method, url: req.originalUrl, userId: req.userId },
      "Unhandled API error",
    );
  }

  res.status(status).json({
    error: {
      message,
      code,
      ...(details !== undefined ? { details } : {}),
      ...(!isProduction && status >= 500 && error instanceof Error ? { stack: error.stack } : {}),
    },
  });
}
