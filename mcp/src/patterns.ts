/**
 * Implementation patterns taken from the roqn-ui reference implementation
 * (https://github.com/tushig11/roqn-ui), pinned to a specific commit.
 *
 * Excerpts are verbatim source lines. test/patterns-verify.mjs checks every excerpt
 * against a local roqn-ui checkout so the patterns cannot silently drift from the code.
 */

import type { LayerId } from "./data.js";

export const ROQN_UI_REPO = "https://github.com/tushig11/roqn-ui";
export const ROQN_UI_COMMIT = "3644fe8a7720b059a8838202beb26bbea8e19c55";

export interface Excerpt {
  /** Path inside roqn-ui. */
  file: string;
  /** Verbatim lines from that file. */
  text: string;
  /** Permalink at the pinned commit. */
  url: string;
}

export interface Pattern {
  id: string;
  title: string;
  layers: LayerId[];
  problem: string;
  approach: string;
  excerpts: Excerpt[];
  prevents: string[];
  doesNotPrevent: string[];
  caveats: string[];
  /** review_markup rule ids that point to this pattern. */
  relatedFindings: string[];
  evidence: string;
}

const ex = (file: string, lines: string[]): Excerpt => ({
  file,
  text: lines.join("\n"),
  url: `${ROQN_UI_REPO}/blob/${ROQN_UI_COMMIT}/${file}`,
});

const EVIDENCE =
  "Source reviewed. Runtime behavior with browsers and assistive technology was not tested by this tool.";

