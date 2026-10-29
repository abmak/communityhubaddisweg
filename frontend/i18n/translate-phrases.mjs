/**
 * Translates the extracted UI phrases with the project's configured Gemini
 * keys and writes frontend/src/lib/locales/<lang>.json.
 *
 *   node frontend/i18n/translate-phrases.mjs [am|om|ti ...]
 *
 * Progress is written after every language, so a quota hiccup can be resumed
 * by running the script again for the missing language.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const phrasesFile = path.resolve(root, ".tmp/i18n-phrases.json");
const outDir = path.resolve(root, "frontend/src/lib/locales");

const env = fs.readFileSync(path.resolve(root, "backend/.env"), "utf8");
const keyLine = env.split(/\r?\n/).find((line) => line.startsWith("GEMINI_API_KEYS="));
if (!keyLine) throw new Error("GEMINI_API_KEYS is not configured");
const keys = keyLine
  .slice("GEMINI_API_KEYS=".length)
  .split(",")
  .map((key) => key.trim())
  .filter(Boolean);

// gemini-3.5-flash shares a small daily free-tier quota with the app's event
// importer; the lite model has its own allowance and is enough for UI copy.
const MODEL = "gemini-3.1-flash-lite";
const BATCH_SIZE = 70;
const LANGUAGE_NAMES = {
  am: "Amharic (አማርኛ, Ge'ez script)",
  om: "Afaan Oromoo (Latin script)",
  ti: "Tigrinya (ትግርኛ, Ge'ez script)",
};

// --redo=<file.json> re-translates the listed English phrases, replacing the
// stored values (used to repair batches that slipped into the wrong language).
const args = process.argv.slice(2);
const redoFile = args.find((arg) => arg.startsWith("--redo="))?.slice("--redo=".length);
const redoPhrases = redoFile
  ? JSON.parse(fs.readFileSync(path.resolve(root, redoFile), "utf8"))
  : null;

const requested = args.filter((code) => LANGUAGE_NAMES[code]);
const languages = requested.length ? requested : Object.keys(LANGUAGE_NAMES);

const { byFile } = JSON.parse(fs.readFileSync(phrasesFile, "utf8"));

function fileLabel(file) {
  return file
    .replace(/^src\//, "")
    .replace(/\.tsx$/, "")
    .replace(/\//g, " › ");
}

// One flat, deduplicated list keeps the number of requests small; the prompt
// carries enough product context for ambiguous short labels.
const allPhrases = [...new Set(Object.values(byFile).flat())].sort();
const batches = [];
for (let index = 0; index < allPhrases.length; index += BATCH_SIZE) {
  batches.push({
    file: "the app's screens",
    phrases: allPhrases.slice(index, index + BATCH_SIZE),
  });
}

let keyCursor = 0;
let requestCount = 0;

function nextKey() {
  const key = keys[keyCursor % keys.length];
  keyCursor += 1;
  return key;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function askGemini(prompt) {
  let lastError = "";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const key = nextKey();
    requestCount += 1;
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 8192,
              responseMimeType: "application/json",
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
          signal: AbortSignal.timeout(90000),
        },
      );
      const body = await response.text();
      if (response.ok) {
        const parsed = JSON.parse(body);
        const text = (parsed.candidates?.[0]?.content?.parts || [])
          .map((part) => part.text || "")
          .join("")
          .trim();
        if (!text) {
          lastError = "empty response";
          continue;
        }
        return text;
      }
      lastError = `${response.status} ${body.slice(0, 160)}`;
      if (response.status === 429 || response.status === 503) await sleep(2500 + attempt * 1500);
      else if (response.status >= 500) await sleep(1500);
      else throw new Error(`Gemini rejected the request: ${lastError}`);
    } catch (error) {
      lastError = error.message;
      await sleep(1200);
    }
  }
  throw new Error(`Gemini did not answer after retries (${lastError})`);
}

function parseTranslationArray(text, phrases) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start < 0 || end <= start) throw new Error("response was not a JSON array");
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  }
  if (Array.isArray(parsed)) {
    const entries = {};
    phrases.forEach((phrase, index) => {
      if (typeof parsed[index] === "string") entries[phrase] = parsed[index];
    });
    return entries;
  }
  // Tolerate an object keyed by the source strings from a retry.
  if (parsed && typeof parsed === "object") return parsed;
  throw new Error("response was not a translation list");
}

const SYSTEM = `You translate interface copy for Addis Gebeta, an Ethiopian community web app (feed, places, events, cinema, sports, a picture quiz, messaging, navigation and a trip-safety page).

Rules:
- Translate only the strings given, into {{LANGUAGE}}. Keep the tone friendly and concise, the way software labels, buttons and short explanations read.
- Keep brand and product names unchanged: Addis Gebeta, Addis Maed, OpenStreetMap, Telegram, YouTube, Google, WhatsApp, Gemini, OTP, GPS, ATM, EV, RSS.
- Keep personal names, place names, street names, phone numbers and codes (911, 907, 991) exactly as written.
- Preserve punctuation, capitalisation style, emoji and ellipses (…).
- Use Ge'ez script for Amharic and Tigrinya; Latin script for Afaan Oromoo.
- Amharic and Tigrinya are different languages that share the Ge'ez script. Write {{LANGUAGE}} only: never answer in the other one, even if the source mentions Ethiopia, Amharic or Addis Ababa. Tigrinya uses its own grammar, pronouns and vocabulary (for example ናይ, እዩ, ኣሎ, እዮም, ናብ, ካብ, ኣብ, ምስ, ብዛዕባ, ሕጂ, ኩሉ, ጥራይ), and its verbs agree with Tigrinya rules.
- Never merge, split or skip strings.
- Use ordinary punctuation; if a translation needs a quotation mark, use single quotes or the local quotation style, never an unescaped double quote.
- Reply with a JSON array of translations in exactly the same order as the input array, with the same number of entries. No commentary, no keys.`;

function promptFor(language, batch) {
  const header = SYSTEM.replace("{{LANGUAGE}}", LANGUAGE_NAMES[language]);
  return `${header}

These are interface strings from ${fileLabel(batch.file)} (navigation, feed, places, events, cinema, sports, messages, settings, navigation directions, trip safety and the admin workspace).

Strings:
${JSON.stringify(batch.phrases, null, 0)}`;
}

function looksTranslated(language, source, value) {
  if (typeof value !== "string" || !value.trim()) return false;
  if (language === "am" || language === "ti") {
    return /[\u1200-\u137f]/.test(value) || !/[A-Za-z]{3}/.test(source);
  }
  return /[A-Za-z]/.test(value);
}

async function translateLanguage(language) {
  const outFile = path.resolve(outDir, `${language}.json`);
  const existing = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")) : {};
  const catalog = { ...existing };

  const missing = redoPhrases
    ? redoPhrases.filter((phrase) => allPhrases.includes(phrase) || catalog[phrase])
    : allPhrases.filter((phrase) => !catalog[phrase]);
  const missingBatches = [];
  for (let index = 0; index < missing.length; index += BATCH_SIZE) {
    missingBatches.push({ file: "the app's screens", phrases: missing.slice(index, index + BATCH_SIZE) });
  }

  console.log(
    `\n${language}: ${missingBatches.reduce((sum, b) => sum + b.phrases.length, 0)} phrases to ${redoPhrases ? "re-translate" : "translate"}`,
  );

  for (const [position, batch] of missingBatches.entries()) {
    let pending = batch.phrases;

    try {
      for (let attempt = 0; attempt < 5 && pending.length; attempt += 1) {
        const text = await askGemini(promptFor(language, { ...batch, phrases: pending }));
        const object = parseTranslationArray(text, pending);
        const unresolved = pending.filter(
          (phrase) => !object[phrase] || !looksTranslated(language, phrase, object[phrase]),
        );
        for (const phrase of pending) {
          const value = object[phrase];
          if (typeof value === "string" && value.trim()) catalog[phrase] = value.trim();
        }
        if (!unresolved.length) break;
        // Retry the leftovers on their own so one bad row cannot hold the batch.
        pending = unresolved.slice(0, 20);
        if (attempt === 4) console.warn(`  ${pending.length} phrases left untranslated in this batch`);
      }
    } catch (error) {
      console.warn(`  batch failed: ${error.message}`);
    }

    fs.mkdirSync(outDir, { recursive: true });
    const sorted = Object.fromEntries(Object.entries(catalog).sort((a, b) => a[0].localeCompare(b[0])));
    fs.writeFileSync(outFile, `${JSON.stringify(sorted, null, 2)}\n`);
    console.log(
      `  [${position + 1}/${missingBatches.length}] ${batch.file} · ${batch.phrases.length} strings · ${requestCount} requests`,
    );
    await sleep(250);
  }

  console.log(`${language}: catalog has ${Object.keys(catalog).length} phrases`);
}

fs.mkdirSync(outDir, { recursive: true });
for (const language of languages) {
  await translateLanguage(language);
}
console.log("\ndone");
