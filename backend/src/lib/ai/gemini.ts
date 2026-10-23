import { env } from "../../config/env";
import { prisma } from "../prisma";
import { logger } from "../logger";

/**
 * The Gemini key pool used by the event extractor.
 *
 * Several keys with their own free-tier quotas are far more useful together
 * than apart, so every request walks the pool: the first key that is not
 * cooling down takes the call, a 429 parks that key for as long as Google asks
 * and hands the request to the next key. Usage is persisted per key so the
 * admin page can show how much of each quota has been spent.
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const REQUEST_TIMEOUT_MS = 45_000;
const DEFAULT_COOLDOWN_MS = 60_000;

function readKeys(): string[] {
  return Array.from(
    new Set(
      env.GEMINI_API_KEYS.split(",")
        .map((key) => key.trim())
        .filter(Boolean),
    ),
  );
}

const keys = readKeys();

/** Epoch ms until a key must be left alone, per key and model ("index:model"). */
const cooldowns = new Map<string, number>();

/** One read of the persisted cooldowns per process, so restarts stay honest. */
let hydration: Promise<void> | null = null;
function hydrateCooldowns(): Promise<void> {
  if (hydration) return hydration;
  hydration = (async () => {
    try {
      const rows = await prisma.aiKeyUsage.findMany({ select: { keyIndex: true, cooldowns: true, cooldownUntil: true } });
      const now = Date.now();
      for (const row of rows) {
        const stored = row.cooldowns;
        if (stored && typeof stored === "object" && !Array.isArray(stored)) {
          for (const [model, value] of Object.entries(stored as Record<string, unknown>)) {
            const until = typeof value === "string" ? Date.parse(value) : 0;
            if (Number.isFinite(until) && until > now) {
              cooldowns.set(`${row.keyIndex}:${model}`, until);
            }
          }
        }
      }
    } catch (error) {
      logger.warn({ err: error }, "Could not restore Gemini key cooldowns");
    }
  })();
  return hydration;
}

/**
 * When this key is usable again: 0 while any model still has quota, otherwise
 * the earliest moment one of its model quotas comes back.
 */
function cooldownFor(index: number, fallback: number): number {
  const now = Date.now();
  const slots = geminiModels().map((model) => cooldowns.get(`${index}:${model}`) ?? 0);
  const known = slots.some((value) => value > 0);
  if (!known) return fallback > now ? fallback : 0;
  const future = slots.filter((value) => value > now);
  if (future.length < slots.length) return 0;
  return Math.min(...future);
}
let nextIndex = 0;

export type GeminiFailure = "NO_KEYS" | "RATE_LIMITED" | "REQUEST_FAILED";

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly code: GeminiFailure,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

export function geminiKeyCount(): number {
  return keys.length;
}

export function geminiModel(): string {
  return env.GEMINI_MODEL.trim() || "gemini-3.5-flash";
}

/** Primary model first, then a lighter one with its own daily quota. */
export function geminiModels(): string[] {
  const fallback = env.GEMINI_MODEL_FALLBACK.trim() || "gemini-3.5-flash-lite";
  return Array.from(new Set([geminiModel(), fallback]));
}

/** Never enough of a key to reuse it — just enough to tell two keys apart. */
export function maskKey(key: string): string {
  if (key.length <= 12) return `${key.slice(0, 3)}…`;
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

function retryDelayMs(details: unknown): number {
  if (!Array.isArray(details)) return DEFAULT_COOLDOWN_MS;
  for (const detail of details) {
    if (!detail || typeof detail !== "object") continue;
    const record = detail as Record<string, unknown>;
    const delay = record.retryDelay;
    if (typeof delay !== "string") continue;
    const seconds = Number.parseFloat(delay.replace(/s$/, ""));
    // Quota resets are usually minutes, but a daily cap reports hours. Honour
    // either, up to a day, so an exhausted key is not retried for nothing.
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 24 * 60 * 60 * 1000);
  }
  return DEFAULT_COOLDOWN_MS;
}

type KeyCallResult =
  | { ok: true; text: string; tokens: number; grounded: boolean }
  | { ok: false; kind: "rate-limited" | "failed"; message: string; cooldownMs?: number };


