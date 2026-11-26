/**
 * Layer 1 (Architectural Constraint) snippet review.
 *
 * A small, dependency-free, tag-level static check for HTML / JSX / TSX snippets.
 * It is deliberately conservative and heuristic. It cannot see rendered output,
 * computed names, CSS, or runtime behavior, so it complements (never replaces)
 * automated checks in CI (Layer 4) and manual assistive technology testing.
 */

import { patternForFinding } from "./patterns.js";

export type Severity = "error" | "warning" | "info";

export interface Finding {
  rule: string;
  severity: Severity;
  layer: "L1";
  line: number;
  element: string;
  message: string;
  fix: string;
  /** How to make this class of mistake impossible by construction (the Layer 1 idea). */
  systemFix: string;
  /** Id of an implementation pattern (see get_pattern) that shows the system-level fix in code. */
  pattern?: string;
}

export interface ReviewResult {
  findings: Finding[];
  counts: Record<Severity, number>;
  skippedDueToSpread: number;
  caveat: string;
}

interface Tag {
  name: string;
  attrs: string;
  start: number;
  end: number; // index just after '>'
  selfClosing: boolean;
  line: number;
}

const CAVEAT =
  "Heuristic, tag-level check of a single snippet. It cannot detect computed names, CSS, focus order, " +
  "dynamic announcements or real assistive technology behavior. Treat a clean result as 'no obvious Layer 1 " +
  "violations found', not as proof of accessibility. Pair with automated checks in CI and manual testing.";

function scanTags(src: string): Tag[] {
  const tags: Tag[] = [];
  let i = 0;
  while (i < src.length) {
    if (src[i] === "<" && /[A-Za-z]/.test(src[i + 1] ?? "")) {
      let j = i + 1;
      while (j < src.length && /[A-Za-z0-9_.:-]/.test(src[j])) j++;
      const name = src.slice(i + 1, j);
      let depth = 0;
      let quote: string | null = null;
      let k = j;
      for (; k < src.length; k++) {
        const c = src[k];
        if (quote) {
          if (c === quote && src[k - 1] !== "\\") quote = null;
          continue;
        }
        if (c === '"' || c === "'" || c === "`") {
          quote = c;
          continue;
        }
        if (c === "{") depth++;
        else if (c === "}") depth--;
        else if (c === ">" && depth <= 0) break;
      }
      if (k >= src.length) break; // unterminated tag: stop scanning
      const attrs = src.slice(j, k);
      const line = src.slice(0, i).split("\n").length;
      tags.push({
        name,
        attrs,
        start: i,
        end: k + 1,
        selfClosing: attrs.trimEnd().endsWith("/"),
        line,
      });
      i = k + 1;
    } else {
      i++;
    }
  }
  return tags;
}

function hasAttr(attrs: string, name: string): boolean {
  return new RegExp(`(^|\\s)${name}(\\s*=|\\s|/|$)`, "i").test(attrs);
}

