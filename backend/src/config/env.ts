import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN_DAYS: z.coerce.number().positive().default(7),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  CORS_EXTRA_ORIGINS: z.string().optional().default(""),
  PUBLIC_API_URL: z.string().optional().default(""),
  // Secure cookie flag. Left empty it follows NODE_ENV; set `false` only while
  // the site is served over plain HTTP, where browsers discard Secure cookies.
  COOKIE_SECURE: z.enum(["true", "false"]).or(z.literal("")).optional(),
  UPLOAD_DIR: z.string().default("./uploads"),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(25),
  SMS_PROVIDER: z.enum(["console", "knock", "twilio"]).default("console"),
  SMS_FROM: z.string().default("CommunityHub"),
  KNOCK_API_KEY: z.string().optional().default(""),
  KNOCK_SMS_WORKFLOW: z.string().default("phone-verification"),
  TWILIO_ACCOUNT_SID: z.string().optional().default(""),
  TWILIO_AUTH_TOKEN: z.string().optional().default(""),
  TWILIO_FROM: z.string().optional().default(""),
  // How often automatic event import re-reads its online sources. 0 disables
  // the timer (the boot sync still runs when an admin asks for it).
  EVENTS_SYNC_MINUTES: z.coerce.number().int().min(0).default(180),
  // Comma-separated Gemini keys used by the event extractor. The pool rotates
  // to the next key when one reports its quota as exhausted.
  GEMINI_API_KEYS: z.string().optional().default(""),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash"),
  // Tried once the primary model's daily quota is spent on every key.
  GEMINI_MODEL_FALLBACK: z.string().default("gemini-3.5-flash-lite"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with a readable explanation instead of undefined behaviour later.
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";

const extraOrigins = env.CORS_EXTRA_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const allowedOrigins = Array.from(
  new Set([env.CLIENT_ORIGIN, ...extraOrigins]),
);

export const cookieSecure =
  env.COOKIE_SECURE === undefined || env.COOKIE_SECURE === ""
    ? isProduction
    : env.COOKIE_SECURE === "true";
export const isConsoleSms = env.SMS_PROVIDER === "console";
/** Only expose OTP codes to the client in local development with the console provider. */
export const exposeDevCodes = !isProduction && isConsoleSms;
