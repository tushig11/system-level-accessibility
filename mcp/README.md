# System-Level Accessibility MCP Server

An [MCP](https://modelcontextprotocol.io) server that exposes the six-layer System-Level Accessibility methodology from this repository as tools, resources and prompts, so any MCP-capable assistant can apply the model to a real codebase. It also carries implementation patterns from the [roqn-ui](https://github.com/tushig11/roqn-ui) reference implementation, showing how a layer's requirement is enforced in code.

The server is deterministic and offline. It does not call an AI model, send data anywhere, or write files.

## The model

| Layer | Name |
|---|---|
| L1 | Architectural Constraint |
| L2 | Distribution |
| L3 | Preservation |
| L4 | Enforcement |
| L5 | Boundary |
| L6 | Continuity |

Definitions live in [`../framework/v1-framework.md`](../framework/v1-framework.md) and [`../scaled`](../scaled).

## Tools

| Tool | What it does |
|---|---|
| `get_layer` | One layer (or all six): outcome, the failure mode when it is absent, and its practices. Each practice defines what `partial` and `enforced` look like and a step to verify it. |
| `assess_maturity` | Takes a team size and a level (`absent`, `partial`, `enforced`) per practice. Returns practice coverage per layer, the layers to work on first for that team size, and for each practice that is not enforced what moves it forward, one small first step, and the artifacts and patterns that help. |
| `get_adoption_plan` | The scaled guide for `solo`, `startup` or `growing` teams. |
| `get_pattern` | Implementation patterns from roqn-ui: types that require an accessible name, lint rules that steer to shared components, native dialog, tokens. Each has verbatim source excerpts with permalinks, what it prevents, what it does not, and caveats. |
| `review_markup` | Heuristic review of an HTML/JSX/TSX snippet for Layer 1 problems: clickable non-semantic elements, missing alt, unnamed buttons and links, unlabeled or placeholder-only inputs, positive tabindex, aria-hidden on focusable elements, removed focus outlines. Each finding has a local fix, a `systemFix` (how to make the mistake impossible by construction) and, where one applies, a linked pattern. |
| `generate_enforcement_artifact` | Layer 4 files: a GitHub Actions workflow, a Playwright + axe-core test, a pull request template, a Definition of Done, and a manual keyboard and screen reader test script. |

Resources: `sla://model`, `sla://layer/{id}`, `sla://guide/{size}`, `sla://pattern/{id}`, `sla://ai-rules`.
Prompts: `system-accessibility-review`, `generate-accessible-ui`.

### Using it with an AI coding assistant

`sla://ai-rules` holds the rules an assistant should follow when it generates UI: reuse shared components, use native elements, require accessible names, label every field, keep focus outlines. It also describes a loop: generate, run `review_markup`, fix the findings, then say what was and was not checked.

The `generate-accessible-ui` prompt applies the rules and the loop to a task you describe. This reduces common markup mistakes. It does not make the output accessible by itself, so keep a keyboard pass, a screen reader check and CI checks in the process.

### Patterns

| Id | Layers | Shows |
|---|---|---|
| `icon-button-name-by-type` | L1 | Requiring an accessible name through the component's types |
| `input-label-association` | L1 | Requiring a label and wiring label, error and validation state inside the component |
| `steer-to-primitives` | L1, L2, L4 | Linting raw interactive elements toward the shared components |
| `placeholder-is-not-a-label` | L4 | Rejecting placeholder text as the only accessible name |
| `justified-lint-bypass` | L4 | Requiring a justification for every lint bypass |
| `native-dialog-modal` | L1 | A dialog on the native element with the name required |
| `tokens-focus-and-contrast` | L1, L2 | Focus and color defined once as tokens, hard-coded colors linted |

Patterns are pinned to a roqn-ui commit and verified against its source by a test.

Want to try it on your product? See [TESTING.md](TESTING.md).

## Run it

Requires Node 18+.

```bash
cd mcp
npm install
npm run build
```

Add it to a client. Use the absolute path to `dist/index.js`.

Claude Code:

```bash
claude mcp add system-level-accessibility -- node /absolute/path/to/system-level-accessibility/mcp/dist/index.js
```

Claude Desktop (`claude_desktop_config.json`) or any client that uses the same format:

```json
{
  "mcpServers": {
    "system-level-accessibility": {
      "command": "node",
      "args": ["/absolute/path/to/system-level-accessibility/mcp/dist/index.js"]
    }
  }
}
```

Then ask in plain language, for example: "Use the system-level accessibility tools to assess our team. We are 12 engineers, we have a shared component library, and axe runs in CI but does not block merges."

## Test

```bash
npm test
```

Builds the server and runs an end-to-end smoke test that starts it over stdio and exercises every tool, resource and prompt.

To also verify that the pattern excerpts still match the roqn-ui source, point the test at a checkout:

```bash
ROQN_UI_PATH=/path/to/roqn-ui npm test
```

Without `ROQN_UI_PATH` that check is skipped.

## Limits

- **`assess_maturity` is a self-assessment of practice coverage.** It is not a WCAG conformance result, not a measure of user experience, and not validated against audit outcomes. The 0.5 weight for `partial` is a convention. A weak layer means the checklist has gaps there, not that the product fails users. Confirm each `enforced` level with its verification step.
- **`review_markup` is a tag-level heuristic on a single snippet.** It cannot see computed accessible names, CSS, focus order, dynamic announcements or real assistive technology behavior. A clean result means no obvious Layer 1 violations were found, not that the code is accessible. When an element uses spread props (`{...props}`), absence-based rules are skipped for that element.
- **Patterns were source-reviewed, not re-tested with assistive technology by this tool.** Each lists what it does not prevent. Type-level constraints only help TypeScript consumers, which is why the patterns pair them with lint rules.
- **Automated checks, including the generated axe-core CI test, detect only part of real-world accessibility problems.** Keep manual keyboard and screen reader testing in the process.
- **Generated CI files are starting points.** Adjust build and start commands to your project, and mark the accessibility check as a required status check, otherwise it does not enforce anything.

## License

MIT, same as the repository.
