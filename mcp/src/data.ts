/**
 * Methodology data for the six-layer System-Level Accessibility model.
 * Layer definitions and team guides come from framework/v1-framework.md and scaled/*.md
 * in this repository. The per-practice evidence levels and verification steps are written
 * for this tool so that an assessment rests on checkable evidence, not on a yes/no claim.
 * Layer numbering follows the official model: L2 = Distribution, L3 = Preservation.
 */

export type LayerId = "L1" | "L2" | "L3" | "L4" | "L5" | "L6";
export type TeamSize = "solo" | "startup" | "growing";
export type Level = "absent" | "partial" | "enforced";

export interface Practice {
  id: string;
  text: string;
  /** What "partial" looks like in practice. */
  partial: string;
  /** What "enforced" looks like: the practice holds even when nobody remembers it. */
  enforced: string;
  /** A concrete check someone can run to confirm the level. */
  verify: string;
}

export interface Layer {
  id: LayerId;
  number: number;
  name: string;
  summary: string;
  outcome: string;
  whenAbsent: string;
  practices: Practice[];
}

const p = (id: string, text: string, partial: string, enforced: string, verify: string): Practice => ({
  id,
  text,
  partial,
  enforced,
  verify,
});

export const LAYERS: Layer[] = [
  {
    id: "L1",
    number: 1,
    name: "Architectural Constraint Layer",
    summary: "Accessibility built into component design and system foundations.",
    outcome: "Accessibility is built into the architecture, not added later.",
    whenAbsent:
      "Without architectural defaults, accessibility depends on individual developer knowledge.",
    practices: [
      p(
        "L1.semantic-html",
        "Semantic HTML by default",
        "Used in most new components, but nothing stops a div-based control from shipping.",
        "Shared components render native elements, and a lint or review rule blocks raw div/span controls.",
        "Search the codebase for click handlers on div or span elements; check whether a lint rule flags them.",
      ),
      p(
        "L1.accessible-names",
        "Accessible names are required by the component API",
        "Names are expected by convention or documentation, but not required.",
        "Types or build-time checks make an accessible name required, so an unnamed control does not compile.",
        "Try to render an icon-only button without a label and confirm it is rejected.",
      ),
      p(
        "L1.keyboard-focus",
        "Keyboard interaction and focus management are built in",
        "Common components handle keyboard and focus; custom widgets are left to each developer.",
        "Every interactive shared component handles keyboard operation and focus (including restoring focus) internally and has tests for it.",
        "Operate each shared component by keyboard only; check where focus lands after a dialog closes.",
      ),
      p(
        "L1.aria-defaults",
        "ARIA attributes are applied as defaults, not by hand",
        "ARIA is added by hand in some places.",
        "Components apply required ARIA states and relationships themselves, so consumers do not write ARIA for common cases.",
        "Check whether consumers of shared components pass ARIA props for standard cases.",
      ),
    ],
  },
  {
    id: "L2",
    number: 2,
    name: "Distribution Layer",
    summary: "Accessible behavior reused and scaled across teams.",
    outcome: "Correct implementations are reused and scaled across the ecosystem.",
    whenAbsent: "Without component distribution, correct implementations do not scale.",
    practices: [
      p(
        "L2.shared-library",
        "A shared, centralized accessible component library",
        "A library exists, but teams also build their own versions of the same components.",
        "Teams use one shared library for common patterns, and duplicates are flagged or removed.",
        "Count separate implementations of button, input and dialog across repositories.",
      ),
      p(
        "L2.reusable-patterns",
        "Standardized, reusable interaction patterns",
        "Patterns are documented but not discoverable or followed consistently.",
        "Standard patterns (forms, dialogs, error handling) exist as reusable components or recipes that teams actually use.",
        "Ask two teams to build the same form and compare the results.",
      ),
      p(
        "L2.consistent-behavior",
        "Consistent behavior across products",
        "Behavior is mostly consistent, with differences between products.",
        "Shared behavior is tested once in the library and inherited everywhere.",
        "Compare keyboard and focus behavior of the same component in two products.",
      ),
    ],
  },
  {
    id: "L3",
    number: 3,
    name: "Preservation Layer",
    summary: "Accessibility maintained through migrations and system changes.",
    outcome: "Accessibility is preserved and improved during system evolution, not lost.",
    whenAbsent: "Without a modernization methodology, migrations introduce regressions.",
    practices: [
      p(
        "L3.baseline-audits",
        "Accessibility baseline documented before change",
        "An audit was done once, before a major change.",
        "A baseline is documented before each migration and compared afterward.",
        "Ask for the baseline from the last migration and the comparison against it.",
      ),
      p(
        "L3.regression-testing",
        "Regression testing and validation for accessibility",
        "Some accessibility tests exist but do not cover migrated areas.",
        "Accessibility regression tests run automatically and cover migrated components.",
        "Check whether the last migration's pull requests had accessibility test results.",
      ),
      p(
        "L3.migration-safeguards",
        "Migration safeguards: safe component and pattern migration",
        "Migration guidance exists but is optional.",
        "Migrations follow a defined path (checklist, codemod or review gate) that carries accessible behavior forward.",
        "Review the last migration pull request for the checklist or gate.",
      ),
    ],
  },
  {
    id: "L4",
    number: 4,
    name: "Enforcement Layer",
    summary: "Accessibility integrated into development workflows and CI/CD.",
    outcome: "Errors are detected early and prevented from reaching users.",
    whenAbsent: "Without workflow integration, errors are not caught before deployment.",
    practices: [
      p(
        "L4.ci-checks",
        "Automated accessibility checks run in CI",
        "Automated checks run in CI but do not block merging.",
        "Automated accessibility checks run on every pull request and a failing result blocks the merge.",
        "Open a pull request that introduces a known violation and confirm it cannot merge.",
      ),
      p(
        "L4.pr-template",
        "Accessibility self-assessment in the pull request template",
        "A checklist exists but is optional or often skipped.",
        "Every pull request includes the accessibility self-assessment, and reviewers verify it.",
        "Sample recent pull requests and count the completed assessments.",
      ),
      p(
        "L4.definition-of-done",
        "Accessibility is part of the Definition of Done",
        "Accessibility is mentioned but is not a completion criterion.",
        "Work is not done until the accessibility criteria in the Definition of Done are met.",
        "Pick a recently closed item and check whether the criteria were met.",
      ),
      p(
        "L4.manual-at-testing",
        "Manual assistive technology testing is scheduled practice",
        "Manual testing happens occasionally or before large releases.",
        "Manual assistive technology testing is scheduled, owned and documented on a recurring basis.",
        "Ask for the notes from the last session and who ran it.",
      ),
    ],
  },
  {
    id: "L5",
    number: 5,
    name: "Boundary Layer",
    summary: "Accessibility risks managed across third-party integrations.",
    outcome: "Accessibility risks from external components are identified, managed, and controlled.",
    whenAbsent:
      "Without boundary governance, accessibility risks from external components remain unmanaged.",
    practices: [
      p(
        "L5.vendor-evaluation",
        "Third-party tools are evaluated for accessibility before integration",
        "Some third-party tools are checked, informally.",
        "A documented accessibility evaluation is required before a third-party component is adopted.",
        "Ask for the evaluation of the most recently adopted third-party tool.",
      ),
      p(
        "L5.wrapper-components",
        "Accessible wrapper patterns around external components",
        "A few third-party tools have wrappers.",
        "Third-party components are used through accessible wrappers that own naming, keyboard and focus behavior.",
        "Check how a third-party widget (date picker, chat, embed) is used in the codebase.",
      ),
      p(
        "L5.fallback-patterns",
        "Fallback content or alternative interactions where tools fall short",
        "Fallbacks exist for a few known failures.",
        "Where a third-party tool falls short, a fallback or alternative path is defined and documented.",
        "Ask what a keyboard-only user can do when the third-party widget fails.",
      ),
    ],
  },
  {
    id: "L6",
    number: 6,
    name: "Continuity Layer",
    summary: "Accessibility knowledge sustained across teams and over time.",
    outcome: "Accessibility capability is sustained beyond any individual.",
    whenAbsent: "Without knowledge transfer, the system degrades when the specialist departs.",
    practices: [
      p(
        "L6.documentation",
        "Accessibility documentation and guidelines",
        "Documentation exists but is outdated or hard to find.",
        "Accessibility guidance is current, discoverable and linked from the component documentation.",
        "Ask a new engineer to find the guidance for building an accessible form.",
      ),
      p(
        "L6.onboarding",
        "Training and onboarding on accessibility",
        "Training happens for some people or teams.",
        "Every new engineer gets accessibility onboarding as part of the normal process.",
        "Check the onboarding checklist and whether recent hires completed it.",
      ),
      p(
        "L6.knowledge-sharing",
        "Shared standards and ongoing knowledge sharing",
        "Knowledge sits with one or two specialists.",
        "Knowledge is shared through reviews, rotations or office hours, so no single person is required.",
        "Ask what would happen if the accessibility specialist left tomorrow.",
      ),
    ],
  },
];

