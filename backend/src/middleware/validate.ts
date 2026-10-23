import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { ApiError } from "../lib/errors";

type Source = "body" | "query" | "params";

export function validate(schema: ZodTypeAny, source: Source = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(
        new ApiError(
          400,
          "Please check the highlighted fields and try again.",
          "VALIDATION_ERROR",
          result.error.flatten(),
        ),
      );
      return;
    }
    (req as unknown as Record<string, unknown>)[source] = result.data;
    next();
  };
}
