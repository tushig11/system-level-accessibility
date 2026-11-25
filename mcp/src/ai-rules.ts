/**
 * Rules for an AI assistant that generates UI code, and the generate-then-check loop.
 * Applies the methodology to code produced by an assistant: constrain what is produced (Layer 1),
 * reuse what exists (Layer 2), and verify the output before it is shown (Layer 4).
 * These are guidance for the assistant. They do not guarantee accessible output.
 */

export const AI_RULES_VERSION = "1";

export const AI_GENERATION_RULES: string[] = [
  "Reuse the project's shared components and design tokens before writing new markup. Do not create a second version of a button, input or dialog that already exists.",
  "Use native elements for interactive controls: button for actions, a with href for navigation, input/select/textarea for fields, dialog for modals. Do not attach click handlers to div or span.",
  "Give every control an accessible name. Icon-only buttons need an aria-label or visually hidden text. Images need alt text that says what the image conveys, or alt=\"\" when decorative. Do not write generic alt text such as \"image\".",
  "Every form field needs a programmatically associated label. A placeholder is not a label. Connect error messages to their field.",
  "Do not remove focus outlines. If the style is changed, replace it with a visible focus indicator.",
  "Do not add ARIA where a native element already provides the meaning. When ARIA is needed, use the pattern's required states and relationships, not a guess.",
  "Do not use positive tabindex values. Keep the DOM order the same as the reading and focus order.",
  "Use the project's color tokens. Do not invent colors, and do not rely on color alone to convey state.",
  "If the project's own lint rules or types block something, change the code. Do not add a bypass to make it pass.",
];

export const AI_VERIFY_LOOP: string[] = [
  "Generate the UI following the rules above.",
  "Call review_markup on the generated code.",
  "Fix every error finding. Use each finding's systemFix and any linked pattern from get_pattern when the fix belongs in a shared component, not in this one place.",
  "Call review_markup again until no error findings remain.",
  "Tell the user what was checked and what was not. review_markup is a tag-level heuristic. It cannot see computed names, CSS, focus order or screen reader behavior.",
  "Tell the user what still needs a person: a keyboard-only pass, a screen reader check, and the project's CI accessibility check.",
];

export const AI_RULES_LIMITS =
  "Following these rules reduces common markup mistakes. It does not make output accessible by itself, and a clean review_markup result is not a conformance result. Automated checks find only part of real problems.";

export function aiRulesMarkdown(): string {
  return [
    "# Rules for generating accessible UI with an AI assistant",
    "",
    "## Generation rules",
    ...AI_GENERATION_RULES.map((r, i) => `${i + 1}. ${r}`),
    "",
    "## Verify before showing the code",
    ...AI_VERIFY_LOOP.map((r, i) => `${i + 1}. ${r}`),
    "",
    "## Limits",
    AI_RULES_LIMITS,
    "",
  ].join("\n");
}