export interface TeamGuide {
  id: TeamSize;
  title: string;
  headcount: string;
  focus: string;
  keyLayers: LayerId[];
  practices: string[];
  avoid: string[];
  outcome: string;
  note?: string;
}

export const TEAM_GUIDES: Record<TeamSize, TeamGuide> = {
  solo: {
    id: "solo",
    title: "Solo Developers",
    headcount: "1-3 people",
    focus: "Prioritize high-impact accessibility with minimal overhead.",
    keyLayers: ["L1", "L2", "L4"],
    practices: [
      "use semantic HTML always",
      "enforce accessible naming",
      "run axe DevTools in browser",
      "test keyboard navigation",
    ],
    avoid: [
      "building custom UI without need",
      "skipping manual checks",
      "ignoring focus behavior",
    ],
    outcome: "Accessibility becomes a default behavior, not extra work.",
    note: "Enforcement (L4) is applied in a lightweight form at this size.",
  },
  startup: {
    id: "startup",
    title: "Startups",
    headcount: "4-15 people",
    focus: "Balance speed and accessibility consistency.",
    keyLayers: ["L1", "L2", "L4"],
    practices: [
      "build shared component library",
      "enforce accessibility in PR reviews",
      "run CI accessibility checks",
      "track accessibility issues",
    ],
    avoid: [
      "duplicating components",
      "skipping accessibility reviews",
      "delaying accessibility fixes",
    ],
    outcome: "Accessibility scales without slowing development.",
  },
  growing: {
    id: "growing",
    title: "Growing Teams",
    headcount: "16-50 people",
    focus: "Ensure consistency across teams and systems.",
    keyLayers: ["L2", "L3", "L4", "L5", "L6"],
    practices: [
      "central design system",
      "migration accessibility strategy",
      "CI/CD enforcement",
      "third-party governance",
      "knowledge sharing",
    ],
    avoid: [
      "inconsistent implementations",
      "accessibility regressions during migration",
      "unmanaged third-party tools",
    ],
    outcome: "Accessibility becomes a scalable organizational capability.",
  },
};

export const CORE_PRINCIPLE =
  "Accessibility is not a property of individual components. It is a property of the system, shaped by coordinated constraints. " +
  "Accessibility emerges from the interaction of system layers, not from isolated implementations.";

export function getLayer(id: string): Layer | undefined {
  const norm = id.trim().toUpperCase();
  const byId = LAYERS.find((l) => l.id === norm);
  if (byId) return byId;
  const n = Number(norm.replace(/^L/, ""));
  return LAYERS.find((l) => l.number === n);
}

export const ALL_PRACTICE_IDS: string[] = LAYERS.flatMap((l) => l.practices.map((pr) => pr.id));
