import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/async-handler";
import { validate } from "../middleware/validate";
import type { RoutePoint } from "../services/directions";
import { planTrip, type PlanMode } from "../services/travel";

export const travelRouter = Router();

const pointSchema = z
  .string()
  .trim()
  .max(64)
  .transform((value, ctx) => {
    const parts = value.split(",");
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    if (
      parts.length !== 2 ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expected a lat,lng pair" });
      return z.NEVER;
    }
    return { lat, lng };
  });

const querySchema = z.object({
  from: pointSchema,
  to: pointSchema,
  mode: z.enum(["taxi", "bus", "walking"]).default("taxi"),
});

// GET /api/travel/plan?from=9.01,38.75&to=9.03,38.79&mode=bus
travelRouter.get(
  "/plan",
  validate(querySchema, "query"),
  asyncHandler(async (req, res) => {
    const { from, to, mode } = req.query as unknown as {
      from: RoutePoint;
      to: RoutePoint;
      mode: PlanMode;
    };

    const plan = await planTrip(from, to, mode);
    // The estimate moves with the clock, so it should never be reused for long.
    res.setHeader("Cache-Control", "private, max-age=30");
    res.json({ plan });
  }),
);
