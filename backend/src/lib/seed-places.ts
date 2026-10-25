import type { Prisma } from "@prisma/client";
import { logger } from "./logger";
import { prisma } from "./prisma";

/**
 * The everyday stops a neighbourhood list is actually used for: somewhere to be
 * treated, somewhere to fill a prescription, somewhere to fill the tank, and
 * somewhere to send a child in the morning. Seeded on boot so a fresh database
 * is useful before anyone presses "Sync OpenMap"; the CLI seed keeps the
 * cultural venues. Coordinates are neighbourhood-level, like the rest of the
 * directory.
 */
const SERVICE_PLACES: Prisma.PlaceCreateManyInput[] = [
  {
    slug: "tikur-anbessa-hospital",
    name: "Tikur Anbessa Specialized Hospital",
    kind: "HOSPITAL",
    city: "Addis Ababa",
    area: "Lideta",
    address: "Zambia Street, near Black Lion",
    description:
      "The country's main referral and teaching hospital. Emergency and specialist clinics run around the clock; expect queues at the outpatient desks in the morning.",
    lat: 9.0152,
    lng: 38.7503,
    rating: 4.1,
    reviewCount: 312,
    priceLevel: null,
    tags: ["emergency", "referral", "teaching hospital", "24/7"],
    highlight: "Largest referral hospital in the country",
    featured: true,
  },
  {
    slug: "zewditu-memorial-hospital",
    name: "Zewditu Memorial Hospital",
    kind: "HOSPITAL",
    city: "Addis Ababa",
    area: "Arada",
    address: "Zewditu Street, near Arat Kilo",
    description:
      "Public hospital with a busy maternity wing and a reliable emergency room, minutes from the city centre.",
    lat: 9.0289,
    lng: 38.7513,
    rating: 4.0,
    reviewCount: 186,
    priceLevel: null,
    tags: ["emergency", "maternity", "public"],
    highlight: "Central emergency room",
    featured: false,
  },
  {
    slug: "st-pauls-hospital",
    name: "St. Paul's Hospital Millennium Medical College",
    kind: "HOSPITAL",
    city: "Addis Ababa",
    area: "Gulele",
    address: "Gulele, off the Entoto road",
    description:
      "Large teaching hospital on the northern side of the city, known for its surgical and paediatric departments.",
    lat: 9.0507,
    lng: 38.7468,
    rating: 4.2,
    reviewCount: 241,
    priceLevel: null,
    tags: ["emergency", "surgery", "paediatrics"],
    highlight: "Northern side referral centre",
    featured: false,
  },
  {
    slug: "kenema-pharmacy-bole",
    name: "Kenema Pharmacy — Bole",
    kind: "PHARMACY",
    city: "Addis Ababa",
    area: "Bole",
    address: "Bole Road, near Edna Mall",
    description:
      "The branch most people in Bole use: imported medicines, a fridge for insulin and staff who will call around when something is out of stock.",
    lat: 8.9993,
    lng: 38.7853,
    rating: 4.3,
    reviewCount: 157,
    priceLevel: 2,
    tags: ["prescriptions", "insulin fridge", "cards accepted"],
    highlight: "Open late on weekdays",
    featured: true,
  },
  {
    slug: "kenema-pharmacy-piassa",
    name: "Kenema Pharmacy — Piassa",
    kind: "PHARMACY",
    city: "Addis Ababa",
    area: "Piassa",
    address: "Winston Churchill Avenue",
    description:
      "Central branch with a wide stock of everyday medicines and a counter that stays open into the evening.",
    lat: 9.0345,
    lng: 38.7513,
    rating: 4.1,
    reviewCount: 93,
    priceLevel: 2,
    tags: ["prescriptions", "everyday medicine", "central"],
    highlight: "Walk from Piassa",
    featured: false,
  },
  {
    slug: "medhanialem-pharmacy-megenagna",
    name: "Medhanialem Pharmacy — Megenagna",
    kind: "PHARMACY",
    city: "Addis Ababa",
    area: "Megenagna",
    address: "Megenagna, off Ring Road",
    description:
      "Neighbourhood pharmacy near the roundabout — quick for prescriptions, baby supplies and the usual first-aid shelf.",
    lat: 9.0196,
    lng: 38.8014,
    rating: 4.0,
    reviewCount: 64,
    priceLevel: 1,
    tags: ["prescriptions", "first aid", "neighbourhood"],
    highlight: "Easy stop at Megenagna",
    featured: false,
  },
  {
    slug: "total-bole-fuel",
    name: "Total — Bole Road",
    kind: "GAS_STATION",
    city: "Addis Ababa",
    area: "Bole",
    address: "Bole Road, near Getu Commercial Centre",
    description:
      "Busy forecourt with petrol, diesel, air and a small shop; the queue moves fastest early in the morning.",
    lat: 8.9971,
    lng: 38.7872,
    rating: 4.0,
    reviewCount: 208,
    priceLevel: 2,
    tags: ["petrol", "diesel", "air", "shop"],
    highlight: "Fuel and air in one stop",
    featured: true,
  },
  {
    slug: "noc-meskel-square",
    name: "NOC — Meskel Square",
    kind: "GAS_STATION",
    city: "Addis Ababa",
    area: "Meskel Square",
    address: "Meskel Square, beside the expressway",
    description:
      "Central filling station that is easiest to reach on the way out of town; card payment works most days.",
    lat: 9.0106,
    lng: 38.7657,
    rating: 3.9,
    reviewCount: 141,
    priceLevel: 2,
    tags: ["petrol", "diesel", "cards", "central"],
    highlight: "On the way to the expressway",
    featured: false,
  },
  {
    slug: "oil-libya-megenagna",
    name: "Oil Libya — Megenagna",
    kind: "GAS_STATION",
    city: "Addis Ababa",
    area: "Megenagna",
    address: "Ring Road, Megenagna",
    description:
      "Large station on the Ring Road with several pumps, a tyre check bay and a café to wait in.",
    lat: 9.0203,
    lng: 38.8019,
    rating: 4.1,
    reviewCount: 119,
    priceLevel: 2,
    tags: ["petrol", "diesel", "tyres", "café"],
    highlight: "Many pumps, short wait",
    featured: false,
  },
  {
    slug: "lycee-guebre-mariam",
    name: "Lycée Guebre-Mariam",
    kind: "SCHOOL",
    city: "Addis Ababa",
    area: "Arada",
    address: "Winston Churchill Avenue",
    description:
      "French-curriculum school running from primary through secondary, with a bilingual French and Amharic programme.",
    lat: 9.0298,
    lng: 38.7607,
    rating: 4.5,
    reviewCount: 87,
    priceLevel: null,
    tags: ["french curriculum", "primary", "secondary"],
    highlight: "French and Amharic programmes",
    featured: true,
  },
  {
    slug: "sandford-international-school",
    name: "Sandford International School",
    kind: "SCHOOL",
    city: "Addis Ababa",
    area: "Old Airport",
    address: "Old Airport, near Sarbet",
    description:
      "International school following the IB pathway from early years to diploma, with a large campus and bus service.",
    lat: 8.9956,
    lng: 38.7581,
    rating: 4.6,
    reviewCount: 132,
    priceLevel: null,
    tags: ["international", "ib", "bus service"],
    highlight: "IB diploma programme",
    featured: false,
  },
  {
    slug: "hillside-school-shiro-meda",
    name: "Hillside School — Shiro Meda",
    kind: "SCHOOL",
    city: "Addis Ababa",
    area: "Shiro Meda",
    address: "Entoto road, Shiro Meda",
    description:
      "English-medium school on the Entoto road with a primary and middle-years campus and an after-school club programme.",
    lat: 9.0404,
    lng: 38.7634,
    rating: 4.4,
    reviewCount: 96,
    priceLevel: null,
    tags: ["english medium", "primary", "after-school clubs"],
    highlight: "On the Entoto road",
    featured: false,
  },
];

/**
 * Adds the everyday-service places without touching anything already saved, so
 * an edited or OSM-imported row keeps its content and ratings.
 */
export async function ensureSeedPlaces(): Promise<void> {
  const { count } = await prisma.place.createMany({
    data: SERVICE_PLACES,
    skipDuplicates: true,
  });

  if (count > 0) {
    logger.info({ count }, "Seeded hospitals, pharmacies, fuel stations and schools");
  }
}
