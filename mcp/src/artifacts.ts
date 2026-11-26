/**
 * Layer 4 (Enforcement) artifact generator: CI check, PR template, Definition of Done.
 * Output is plain text intended to be copied into a repository.
 */

export type ArtifactKind =
  | "github-actions-axe"
  | "playwright-axe-test"
  | "pr-template"
  | "definition-of-done"
  | "manual-at-test-script";

export const ARTIFACT_KINDS: ArtifactKind[] = [
  "github-actions-axe",
  "playwright-axe-test",
  "pr-template",
  "definition-of-done",
  "manual-at-test-script",
];

export interface Artifact {
  kind: ArtifactKind;
  path: string;
  layer: "L4";
  description: string;
  content: string;
  notes: string[];
}

export interface ArtifactOptions {
  baseUrl?: string;
  /** Command that starts the app under test, e.g. "npm run preview". */
  startCommand?: string;
  /** Paths to scan, e.g. ["/", "/login"]. */
  routes?: string[];
}

export function generateArtifact(kind: ArtifactKind, opts: ArtifactOptions = {}): Artifact {
  const baseUrl = opts.baseUrl ?? "http://localhost:4173";
  const routes = opts.routes?.length ? opts.routes : ["/"];
  const startCommand = opts.startCommand ?? "npm run preview";

  switch (kind) {
    case "playwright-axe-test": {
      const routeList = routes.map((r) => JSON.stringify(r)).join(", ");
      return {
        kind,
        path: "e2e/a11y.spec.ts",
        layer: "L4",
        description: "Playwright + axe-core test that fails on serious or critical violations.",
        content: `import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routes = [${routeList}];

for (const route of routes) {
  test(\`no serious or critical accessibility violations on \${route}\`, async ({ page }) => {
    await page.goto(route);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );

    expect(
      blocking.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })),
      "Serious or critical accessibility violations found",
    ).toEqual([]);
  });
}
`,
        notes: [
          "Install: npm i -D @playwright/test @axe-core/playwright, then npx playwright install chromium.",
          "Set use.baseURL in playwright.config.ts to the app under test.",
          "Automated rules detect only part of real-world accessibility problems; keep manual keyboard and screen reader testing.",
        ],
      };
    }

    case "github-actions-axe":
      return {
        kind,
        path: ".github/workflows/accessibility.yml",
        layer: "L4",
        description: "GitHub Actions workflow that runs the axe-core Playwright test on every pull request.",
        content: `name: accessibility

on:
  pull_request:

jobs:
  axe:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - run: npx playwright install --with-deps chromium

      - name: Build and start app
        run: |
          npm run build
          ${startCommand} &
          npx wait-on ${baseUrl}

      - name: Run accessibility tests
        run: npx playwright test e2e/a11y.spec.ts
        env:
          PLAYWRIGHT_BASE_URL: ${baseUrl}
`,
        notes: [
          "Add wait-on as a dev dependency (npm i -D wait-on) or replace that step with your own readiness check.",
          "Enforcement only works if the check is required: in branch protection, mark the 'accessibility / axe' status check as required so a failing PR cannot merge.",
          "Adjust build/start commands to your project.",
        ],
      };

    case "pr-template":
      return {
        kind,
        path: ".github/pull_request_template.md",
        layer: "L4",
        description: "Pull request template with an accessibility self-assessment that reviewers verify.",
        content: `## Summary

<!-- What does this change do? -->

## Accessibility self-assessment

Engineers self-report; reviewers verify.

- [ ] Keyboard navigation tested (all interactive elements reachable and operable, visible focus)
- [ ] Automated accessibility check passes locally (axe)
- [ ] New interactive elements have accessible names
- [ ] Focus management is correct (dialogs, route changes, dynamic content)
- [ ] Dynamic changes (errors, status, navigation) are announced to assistive technology
- [ ] Not applicable: this change has no user interface impact

## Reviewer verification

- [ ] I verified the items above, not only read the checkboxes
`,
        notes: [
          "Template wording is a starting point; adapt the checklist to your design system's components.",
        ],
      };

    case "manual-at-test-script":
      return {
        kind,
        path: "docs/manual-accessibility-test.md",
        layer: "L4",
        description: "A repeatable manual test script: keyboard pass, then a screen reader pass, with a place to record results.",
        content: `# Manual accessibility test

A basic smoke test for one page or flow. It finds common problems. It does not replace testing with people who use assistive technology every day.

Record: page or flow, date, tester, browser, screen reader and version.

## 1. Keyboard only (no screen reader)

Put the mouse aside. Use Tab, Shift+Tab, Enter, Space, arrow keys and Escape.

- [ ] Every interactive element can be reached and operated.
- [ ] Focus is always visible.
- [ ] Focus order follows the visual and reading order.
- [ ] Nothing traps focus. You can leave every widget.
- [ ] Opening a dialog moves focus into it. Escape closes it. Focus returns to the control that opened it.
- [ ] Menus, tabs and custom widgets work with the keys users expect.

## 2. Screen reader pass

Use one of these. Check each vendor's documentation for the current commands.

- Windows: NVDA (free) with Firefox or Chrome. Also JAWS if you have it.
- macOS and iOS: VoiceOver with Safari.
- Android: TalkBack with Chrome.

Turn the screen reader on, then go through the page.

- [ ] The page title describes the page.
- [ ] Headings give a sensible outline. Jump between them.
- [ ] Landmarks (main, navigation, and so on) are present and named where there is more than one.
- [ ] Every button and link announces a name that makes sense out of context, and its role.
- [ ] Every form field announces its label, its type, and whether it is required or invalid.
- [ ] Error messages are announced when they appear, and tied to the field.
- [ ] Images announce useful alt text, or are skipped when decorative.
- [ ] State changes are announced: expanded or collapsed, selected, loading, success or failure.
- [ ] Dialogs announce their name when they open.

## 3. Record results

| Check | Result (pass / fail / not tested) | What happened | Issue link |
|---|---|---|---|
|  |  |  |  |

Open an issue for every failure with the steps, the tool and its version, and what was expected.
`,
        notes: [
          "Check the screen reader commands against NVDA, VoiceOver and TalkBack documentation before you share this with your team.",
          "Run it on the changed flow before a release and after large migrations, and keep the filled-in results. Layer 4 'manual testing' is only confirmed if someone can show the notes.",
          "Treat this as a smoke test. Include people who use assistive technology daily when you can.",
        ],
      };

    case "definition-of-done":
      return {
        kind,
        path: "docs/definition-of-done.md",
        layer: "L4",
        description: "Definition of Done section that makes accessibility a completion criterion.",
        content: `# Definition of Done: accessibility

A work item with user interface impact is not done until:

1. Automated accessibility checks pass in CI.
2. The feature is fully operable by keyboard, with visible focus.
3. New interactive elements use shared, accessible components (or the exception is documented).
4. At least one manual screen reader pass has been done on the changed flow.
5. Any known accessibility issue is tracked with an owner, not silently deferred.

Accessibility checks are not skipped under deadline pressure. If a gap is accepted, it is recorded as tracked accessibility debt.
`,
        notes: ["Adjust item 4 to the assistive technology your team can actually test (VoiceOver, NVDA, TalkBack)."],
      };
  }
}