async function callKey(
  key: string,
  prompt: string,
  model: string,
  grounded: boolean,
  temperature: number,
  maxOutputTokens: number | undefined,
): Promise<KeyCallResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature,
      ...(maxOutputTokens ? { maxOutputTokens } : {}),
    },
    ...(grounded ? { tools: [{ google_search: {} }] } : {}),
  };

  try {
    const response = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          error?: { status?: string; message?: string; details?: unknown };
          candidates?: Array<{
            finishReason?: string;
            content?: { parts?: Array<{ text?: string }> };
            groundingMetadata?: { groundingChunks?: unknown[] };
          }>;
          usageMetadata?: { totalTokenCount?: number };
        }
      | null;

    if (!response.ok || payload?.error) {
      const status = payload?.error?.status ?? `HTTP ${response.status}`;
      const message = payload?.error?.message ?? `Gemini responded ${response.status}`;
      if (response.status === 429 || status === "RESOURCE_EXHAUSTED") {
        return { ok: false, kind: "rate-limited", message, cooldownMs: retryDelayMs(payload?.error?.details) };
      }
      // Overloaded models come back as 503/UNAVAILABLE; give that key a short
      // breather instead of hammering it for every source in the same sync.
      if (response.status >= 500 || status === "UNAVAILABLE") {
        return { ok: false, kind: "failed", message: `${status}: ${message}`.slice(0, 400), cooldownMs: 20_000 };
      }
      return { ok: false, kind: "failed", message: `${status}: ${message}`.slice(0, 400) };
    }

    const candidate = payload?.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .filter(Boolean)
      .join("");

    if (!text.trim()) {
      return {
        ok: false,
        kind: "failed",
        message: `Gemini returned no text (${candidate?.finishReason ?? "unknown reason"})`,
      };
    }

    return {
      ok: true,
      text,
      tokens: payload?.usageMetadata?.totalTokenCount ?? 0,
      grounded: Boolean(candidate?.groundingMetadata?.groundingChunks?.length),
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? `Gemini did not answer within ${REQUEST_TIMEOUT_MS / 1000}s`
        : error instanceof Error
          ? error.message
          : String(error);
    return { ok: false, kind: "failed", message: message.slice(0, 400) };
  } finally {
    clearTimeout(timer);
  }
}

interface UsagePatch {
  requests?: number;
  successes?: number;
  rateLimited?: number;
  failures?: number;
  tokens?: number;
  lastStatus: string;
  lastError?: string | null;
  cooldownUntil?: Date | null;
}

function cooldownState(index: number): Record<string, string> {
  const state: Record<string, string> = {};
  const now = Date.now();
  for (const model of geminiModels()) {
    const until = cooldowns.get(`${index}:${model}`) ?? 0;
    if (until > now) state[model] = new Date(until).toISOString();
  }
  return state;
}

async function recordUsage(index: number, patch: UsagePatch): Promise<void> {
  const increment = (value: number | undefined) => (value ? { increment: value } : undefined);
  await prisma.aiKeyUsage
    .upsert({
      where: { keyIndex: index },
      create: {
        keyIndex: index,
        maskedKey: maskKey(keys[index] ?? ""),
        requests: patch.requests ?? 0,
        successes: patch.successes ?? 0,
        rateLimited: patch.rateLimited ?? 0,
        failures: patch.failures ?? 0,
        tokens: patch.tokens ?? 0,
        lastUsedAt: new Date(),
        lastStatus: patch.lastStatus,
        lastError: patch.lastError ?? null,
        cooldownUntil: patch.cooldownUntil ?? null,
        cooldowns: cooldownState(index),
      },
      update: {
        maskedKey: maskKey(keys[index] ?? ""),
        lastUsedAt: new Date(),
        lastStatus: patch.lastStatus,
        lastError: patch.lastError ?? null,
        cooldowns: cooldownState(index),
        ...(patch.cooldownUntil !== undefined ? { cooldownUntil: patch.cooldownUntil } : {}),
        requests: increment(patch.requests),
        successes: increment(patch.successes),
        rateLimited: increment(patch.rateLimited),
        failures: increment(patch.failures),
        tokens: increment(patch.tokens),
      },
    })
    .catch((error) => {
      logger.warn({ err: error, key: index + 1 }, "Could not record Gemini key usage");
    });
}

export interface GenerationOptions {
  prompt: string;
  /** Let Gemini search the web before answering (Google Search grounding). */
  grounded?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  model?: string;
}

export interface GenerationResult<T> {
  data: T;
  keyIndex: number;
  model: string;
  grounded: boolean;
  tokens: number;
}

/** Models sometimes wrap JSON in fences or prose even in JSON mode. */
function parseJson<T>(text: string): T | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }
}

/**
 * Runs one JSON-mode generation, rotating through the pool. Throws GeminiError
 * when every key is cooling down or the request itself is broken.
 */
