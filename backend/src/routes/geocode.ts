import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/async-handler";
import { ApiError } from "../lib/errors";
import { geocodeLimiter } from "../lib/rate-limit";
import { validate } from "../middleware/validate";
import { geocodeVenue, isGeocodable } from "../services/geocode";

export const geocodeRouter = Router();

const querySchema = z.object({
  q: z.string().trim().min(2).max(180),
});

// GET /api/geocode?q=Bole%20Medhane%20Alem%2C%20Addis%20Ababa
geocodeRouter.get(
  "/",
  geocodeLimiter,
  validate(querySchema, "query"),
  asyncHandler(async (req, res) => {
    const { q } = req.query as unknown as { q: string };

    if (!isGeocodable(q)) {
      throw new ApiError(
        404,
        "This listing has no usable venue address yet.",
        "GEOCODE_NOT_FOUND",
      );
    }

    const location = await geocodeVenue(q);
    if (!location) {
      throw new ApiError(
        404,
        "We couldn't find that venue on the map. Try a landmark or the street name.",
        "GEOCODE_NOT_FOUND",
      );
    }

    res.setHeader("Cache-Control", "public, max-age=86400");
    res.json({ location: { ...location, query: q } });
  }),
);
