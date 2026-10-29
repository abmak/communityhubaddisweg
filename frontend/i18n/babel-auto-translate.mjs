/**
 * Build-time translator.
 *
 * Wraps static system copy in the runtime translator `__tt` so every screen
 * follows the selected language without a hand-written key per string:
 *
 *   <h1>Home</h1>              ->  <h1>{__tt("Home")}</h1>
 *   <input placeholder="Search" /> ->  <input placeholder={__tt("Search")} />
 *   toast.success("Saved")     ->  toast.success(__tt("Saved"))
 *
 * Only literals written by us are touched. Anything that comes from the API —
 * posts, comments, names, event descriptions, messages — flows through
 * expressions and is left exactly as the member wrote it.
 */

import path from "node:path";
import rules from "./phrase-rules.cjs";

export default function autoTranslate(babel, options = {}) {
  const t = babel.types;
  const root = options.root || process.cwd();
  const collect = typeof options.collect === "function" ? options.collect : null;
  const i18nModule = path.resolve(root, "src/lib/i18n");

  function shouldSkipFile(filename) {
    if (!filename) return true;
    const normalized = filename.split(path.sep).join("/");
    return normalized.startsWith(i18nModule.split(path.sep).join("/"));
  }

  function record(state, text) {
    if (collect) collect(text, state.file.opts.filename);
  }

  function isInsideSkippedElement(nodePath) {
    let current = nodePath.parentPath;
    while (current) {
      if (current.isJSXElement()) {
        const name = current.node.openingElement.name;
        if (name.type === "JSXIdentifier" && rules.SKIP_ELEMENTS.has(name.name)) return true;
      }
      current = current.parentPath;
    }
    return false;
  }

  function callTt(text) {
    return t.callExpression(t.identifier("__tt"), [t.stringLiteral(text)]);
  }

  function importPathFor(filename) {
    let relative = path
      .relative(path.dirname(filename), i18nModule)
      .split(path.sep)
      .join("/");
    if (!relative.startsWith(".")) relative = `./${relative}`;
    return relative;
  }

  return {
    name: "auto-translate",
    visitor: {
      Program: {
        exit(programPath, state) {
          if (!state.__autoTranslateNeedsImport) return;
          const filename = state.file.opts.filename;
          if (!filename) return;
          const already = programPath.node.body.some(
            (node) =>
              node.type === "ImportDeclaration" &&
              node.specifiers.some((spec) => spec.local && spec.local.name === "__tt"),
          );
          if (already) return;
          const declaration = t.importDeclaration(
            [t.importSpecifier(t.identifier("__tt"), t.identifier("tt"))],
            t.stringLiteral(importPathFor(filename)),
          );
          programPath.unshiftContainer("body", declaration);
        },
      },

      JSXText(nodePath, state) {
        const filename = state.file.opts.filename;
        if (shouldSkipFile(filename)) return;
        const raw = nodePath.node.value;
        const text = rules.normalize(raw);
        if (!rules.isTranslatable(text)) return;
        if (isInsideSkippedElement(nodePath)) return;

        record(state, text);
        state.__autoTranslateNeedsImport = true;

        const children = [];
        const singleLine = !raw.includes("\n");
        if (singleLine && /^\s/.test(raw)) children.push(t.jsxExpressionContainer(t.stringLiteral(" ")));
        children.push(t.jsxExpressionContainer(callTt(text)));
        if (singleLine && /\s$/.test(raw)) children.push(t.jsxExpressionContainer(t.stringLiteral(" ")));
        nodePath.replaceWithMultiple(children);
      },

      // Copy chosen by a ternary or `&&` inside JSX is invisible to JSXText:
      // the branch is a string expression. Only the result branches are
      // wrapped — comparison operands such as `role === "ADMIN"` are left
      // alone, and attribute values (class names, URLs) are never touched.
      JSXExpressionContainer(nodePath, state) {
        const filename = state.file.opts.filename;
        if (shouldSkipFile(filename)) return;

        // Display attributes such as title={flag ? "A" : "B"} are translated by
        // the component that renders them, so their literals only need to
        // reach the catalog. Class names, styles and handlers are ignored.
        let recordOnly = false;
        if (nodePath.parentPath.isJSXAttribute()) {
          const name = nodePath.parentPath.node.name;
          if (name.type !== "JSXIdentifier" || !rules.ATTRIBUTES.has(name.name)) return;
          recordOnly = true;
        }

        const wrapLiteral = (literalPath) => {
          const text = rules.normalize(literalPath.node.value);
          if (!rules.isTranslatable(text)) return;
          if (recordOnly) return record(state, text);
          // A branch already written in an Ethiopian language is a hand-made
          // translation; wrapping it would translate it a second time.
          if (/[\u1200-\u137f]/.test(text)) return;
          record(state, text);
          state.__autoTranslateNeedsImport = true;
          literalPath.replaceWith(callTt(text));
        };

        const visit = (expressionPath) => {
          if (!expressionPath || !expressionPath.node) return;
          if (expressionPath.isStringLiteral()) return wrapLiteral(expressionPath);
          if (expressionPath.isConditionalExpression()) {
            visit(expressionPath.get("consequent"));
            visit(expressionPath.get("alternate"));
            return;
          }
          if (expressionPath.isLogicalExpression()) return visit(expressionPath.get("right"));
          if (expressionPath.isParenthesizedExpression()) return visit(expressionPath.get("expression"));
          if (expressionPath.isTSAsExpression()) return visit(expressionPath.get("expression"));
        };

        visit(nodePath.get("expression"));
      },

      JSXAttribute(nodePath, state) {
        const filename = state.file.opts.filename;
        if (shouldSkipFile(filename)) return;
        const name = nodePath.node.name;
        if (name.type !== "JSXIdentifier" || !rules.ATTRIBUTES.has(name.name)) return;

        const value = nodePath.node.value;
        let literal = null;
        if (value && value.type === "StringLiteral") literal = value;
        else if (value && value.type === "JSXExpressionContainer" && value.expression.type === "StringLiteral") {
          literal = value.expression;
        }
        if (!literal) return;

        const text = rules.normalize(literal.value);
        if (!rules.isTranslatable(text)) return;

        record(state, text);
        state.__autoTranslateNeedsImport = true;
        nodePath.node.value = t.jsxExpressionContainer(callTt(text));
      },

      // Display labels kept in plain data (tabs, filters, nav entries) are not
      // rewritten automatically — they flow through expressions — but their
      // copy still belongs in the catalog so a call site can use tt(label).
      ObjectProperty(nodePath, state) {
        if (!collect) return;
        const filename = state.file.opts.filename;
        if (shouldSkipFile(filename)) return;
        const key = nodePath.node.key;
        if (key.type !== "Identifier") return;
        if (!["label", "title", "description", "hint", "subtitle"].includes(key.name)) return;
        const value = nodePath.node.value;
        if (value.type !== "StringLiteral") return;
        const text = rules.normalize(value.value);
        if (!rules.isTranslatable(text)) return;
        record(state, text);
      },

      CallExpression(nodePath, state) {
        const filename = state.file.opts.filename;
        if (shouldSkipFile(filename)) return;
        const callee = nodePath.node.callee;

        // Hand-wrapped copy (dynamic labels, ternaries) still belongs in the
        // catalog, so record it instead of wrapping it twice.
        if (
          callee.type === "Identifier" &&
          (callee.name === "tt" || callee.name === "__tt") &&
          nodePath.node.arguments[0]?.type === "StringLiteral"
        ) {
          const wrapped = rules.normalize(nodePath.node.arguments[0].value);
          if (rules.isTranslatable(wrapped)) record(state, wrapped);
          return;
        }

        if (!rules.isToastCallee(callee) && !rules.isBrowserDialog(callee)) return;

        const first = nodePath.node.arguments[0];
        if (!first || first.type !== "StringLiteral") return;
        const text = rules.normalize(first.value);
        if (!rules.isTranslatable(text)) return;

        record(state, text);
        state.__autoTranslateNeedsImport = true;
        nodePath.node.arguments[0] = callTt(text);
      },

      AssignmentExpression(nodePath, state) {
        const filename = state.file.opts.filename;
        if (shouldSkipFile(filename)) return;
        const left = nodePath.node.left;
        if (
          left.type !== "MemberExpression" ||
          left.object.type !== "Identifier" ||
          left.object.name !== "document" ||
          left.property.type !== "Identifier" ||
          left.property.name !== "title"
        ) {
          return;
        }
        const right = nodePath.node.right;
        if (right.type !== "StringLiteral") return;
        const text = rules.normalize(right.value);
        if (!rules.isTranslatable(text)) return;

        record(state, text);
        state.__autoTranslateNeedsImport = true;
        nodePath.node.right = callTt(text);
      },
    },
  };
}