export async function generateJson<T>(options: GenerationOptions): Promise<GenerationResult<T>> {
  if (keys.length === 0) {
    throw new GeminiError(
      "No Gemini API keys are configured. Add GEMINI_API_KEYS to the server environment.",
      "NO_KEYS",
    );
  }

  await hydrateCooldowns();

  const grounded = options.grounded === true;
  const temperature = options.temperature ?? 0.2;
  const models = options.model?.trim() ? [options.model.trim()] : geminiModels();

  let lastFailure = "";
  let soonestCooldown = Number.POSITIVE_INFINITY;

  // A daily cap applies per key *and* model, so the pool walks the primary
  // model first and then the lighter fallback before giving up.
  for (const model of models) {
    for (let step = 0; step < keys.length; step += 1) {
      const index = (nextIndex + step) % keys.length;
      const slot = `${index}:${model}`;
      const until = cooldowns.get(slot) ?? 0;
      if (until > Date.now()) {
        soonestCooldown = Math.min(soonestCooldown, until);
        continue;
      }

      const result = await callKey(keys[index]!, options.prompt, model, grounded, temperature, options.maxOutputTokens);

    if (result.ok) {
      const parsed = parseJson<T>(result.text);
      if (parsed === null) {
        await recordUsage(index, {
          requests: 1,
          failures: 1,
          lastStatus: "BAD_JSON",
          lastError: result.text.slice(0, 300),
        });
        lastFailure = "Gemini answered with something that was not JSON.";
        continue;
      }

      await recordUsage(index, {
        requests: 1,
        successes: 1,
        tokens: result.tokens,
        lastStatus: "OK",
        lastError: null,
        cooldownUntil: null,
      });
      cooldowns.delete(slot);
      nextIndex = (index + 1) % keys.length;
      return {
        data: parsed,
        keyIndex: index,
        model,
        grounded: result.grounded,
        tokens: result.tokens,
      };
    }

    if (result.kind === "rate-limited") {
      const cooldownMs = result.cooldownMs ?? DEFAULT_COOLDOWN_MS;
      const until = Date.now() + cooldownMs;
      cooldowns.set(slot, until);
      soonestCooldown = Math.min(soonestCooldown, until);
      const everyModelParked = geminiModels().every(
        (candidate) => (cooldowns.get(`${index}:${candidate}`) ?? 0) > Date.now(),
      );
      await recordUsage(index, {
        requests: 1,
        rateLimited: 1,
        lastStatus: "RATE_LIMITED",
        lastError: result.message.slice(0, 400),
        // Only persist "unusable" when the fallback model is parked too; after a
        // restart the panel can then trust the stored value.
        cooldownUntil: everyModelParked ? new Date(until) : null,
      });
      logger.info(
        { key: index + 1, model, cooldownSeconds: Math.round(cooldownMs / 1000) },
        "Gemini key hit its quota, rotating",
      );
      continue;
    }

    if (result.cooldownMs) {
      const until = Date.now() + result.cooldownMs;
      cooldowns.set(slot, until);
      soonestCooldown = Math.min(soonestCooldown, until);
    }
    await recordUsage(index, {
      requests: 1,
      failures: 1,
      lastStatus: "ERROR",
      lastError: result.message,
      ...(result.cooldownMs ? { cooldownUntil: new Date(Date.now() + result.cooldownMs) } : {}),
    });
    lastFailure = result.message;
    }
  }

  if (Number.isFinite(soonestCooldown)) {
    const waitSeconds = Math.max(1, Math.round((soonestCooldown - Date.now()) / 1000));
    throw new GeminiError(
      `All ${keys.length} Gemini keys are busy or rate limited on every model. The next one frees up in ${waitSeconds}s.`,
      "RATE_LIMITED",
    );
  }

  throw new GeminiError(lastFailure || "Every Gemini key failed this request.", "REQUEST_FAILED");
}

export interface AiKeySnapshot {
  index: number;
  maskedKey: string;
  requests: number;
  successes: number;
  rateLimited: number;
  failures: number;
  tokens: number;
  lastUsedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  cooldownUntil: string | null;
  available: boolean;
}

/** Per-key usage for the admin page; configured keys always appear. */
export async function aiKeySnapshot(): Promise<AiKeySnapshot[]> {
  await hydrateCooldowns();
  const rows = await prisma.aiKeyUsage.findMany({ orderBy: { keyIndex: "asc" } });
  const byIndex = new Map(rows.map((row) => [row.keyIndex, row]));
  const now = Date.now();

  return keys.map((key, index) => {
    const row = byIndex.get(index);
    const cooldown = cooldownFor(index, row?.cooldownUntil?.getTime() ?? 0);
    return {
      index: index + 1,
      maskedKey: maskKey(key),
      requests: row?.requests ?? 0,
      successes: row?.successes ?? 0,
      rateLimited: row?.rateLimited ?? 0,
      failures: row?.failures ?? 0,
      tokens: row?.tokens ?? 0,
      lastUsedAt: row?.lastUsedAt?.toISOString() ?? null,
      lastStatus: row?.lastStatus ?? null,
      lastError: row?.lastError ?? null,
      cooldownUntil: cooldown > now ? new Date(cooldown).toISOString() : null,
      available: cooldown <= now,
    };
  });
}
