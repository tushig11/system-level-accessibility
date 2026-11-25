/**
 * Next actions for practices that are not yet enforced.
 * Each entry links a practice to existing material in this server (an artifact or a pattern)
 * and gives one first step small enough to do in a day. The first-step wording is written for
 * this tool, not taken from the methodology documents.
 */

export interface NextAction {
  /** One small first step. */
  firstStep: string;
  /** Artifact kinds from generate_enforcement_artifact that help. */
  artifacts?: string[];
  /** Pattern ids from get_pattern that show how it is done in code. */
  patterns?: string[];
}

export const NEXT_ACTIONS: Record<string, NextAction> = {
  "L1.semantic-html": {
    firstStep: "Search for click handlers on div and span elements and replace each with a button or a link. Then add a lint rule against raw interactive elements.",
    patterns: ["steer-to-primitives"],
  },
  "L1.accessible-names": {
    firstStep: "Change your Button component so an accessible name is a required prop, and fix the call sites the compiler reports.",
    patterns: ["icon-button-name-by-type", "input-label-association"],
  },
  "L1.keyboard-focus": {
    firstStep: "Operate each shared component with the keyboard only, and write down where focus is lost or unclear.",
    patterns: ["native-dialog-modal"],
    artifacts: ["manual-at-test-script"],
  },
  "L1.aria-defaults": {
    firstStep: "List the ARIA props that consumers pass for common cases, then move the standard ones inside the component.",
    patterns: ["input-label-association"],
  },
  "L2.shared-library": {
    firstStep: "Count the separate implementations of button, input and dialog across your repositories and pick one to keep.",
    patterns: ["steer-to-primitives"],
  },
  "L2.reusable-patterns": {
    firstStep: "Pick the form pattern teams rebuild most and turn it into one documented reusable component.",
    patterns: ["input-label-association"],
  },
  "L2.consistent-behavior": {
    firstStep: "Write keyboard and focus tests for one shared component in the library, so the behavior is tested once.",
    patterns: ["tokens-focus-and-contrast"],
  },
  "L3.baseline-audits": {
    firstStep: "Before the next migration, run the accessibility check on the key pages and save the results with the date.",
    artifacts: ["playwright-axe-test"],
  },
  "L3.regression-testing": {
    firstStep: "Add the generated accessibility test for the pages touched by the last migration.",
    artifacts: ["playwright-axe-test", "github-actions-axe"],
  },
  "L3.migration-safeguards": {
    firstStep: "Add a migration section to the pull request template: what accessible behavior the old component had and how it is kept.",
    artifacts: ["pr-template"],
  },
  "L4.ci-checks": {
    firstStep: "Add the generated workflow on your top three pages, non-blocking, for a week. Then mark it as a required status check.",
    artifacts: ["github-actions-axe", "playwright-axe-test"],
    patterns: ["justified-lint-bypass", "placeholder-is-not-a-label"],
  },
  "L4.pr-template": {
    firstStep: "Add the generated pull request template to the repository.",
    artifacts: ["pr-template"],
  },
  "L4.definition-of-done": {
    firstStep: "Add the generated accessibility section to your Definition of Done and use it on the next closed item.",
    artifacts: ["definition-of-done"],
  },
  "L4.manual-at-testing": {
    firstStep: "Schedule one 60-minute session using the generated test script on your most used flow. Record who ran it and what failed.",
    artifacts: ["manual-at-test-script"],
  },
  "L5.vendor-evaluation": {
    firstStep: "Write a one-page accessibility checklist and use it on the next third-party tool you evaluate, and on the one you adopted last.",
  },
  "L5.wrapper-components": {
    firstStep: "Wrap the most used third-party widget so that your component owns its naming and focus behavior.",
    patterns: ["icon-button-name-by-type", "native-dialog-modal"],
  },
  "L5.fallback-patterns": {
    firstStep: "Pick the third-party widget that matters most and write down what a keyboard-only user can do if it fails.",
  },
  "L6.documentation": {
    firstStep: "Ask a new engineer to find the guidance for building an accessible form. Fix where they got stuck.",
  },
  "L6.onboarding": {
    firstStep: "Add one accessibility item to the onboarding checklist, such as the manual test script.",
    artifacts: ["manual-at-test-script"],
  },
  "L6.knowledge-sharing": {
    firstStep: "Name a second person who can review accessibility, and have them review the next three pull requests with the specialist.",
  },
};