function attrValue(attrs: string, name: string): string | undefined {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{([^}]*)\\})`, "i"));
  if (!m) return undefined;
  return (m[1] ?? m[2] ?? m[3] ?? "").trim();
}

function hasSpread(attrs: string): boolean {
  return /\{\s*\.\.\./.test(attrs);
}

function innerOf(src: string, tag: Tag): string | undefined {
  if (tag.selfClosing) return undefined;
  const close = src.toLowerCase().indexOf(`</${tag.name.toLowerCase()}`, tag.end);
  if (close === -1) return undefined;
  return src.slice(tag.end, close);
}

/** True when the inner content could plausibly provide an accessible name. */
function innerHasName(inner: string | undefined): boolean {
  if (inner === undefined) return true; // unknown: do not flag
  if (inner.includes("{")) return true; // dynamic expression: cannot tell
  if (/<img[^>]*\salt\s*=\s*["'][^"']+["']/i.test(inner)) return true;
  if (/<svg[\s\S]*<title[\s>]/i.test(inner)) return true;
  if (/aria-label\s*=\s*["'][^"']+["']/i.test(inner)) return true;
  const text = inner.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  return text.length > 0;
}

const NON_SEMANTIC = new Set(["div", "span", "li", "td", "p", "section", "article", "i", "b"]);
const SKIP_INPUT_TYPES = new Set(["hidden", "submit", "button", "reset", "image"]);

/** Blank out JSX block comments and HTML comments, keeping line breaks so line numbers stay correct. */
function blankComments(text: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, " ");
  return text.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, blank).replace(/<!--[\s\S]*?-->/g, blank);
}

export function reviewMarkup(rawSrc: string): ReviewResult {
  const src = blankComments(rawSrc);
  const tags = scanTags(src);
  const findings: Finding[] = [];
  let skippedDueToSpread = 0;

  const add = (f: Omit<Finding, "layer">) => findings.push({ ...f, layer: "L1" });

  for (const t of tags) {
    const name = t.name.toLowerCase();
    const isHtmlTag = t.name === t.name.toLowerCase(); // lowercase = native element, not a component
    if (!isHtmlTag) continue;
    const spread = hasSpread(t.attrs);

    const hasClick = hasAttr(t.attrs, "onClick") || hasAttr(t.attrs, "onclick");
    const hasRole = hasAttr(t.attrs, "role");
    const hasTabIndex = hasAttr(t.attrs, "tabIndex");
    const hasKey = /(^|\s)on(key(down|up|press))\s*=/i.test(t.attrs);
    const el = `<${t.name}>`;

    // 1. Clickable non-semantic element
    if (NON_SEMANTIC.has(name) && hasClick) {
      if (!hasRole) {
        add({
          rule: "clickable-non-semantic",
          severity: "error",
          line: t.line,
          element: el,
          message: `${el} has a click handler but no role. It is not focusable or operable by keyboard and has no role for assistive technology.`,
          fix: "Use a native <button> (or <a href> for navigation).",
          systemFix:
            "Expose interaction only through a Button/Link component that renders native elements, and do not let the design system accept onClick on generic containers.",
        });
      } else if (!spread && (!hasTabIndex || !hasKey)) {
        add({
          rule: "role-missing-keyboard",
          severity: "error",
          line: t.line,
          element: el,
          message: `${el} declares role="${attrValue(t.attrs, "role") ?? ""}" with a click handler but lacks ${[
            !hasTabIndex ? "tabIndex" : "",
            !hasKey ? "a keyboard handler" : "",
          ]
            .filter(Boolean)
            .join(" and ")}.`,
          fix: "Prefer a native <button>. If a custom widget is unavoidable, add tabIndex={0} and Enter/Space handling.",
          systemFix: "Encode keyboard behavior inside the shared component so consumers cannot omit it.",
        });
      }
    }

    // 2. Anchor without href but with click, or href="#"
    if (name === "a") {
      const href = attrValue(t.attrs, "href");
      if (!spread && href === undefined && !hasAttr(t.attrs, "href") && hasClick) {
        add({
          rule: "anchor-without-href",
          severity: "error",
          line: t.line,
          element: el,
          message: "<a> with a click handler but no href is not keyboard focusable and is not exposed as a link.",
          fix: "Use <button> for actions, or give the <a> a real href for navigation.",
          systemFix: "Provide separate Link (navigation) and Button (action) components and lint against onClick-only anchors.",
        });
      } else if (href === "#") {
        add({
          rule: "anchor-hash-href",
          severity: "warning",
          line: t.line,
          element: el,
          message: 'href="#" makes a link that does not navigate. It is usually a button in disguise.',
          fix: "Use <button> for actions, or a real destination for navigation.",
          systemFix: "Reject placeholder hrefs in the Link component's types or lint rules.",
        });
      }
    }

    // 3. img without alt
    if (name === "img" && !spread && !hasAttr(t.attrs, "alt")) {
      add({
        rule: "img-alt",
        severity: "error",
        line: t.line,
        element: el,
        message: "<img> has no alt attribute.",
        fix: 'Add a meaningful alt, or alt="" if the image is purely decorative.',
        systemFix: "Make alt a required prop of the shared Image component so omission fails type checking.",
      });
    }

    // 4. Buttons and links without an accessible name
    if ((name === "button" || name === "a") && !spread) {
      const named =
        hasAttr(t.attrs, "aria-label") || hasAttr(t.attrs, "aria-labelledby") || hasAttr(t.attrs, "title");
      if (!named && !innerHasName(innerOf(src, t))) {
        add({
          rule: name === "button" ? "button-name" : "link-name",
          severity: "error",
          line: t.line,
          element: el,
          message: `<${name}> has no visible text or aria-label, so it has no accessible name (likely an icon-only control).`,
          fix: `Add visible text or aria-label to the <${name}>.`,
          systemFix:
            "Create an IconButton whose type requires `aria-label: string`, so an unnamed icon button cannot compile.",
        });
      }
    }

    // 5. Form controls without an associated label
    if ((name === "input" || name === "select" || name === "textarea") && !spread) {
      const type = (attrValue(t.attrs, "type") ?? "text").toLowerCase();
      if (!(name === "input" && SKIP_INPUT_TYPES.has(type))) {
        const named = hasAttr(t.attrs, "aria-label") || hasAttr(t.attrs, "aria-labelledby");
        const lastOpen = src.toLowerCase().lastIndexOf("<label", t.start);
        const lastClose = src.toLowerCase().lastIndexOf("</label", t.start);
        const wrapped = lastOpen > lastClose;
        if (!named && !wrapped) {
          const id = attrValue(t.attrs, "id");
          const staticId = id && !id.includes("{") && !id.includes("$") ? id.replace(/^["'`]|["'`]$/g, "") : undefined;
          const labelForPresent = staticId
            ? new RegExp(`(htmlFor|for)\\s*=\\s*["'{]\\s*["'\`]?${staticId}\\b`, "i").test(src)
            : true;
          const placeholder = name !== "select" && hasAttr(t.attrs, "placeholder");
          if (placeholder && (!id || (staticId && !labelForPresent))) {
            add({
              rule: "placeholder-as-label",
              severity: "error",
              line: t.line,
              element: el,
              message: `<${name}> has a placeholder but no label, aria-label or aria-labelledby${
                id ? ` (its id has no matching <label for> in this snippet)` : ""
              }. Placeholder text disappears on input and is not a reliable accessible name.`,
              fix: "Add a visible <label> (htmlFor/for plus id), or aria-label / aria-labelledby. Keep the placeholder only as a hint.",
              systemFix:
                "Render inputs only through a Field component that requires a label, and lint placeholder-only fields.",
            });
          } else if (!id) {
            add({
              rule: "input-label",
              severity: "error",
              line: t.line,
              element: el,
              message: `<${name}> has no aria-label, no id for a <label for>, and is not wrapped in a <label>.`,
              fix: "Associate a visible <label> (htmlFor/for plus id), or wrap the control in a <label>.",
              systemFix: "Render inputs only through a Field component that requires a label and wires id/aria-describedby itself.",
            });
          } else if (staticId && !labelForPresent) {
            add({
              rule: "input-label-unverified",
              severity: "info",
              line: t.line,
              element: el,
              message: `<${name} id="${staticId}"> has no matching <label for="${staticId}"> in this snippet.`,
              fix: "Confirm a label is associated elsewhere in the template; otherwise add one.",
              systemFix: "Render inputs only through a Field component that requires a label.",
            });
          }
        }
      }
    }

    // 6. Positive tabindex
    const ti = attrValue(t.attrs, "tabIndex");
    if (ti !== undefined && /^\d+$/.test(ti) && Number(ti) > 0) {
      add({
        rule: "positive-tabindex",
        severity: "warning",
        line: t.line,
        element: el,
        message: `tabIndex=${ti} overrides the natural focus order and tends to create confusing keyboard navigation.`,
        fix: "Use tabIndex={0} or -1 and fix the DOM order instead.",
        systemFix: "Disallow positive tabIndex in the design system's component types and lint config.",
      });
    }

    // 7. aria-hidden on something focusable
    if (attrValue(t.attrs, "aria-hidden") === "true") {
      const focusable =
        ["button", "a", "input", "select", "textarea"].includes(name) ||
        (ti !== undefined && !ti.startsWith("-"));
      if (focusable) {
        add({
          rule: "aria-hidden-focusable",
          severity: "warning",
          line: t.line,
          element: el,
          message: "aria-hidden=\"true\" on a focusable element hides it from assistive technology while it can still receive focus.",
          fix: "Remove aria-hidden, or make the element non-focusable (inert / disabled / tabIndex={-1}).",
          systemFix: "Centralize hiding behavior in one primitive that removes focusability together with visibility.",
        });
      }
    }
  }

  // 8. Focus outline removed (text-level, not tag-level)
  const outlineRe = /outline\s*:\s*['"]?(none|0)\b/gi;
  let m: RegExpExecArray | null;
  const hasReplacement = /:focus-visible|focus-visible:|box-shadow|outline-offset/i.test(src);
  while ((m = outlineRe.exec(src)) !== null) {
    add({
      rule: "focus-outline-removed",
      severity: hasReplacement ? "info" : "warning",
      line: src.slice(0, m.index).split("\n").length,
      element: "style",
      message: hasReplacement
        ? "Default focus outline is removed. A replacement focus style appears in this snippet; verify it has sufficient contrast."
        : "Default focus outline is removed and no replacement focus style appears in this snippet.",
      fix: "Keep the default outline, or replace it with a clearly visible :focus-visible style.",
      systemFix: "Define focus styling once as a design token and apply it in the base component styles.",
    });
  }

  findings.sort((a, b) => a.line - b.line);
  for (const f of findings) {
    const pattern = patternForFinding(f.rule);
    if (pattern) f.pattern = pattern;
  }
  for (const t of tags) if (hasSpread(t.attrs)) skippedDueToSpread++;
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  return { findings, counts, skippedDueToSpread, caveat: CAVEAT };
}
