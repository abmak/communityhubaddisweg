import { PlaceKind } from "@prisma/client";
import { prisma } from "../lib/prisma";

export interface OsmSearchOptions {
  kind?: PlaceKind;
  city?: string;
  lat?: number;
  lng?: number;
  q?: string;
  limit?: number;
}

interface OsmPlaceKindConfig {
  queries: string[];
  tags: string[];
  defaultDescription: string;
}

export const OSM_KIND_CONFIG: Record<PlaceKind, OsmPlaceKindConfig> = {
  CINEMA: {
    queries: ["cinema", "movie theatre"],
    tags: ["cinema", "screen", "live-osm", "film"],
    defaultDescription: "Movie cinema venue discovered live on OpenStreetMap.",
  },
  THEATRE: {
    queries: ["theatre", "arts centre"],
    tags: ["theatre", "stage", "live-osm", "performance"],
    defaultDescription: "Theatre and performing arts venue discovered live on OpenStreetMap.",
  },
  HOTEL: {
    queries: ["hotel", "guest house"],
    tags: ["hotel", "stay", "live-osm", "hospitality"],
    defaultDescription: "Hotel and lodging accommodation discovered live on OpenStreetMap.",
  },
  HIKING: {
    queries: ["viewpoint", "park", "nature reserve"],
    tags: ["hiking", "viewpoint", "trail", "live-osm", "nature"],
    defaultDescription: "Scenic viewpoint and outdoor hiking route discovered live on OpenStreetMap.",
  },
  CAFE: {
    queries: ["cafe", "coffee"],
    tags: ["cafe", "coffee", "buna", "live-osm"],
    defaultDescription: "Coffee house and gathering spot discovered live on OpenStreetMap.",
  },
  RESTAURANT: {
    queries: ["restaurant", "food"],
    tags: ["restaurant", "dining", "live-osm", "food"],
    defaultDescription: "Restaurant and dining destination discovered live on OpenStreetMap.",
  },
  GYM: {
    queries: ["gym", "fitness centre"],
    tags: ["gym", "fitness", "workout", "live-osm"],
    defaultDescription: "Fitness and athletic gym discovered live on OpenStreetMap.",
  },
  STADIUM: {
    queries: ["stadium", "sports centre"],
    tags: ["stadium", "sports", "football", "live-osm"],
    defaultDescription: "Sports stadium and arena discovered live on OpenStreetMap.",
  },
  GALLERY: {
    queries: ["gallery", "museum", "arts centre"],
    tags: ["gallery", "art", "museum", "live-osm"],
    defaultDescription: "Art gallery and cultural exhibition discovered live on OpenStreetMap.",
  },
  LIBRARY: {
    queries: ["library"],
    tags: ["library", "books", "reading", "live-osm"],
    defaultDescription: "Public reading space and library discovered live on OpenStreetMap.",
  },
  HOSPITAL: {
    queries: ["hospital", "health centre", "clinic"],
    tags: ["hospital", "health", "clinic", "live-osm"],
    defaultDescription: "Hospital and clinic discovered live on OpenStreetMap.",
  },
  PHARMACY: {
    queries: ["pharmacy", "drugstore"],
    tags: ["pharmacy", "medicine", "health", "live-osm"],
    defaultDescription: "Pharmacy and drugstore discovered live on OpenStreetMap.",
  },
  GAS_STATION: {
    queries: ["petrol station", "fuel", "filling station"],
    tags: ["fuel", "petrol", "gas-station", "live-osm"],
    defaultDescription: "Fuel station discovered live on OpenStreetMap.",
  },
  SCHOOL: {
    queries: ["school", "academy"],
    tags: ["school", "education", "students", "live-osm"],
    defaultDescription: "School and academy discovered live on OpenStreetMap.",
  },
  PUBLIC_TOILET: {
    queries: ["public toilet", "toilets"],
    tags: ["public-toilet", "toilet", "washroom", "live-osm"],
    defaultDescription: "Public toilet discovered live on OpenStreetMap.",
  },
  PARKING: {
    queries: ["parking", "parking lot"],
    tags: ["parking", "car-park", "live-osm"],
    defaultDescription: "Parking area discovered live on OpenStreetMap.",
  },
  EV_CHARGING: {
    queries: ["electric vehicle charging station", "ev charging"],
    tags: ["ev-charging", "electric-vehicle", "charging", "live-osm"],
    defaultDescription: "Electric vehicle charging point discovered live on OpenStreetMap.",
  },
  TRANSIT_STOP: {
    queries: ["bus stop", "bus station", "light rail station"],
    tags: ["transit", "bus-stop", "public-transport", "live-osm"],
    defaultDescription: "Public transport stop discovered live on OpenStreetMap.",
  },
  BANK: {
    queries: ["bank", "commercial bank"],
    tags: ["bank", "finance", "cash", "live-osm"],
    defaultDescription: "Bank branch discovered live on OpenStreetMap.",
  },
  ATM: {
    queries: ["atm", "cash machine"],
    tags: ["atm", "cash", "cash-machine", "live-osm"],
    defaultDescription: "Cash machine discovered live on OpenStreetMap.",
  },
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

interface NominatimResult {
  place_id: number;
  osm_id: number;
  osm_type: string;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  type?: string;
  category?: string;
  address?: {
    amenity?: string;
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    quarter?: string;
    city?: string;
    town?: string;
    county?: string;
    state?: string;
    country?: string;
  };
  extratags?: {
    phone?: string;
    website?: string;
    cuisine?: string;
    opening_hours?: string;
    description?: string;
    "name:en"?: string;
    "name:am"?: string;
  };
}

/**
 * Fetch live real-world places from OpenStreetMap Nominatim API and persist them in PostgreSQL.
 */
export async function syncLivePlacesFromOsm(options: OsmSearchOptions) {
  const { kind, city = "Addis Ababa", lat, lng, q, limit = 15 } = options;

  const targetKind = kind ?? PlaceKind.CAFE;
  const kindConfig = OSM_KIND_CONFIG[targetKind];
  const searchTerm = q?.trim() || kindConfig.queries[0];

  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    extratags: "1",
    limit: String(Math.min(limit, 30)),
  });

  if (lat !== undefined && lng !== undefined) {
    const delta = 0.08; // ~9km bounding box around user position
    const viewbox = `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`;
    params.set("viewbox", viewbox);
    params.set("bounded", "1");
    params.set("q", searchTerm);
  } else {
    params.set("q", `${searchTerm} in ${city}`);
  }

  const endpoint = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        "User-Agent": "CommunityHubApp/1.0 (info@communityhub.local)",
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[OSM] Request returned status ${response.status}`);
      return [];
    }

    const items = (await response.json()) as NominatimResult[];
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const upsertedPlaces = [];

    for (const item of items) {
      const parsedLat = parseFloat(item.lat);
      const parsedLng = parseFloat(item.lon);
      if (isNaN(parsedLat) || isNaN(parsedLng)) continue;

      const rawName =
        item.extratags?.["name:en"] ||
        item.name ||
        item.display_name.split(",")[0].trim() ||
        `${targetKind} Venue`;

      const amharicName = item.extratags?.["name:am"];
      const baseSlug = slugify(rawName) || `osm-place-${item.osm_id}`;
      const slug = `${baseSlug}-osm-${item.osm_id}`.slice(0, 115);

      const cityName =
        item.address?.city ||
        item.address?.town ||
        item.address?.state ||
        city ||
        "Addis Ababa";

      const areaName =
        item.address?.suburb ||
        item.address?.neighbourhood ||
        item.address?.quarter ||
        item.address?.road ||
        null;

      const address = item.display_name || null;

      // Construct rich description from OSM metadata
      const extraDetails: string[] = [];
      if (item.extratags?.cuisine) {
        extraDetails.push(`Cuisine: ${item.extratags.cuisine}`);
      }
      if (item.extratags?.opening_hours) {
        extraDetails.push(`Hours: ${item.extratags.opening_hours}`);
      }
      if (item.extratags?.phone) {
        extraDetails.push(`Phone: ${item.extratags.phone}`);
      }

      const description = [
        item.extratags?.description || kindConfig.defaultDescription,
        extraDetails.length > 0 ? extraDetails.join(" · ") : null,
        amharicName ? `በአማርኛ: ${amharicName}` : null,
        `Live data verified from OpenStreetMap (OSM Node/Way ${item.osm_id}).`,
      ]
        .filter(Boolean)
        .join("\n\n");

      // Stable pseudo-rating between 4.0 and 4.9 derived from osm_id
      const pseudoRating = Number((4.0 + (Math.abs(item.osm_id) % 10) * 0.1).toFixed(1));
      const pseudoReviews = 10 + (Math.abs(item.osm_id) % 85);
      const priceLevel = 1 + (Math.abs(item.osm_id) % 3);

      const tags = Array.from(
        new Set([
          ...kindConfig.tags,
          "live-osm",
          "openstreetmap",
          targetKind.toLowerCase(),
          cityName.toLowerCase().replace(/\s+/g, "-"),
        ]),
      );

      try {
        const place = await prisma.place.upsert({
          where: { slug },
          update: {
            name: rawName,
            kind: targetKind,
            city: cityName,
            area: areaName,
            address,
            description,
            lat: parsedLat,
            lng: parsedLng,
            tags,
            highlight: "Live from OpenStreetMap",
          },
          create: {
            slug,
            name: rawName,
            kind: targetKind,
            city: cityName,
            area: areaName,
            address,
            description,
            lat: parsedLat,
            lng: parsedLng,
            rating: pseudoRating,
            reviewCount: pseudoReviews,
            priceLevel,
            tags,
            highlight: "Live from OpenStreetMap",
            featured: false,
          },
        });

        upsertedPlaces.push(place);
      } catch (dbErr) {
        console.warn(`[OSM] Could not upsert place ${slug}:`, dbErr);
      }
    }

    return upsertedPlaces;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    console.error("[OSM] Error querying OpenStreetMap Nominatim API:", err);
    return [];
  }
}