export const PATTERNS: Pattern[] = [
  {
    id: "icon-button-name-by-type",
    title: "Require an accessible name through the component's types",
    layers: ["L1"],
    problem: "Icon-only buttons ship with no accessible name because nothing requires one.",
    approach:
      "Model the Button props as a union: either visible text (and no ariaLabel), or an icon with a required ariaLabel (and no children). TypeScript rejects the unnamed case.",
    excerpts: [
      ex("src/components/Button/Button.tsx", [
        "type ButtonWithText = BaseButtonProps & {",
        "  children: React.ReactNode;",
        "  ariaLabel?: never;",
        "  icon?: React.ReactNode;",
        "};",
        "",
        "type IconOnlyButton = BaseButtonProps & {",
        "  icon: React.ReactNode;",
        "  children?: never;",
        "  ariaLabel: string;",
        "};",
        "",
        "export type ButtonProps = ButtonWithText | IconOnlyButton;",
      ]),
    ],
    prevents: [
      "An icon-only Button with no name, in TypeScript code that uses this component.",
      "Supplying both visible text and an aria-label (the types mark one as never).",
    ],
    doesNotPrevent: [
      "An empty or unhelpful name: an empty string satisfies `ariaLabel: string`.",
      "Unnamed buttons created outside the component (raw <button>), in plain JavaScript, or through type assertions such as `as any`.",
    ],
    caveats: [
      "Compile-time enforcement only helps TypeScript consumers. Pair it with a lint rule (see steer-to-primitives).",
      "This pattern covers naming only. The loading-state announcement in the same component was not evaluated.",
    ],
    relatedFindings: ["button-name"],
    evidence: EVIDENCE,
  },
  {
    id: "input-label-association",
    title: "Require a label, and wire label, error and validation state inside the component",
    layers: ["L1"],
    problem:
      "Form fields ship without a label, or with an error message that is not programmatically tied to the field.",
    approach:
      "Require either a visible label or an ariaLabel through the types, and let the component own the id, label association, aria-invalid and aria-describedby so consumers cannot omit them.",
    excerpts: [
      ex("src/components/Input/Input.tsx", [
        "type WithLabel = BaseProps & {",
        "  label: string;",
        "  ariaLabel?: never;",
        "};",
        "",
        "type WithAriaLabel = BaseProps & {",
        "  label?: never;",
        "  ariaLabel: string;",
        "};",
        "",
        "export type InputProps = WithLabel | WithAriaLabel;",
      ]),
      ex("src/components/Input/Input.tsx", [
        "        aria-label={!label ? ariaLabel : undefined}",
        "        aria-invalid={!!error}",
        "        aria-describedby={errorId}",
      ]),
      ex("src/components/Input/Input.tsx", [
        '        <span id={errorId} role="alert" className="input-error">',
      ]),
    ],
    prevents: [
      "An Input with no accessible name, in TypeScript code that uses this component.",
      "Forgetting to associate the error message with the field (the component does it).",
    ],
    doesNotPrevent: [
      "An empty label string, which satisfies `label: string`.",
      "Fields built from raw <input> elements elsewhere in the codebase.",
    ],
    caveats: [
      "Compile-time enforcement only helps TypeScript consumers.",
      "The error message uses role=\"alert\", which announces immediately. Whether that suits every form is a design decision.",
    ],
    relatedFindings: ["input-label", "input-label-unverified"],
    evidence: EVIDENCE,
  },
  {
    id: "steer-to-primitives",
    title: "Lint raw interactive elements toward the shared components",
    layers: ["L1", "L2", "L4"],
    problem:
      "Type constraints only apply to the shared components. Developers can still write a raw <button> or <dialog> and bypass them.",
    approach:
      "A custom ESLint rule reports raw interactive elements and names the shared component to use instead. The sanctioned primitives disable the rule explicitly with a comment.",
    excerpts: [
      ex("eslint-rules/no-raw-interactive-elements.mjs", [
        "const REPLACEMENTS = {",
        "  button: 'Button',",
        "  dialog: 'Modal',",
        "  fieldset: 'FormGroup',",
        "};",
      ]),
      ex("eslint-rules/no-raw-interactive-elements.mjs", [
        "      useComponent:",
        '        "Use the roqn-ui <{{component}}> component instead of a raw <{{tag}}>; it enforces accessible naming and behavior at compile time.",',
      ]),
    ],
    prevents: [
      "Raw button, dialog, fieldset and text-like input elements bypassing the shared components, in files that are linted.",
    ],
    doesNotPrevent: [
      "Anything in code that is not linted, or where the rule is disabled.",
      "Controls the rule does not know about: per the source, checkboxes, radios and files have no component yet and are not flagged.",
    ],
    caveats: [
      "The rule is specific to roqn-ui's component names. Adapt the replacement map to your own library.",
    ],
    relatedFindings: ["clickable-non-semantic", "anchor-without-href"],
    evidence: EVIDENCE,
  },
  {
    id: "placeholder-is-not-a-label",
    title: "Reject placeholder text as the only accessible name",
    layers: ["L4"],
    problem: "Inputs get a placeholder and no label. The placeholder disappears on input and is not a reliable name.",
    approach: "A lint rule reports native input and textarea elements that have a placeholder but no name source.",
    excerpts: [
      ex("eslint-rules/no-placeholder-as-label.mjs", [
        "const ACCESSIBLE_NAME_ATTRS = ['aria-label', 'aria-labelledby', 'id'];",
      ]),
      ex("eslint-rules/no-placeholder-as-label.mjs", [
        "      needsLabel:",
        "        'A placeholder is not an accessible label. Placeholder text disappears on input and is skipped by some screen readers. Add aria-label, aria-labelledby, or associate a <label>.',",
      ]),
    ],
    prevents: ["A native input or textarea that has a placeholder and no aria-label, aria-labelledby or id."],
    doesNotPrevent: [
      "An input with an id but no matching <label>: the rule treats any id as a possible name source and does not verify that a label exists.",
      "Components other than native input and textarea.",
    ],
    caveats: ["The id shortcut makes this rule lenient by design. review_markup is stricter for static ids."],
    relatedFindings: ["placeholder-as-label"],
    evidence: EVIDENCE,
  },
  {
    id: "justified-lint-bypass",
    title: "Require a justification for every lint bypass",
    layers: ["L4"],
    problem: "Enforcement erodes when developers silence a rule without saying why.",
    approach:
      "A lint rule requires an explanatory comment directly above any eslint-disable directive, so every bypass is visible in review.",
    excerpts: [
      ex("eslint-rules/require-eslint-disable-justification.mjs", [
        "const DISABLE_DIRECTIVE = /^eslint-disable(-next-line|-line)?\\b/;",
      ]),
      ex("eslint-rules/require-eslint-disable-justification.mjs", [
        "      missingJustification:",
        "        'eslint-disable directives must be preceded by a comment explaining why the rule is being suppressed here.',",
      ]),
    ],
    prevents: ["Silent, unexplained suppression of accessibility lint rules."],
    doesNotPrevent: [
      "A weak or wrong justification: the rule checks that a comment exists, not that it is good.",
      "Suppression by other means, such as editing the lint configuration.",
    ],
    caveats: ["It makes bypasses reviewable. A reviewer still has to read them."],
    relatedFindings: [],
    evidence: EVIDENCE,
  },
  {
    id: "native-dialog-modal",
    title: "Build dialogs on the native dialog element, with the accessible name required",
    layers: ["L1"],
    problem: "Custom modals miss focus handling, naming and modal semantics.",
    approach:
      "Use the native <dialog> with showModal(), require a title or ariaLabel through the types, restore focus on close, and keep a Tab-trap fallback for browser and assistive technology combinations where the native trap is incomplete.",
    excerpts: [
      ex("src/components/Modal/Modal.tsx", [
        "type ModalWithTitle = BaseModalProps & {",
        "  title: string;",
        "  ariaLabel?: never;",
        "};",
        "",
        "type ModalWithAriaLabel = BaseModalProps & {",
        "  title?: never;",
        "  ariaLabel: string;",
        "};",
      ]),
      ex("src/components/Modal/Modal.tsx", [
        "      if (returnFocusRef.current instanceof HTMLElement) {",
        "        returnFocusRef.current.focus();",
        "      }",
      ]),
      ex("src/components/Modal/Modal.tsx", [
        "      // aria-modal tells screen readers to treat content outside as inert.",
        "      // Without it, NVDA+Chrome lets the virtual cursor escape the dialog",
        "      // even though keyboard focus is correctly trapped by showModal().",
        '      aria-modal="true"',
      ]),
    ],
    prevents: [
      "A Modal with no accessible name, in TypeScript code that uses this component.",
      "Focus being left behind after the dialog closes.",
    ],
    doesNotPrevent: [
      "Dialogs built without this component.",
      "Poor titles or labels: any non-empty string satisfies the types.",
    ],
    caveats: [
      "The aria-modal comment records the component author's observation about NVDA with Chrome; it was not re-tested by this tool.",
      "The scroll lock is simplified and, per the source's own comment, does not handle stacked modals.",
      "Behavior across browser and assistive technology combinations needs testing in your own environment.",
    ],
    relatedFindings: [],
    evidence: EVIDENCE,
  },
  {
    id: "tokens-focus-and-contrast",
    title: "Define focus and color once as tokens, and lint hard-coded colors",
    layers: ["L1", "L2"],
    problem:
      "Focus styles and colors are redefined per component, so contrast and focus visibility drift and get removed.",
    approach:
      "Define color and focus values as CSS custom properties with documented contrast ratios, reference them from every component, and add a lint rule that reports hard-coded color literals.",
    excerpts: [
      ex("src/tokens.css", [
        "  --focus-ring-width: 2px;",
        "  --focus-ring-offset: 2px;",
        "  --focus-ring: var(--focus-ring-width) solid var(--color-interactive);",
      ]),
      ex("src/tokens.css", [
        " *   --color-border on white (Input's border):  3.78:1  ✓ (UI component, needs 3:1)",
      ]),
      ex("eslint-rules/no-hardcoded-color.mjs", [
        "      useToken:",
        "        'Hardcoded color \"{{value}}\". Reference a design token (e.g. var(--color-interactive)) from src/tokens.css instead.',",
      ]),
    ],
    prevents: [
      "Per-component focus styles and one-off colors, in files that are linted.",
      "Theming that changes colors without changing component files (tokens can be overridden at :root).",
    ],
    doesNotPrevent: [
      "Insufficient contrast when a token is used on a background it was not checked against.",
      "Poor contrast in values a team overrides at :root.",
    ],
    caveats: [
      "Contrast ratios are as documented in the source. They were recomputed from the hex values when this pattern was written and matched; recompute if you change a token.",
      "Tokens only help if components actually use them, which is why the lint rule matters.",
    ],
    relatedFindings: ["focus-outline-removed"],
    evidence: EVIDENCE,
  },
];

export function getPattern(id: string): Pattern | undefined {
  return PATTERNS.find((x) => x.id === id);
}

export function patternForFinding(rule: string): string | undefined {
  return PATTERNS.find((x) => x.relatedFindings.includes(rule))?.id;
}

export const PATTERN_IDS: string[] = PATTERNS.map((x) => x.id);
