import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/async-handler";
import { validate } from "../middleware/validate";
import { getRoutes, type RoutePoint, type TravelMode } from "../services/directions";

export const directionsRouter = Router();

/** "lat,lng" as it appears in a shareable navigation link. */
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
  mode: z.enum(["driving", "walking"]).default("driving"),
  /** 1 returns every alternative so a chosen planner route can be honoured. */
  alternatives: z.coerce.number().int().min(0).max(1).default(0),
});

// GET /api/directions?from=9.01,38.75&to=9.03,38.79&mode=walking
directionsRouter.get(
  "/",
  validate(querySchema, "query"),
  asyncHandler(async (req, res) => {
    const { from, to, mode, alternatives } = req.query as unknown as {
      from: RoutePoint;
      to: RoutePoint;
      mode: TravelMode;
      alternatives: number;
    };

    const routes = await getRoutes(from, to, mode);
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json(alternatives ? { route: routes[0], routes } : { route: routes[0] });
  }),
);
