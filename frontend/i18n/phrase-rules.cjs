/**
 * Rules shared by the build-time translator and the phrase extractor so both
 * always agree on which strings are system UI copy.
 */

const ATTRIBUTES = new Set([
  "placeholder",
  "aria-label",
  "aria-description",
  "aria-placeholder",
  "title",
  "alt",
  "label",
  "description",
  "hint",
  "helperText",
  "emptyTitle",
  "emptyDescription",
  "confirmLabel",
  "cancelLabel",
  "submitLabel",
  "eyebrow",
  "subtitle",
  "caption",
  "kicker",
  "unit",
  "emptyLabel",
  "badge",
  "actionLabel",
  "placeholderText",
]);

const SKIP_ELEMENTS = new Set(["code", "pre", "kbd", "samp", "script", "style", "textarea"]);

function decodeEntities(raw) {
  return raw
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function normalize(raw) {
  return decodeEntities(raw).replace(/\s+/g, " ").trim();
}

const CJK = /[\u3040-\u30ff\u3400-\u9fff]/;

function isTranslatable(text) {
  if (!text || text.length < 2) return false;
  if (!/[A-Za-z]/.test(text)) return false;
  if (/^[\W\d_]+$/.test(text)) return false;
  // URLs, e-mail addresses, hashes and file names are not copy.
  if (/^(https?:|mailto:|www\.)/i.test(text)) return false;
  if (/^[\w.+-]+@[\w.-]+\.\w+$/.test(text)) return false;
  if (/^[\w-]+\.(js|ts|tsx|json|png|jpe?g|svg|webp|css)$/i.test(text)) return false;
  // Route fragments such as "/c/" are not copy.
  if (/^\/[A-Za-z0-9_-]*(\/[A-Za-z0-9_-]*)*$/.test(text)) return false;
  if (CJK.test(text)) return false;
  return true;
}

function isToastCallee(callee) {
  if (!callee) return false;
  if (callee.type === "Identifier") return callee.name === "toast";
  if (callee.type === "MemberExpression" && callee.object.type === "Identifier") {
    return callee.object.name === "toast";
  }
  return false;
}

function isBrowserDialog(callee) {
  return callee && callee.type === "Identifier" && (callee.name === "confirm" || callee.name === "alert");
}

module.exports = {
  ATTRIBUTES,
  SKIP_ELEMENTS,
  decodeEntities,
  normalize,
  isTranslatable,
  isToastCallee,
  isBrowserDialog,
};
