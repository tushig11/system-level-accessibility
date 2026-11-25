#!/usr/bin/env node
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ALL_PRACTICE_IDS, CORE_PRINCIPLE, LAYERS, TEAM_GUIDES, getLayer, type TeamSize } from "./data.js";
import { assess } from "./assess.js";
import { PATTERNS, PATTERN_IDS, ROQN_UI_COMMIT, ROQN_UI_REPO, getPattern } from "./patterns.js";
import { reviewMarkup } from "./review.js";
import { ARTIFACT_KINDS, generateArtifact } from "./artifacts.js";
import { AI_RULES_LIMITS, AI_VERIFY_LOOP, AI_GENERATION_RULES, aiRulesMarkdown } from "./ai-rules.js";

const server = new McpServer({
  name: "system-level-accessibility",
  version: "0.2.0",
});

const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

const teamSizeSchema = z.enum(["solo", "startup", "growing"]).describe(
  "solo = 1-3 people, startup = 4-15 people, growing = 16-50 people",
);

// ---------------------------------------------------------------- tools

server.registerTool(
  "get_layer",
  {
    title: "Get methodology layer",
    description:
      "Return one layer of the six-layer System-Level Accessibility model (id L1-L6, or 1-6): outcome, key practices with ids, and the failure mode when the layer is absent. Omit `layer` to get the whole model.",
    inputSchema: {
      layer: z.string().optional().describe("L1..L6 or 1..6. Omit for all six layers."),
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  async ({ layer }) => {
    if (!layer) return json({ principle: CORE_PRINCIPLE, layers: LAYERS });
    const found = getLayer(layer);
    if (!found) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: `Unknown layer "${layer}". Use L1-L6.` }],
      };
    }
    return json(found);
  },
);

server.registerTool(
  "assess_maturity",
  {
    title: "Assess practice coverage by layer",
    description:
      "Given a team size and, for each practice, a self-reported level (absent, partial or enforced), report per-layer practice coverage and prioritized next steps for the layers the methodology recommends at that size. Practice ids and the evidence that defines each level come from get_layer. Practices not mentioned count as absent. Deterministic. This is a self-assessment of practice coverage, not a measurement of accessibility or WCAG conformance; confirm every 'enforced' level with the verification step returned.",
    inputSchema: {
      teamSize: teamSizeSchema,
      practices: z
        .record(z.string(), z.enum(["absent", "partial", "enforced"]))
        .describe(`Map of practice id to level. Valid ids: ${ALL_PRACTICE_IDS.join(", ")}`),
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  async ({ teamSize, practices }) => json(assess(teamSize, practices)),
);

server.registerTool(
  "get_pattern",
  {
    title: "Get an implementation pattern",
    description:
      "Implementation patterns from the roqn-ui reference implementation, showing how a layer's requirement is enforced in code (types that require an accessible name, lint rules that steer to shared components, native dialog, tokens). Each pattern has verbatim source excerpts with permalinks, what it prevents, what it does not prevent, and caveats. Omit `id` to list all patterns, optionally filtered by `layer`.",
    inputSchema: {
      id: z.string().optional().describe(`Pattern id. One of: ${PATTERN_IDS.join(", ")}`),
      layer: z.string().optional().describe("Filter the list by layer (L1..L6). Ignored when id is given."),
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  async ({ id, layer }) => {
    if (id) {
      const found = getPattern(id);
      if (!found) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Unknown pattern "${id}". Valid ids: ${PATTERN_IDS.join(", ")}` }],
        };
      }
      return json(found);
    }
    const wanted = layer ? getLayer(layer)?.id : undefined;
    if (layer && !wanted) {
      return { isError: true, content: [{ type: "text" as const, text: `Unknown layer "${layer}". Use L1-L6.` }] };
    }
    return json({
      source: { repo: ROQN_UI_REPO, commit: ROQN_UI_COMMIT },
      patterns: PATTERNS.filter((x) => !wanted || x.layers.includes(wanted)).map((x) => ({
        id: x.id,
        title: x.title,
        layers: x.layers,
        problem: x.problem,
      })),
    });
  },
);

server.registerTool(
  "get_adoption_plan",
  {
    title: "Get adoption guide for a team size",
    description:
      "Return the scaled implementation guide for a team size: focus, key layers (with their definitions), practices, what to avoid, and expected outcome.",
    inputSchema: { teamSize: teamSizeSchema },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  async ({ teamSize }) => {
    const guide = TEAM_GUIDES[teamSize as TeamSize];
    return json({
      ...guide,
      layers: guide.keyLayers.map((id) => {
        const l = getLayer(id)!;
        return { id: l.id, name: l.name, outcome: l.outcome, practices: l.practices };
      }),
    });
  },
);

server.registerTool(
  "review_markup",
  {
    title: "Review HTML/JSX for Layer 1 constraint violations",
    description:
      "Heuristic static review of an HTML, JSX or TSX snippet for common Architectural Constraint (Layer 1) problems: clickable non-semantic elements, missing alt text, unnamed buttons and links, unlabeled form controls, positive tabindex, aria-hidden on focusable elements, removed focus outlines. Each finding includes a local fix and a `systemFix` describing how to make the mistake impossible by construction. This is a heuristic aid, not a substitute for axe-core in CI or manual assistive technology testing.",
    inputSchema: {
      code: z.string().max(200_000).describe("HTML, JSX or TSX snippet to review."),
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  async ({ code }) => json(reviewMarkup(code)),
);

server.registerTool(
  "generate_enforcement_artifact",
  {
    title: "Generate a Layer 4 enforcement artifact",
    description:
      "Generate ready-to-commit Enforcement (Layer 4) files: a GitHub Actions workflow that runs axe-core via Playwright, the Playwright test itself, a pull request template with an accessibility self-assessment, a Definition of Done section, or a manual keyboard and screen reader test script. Returns file path, content and setup notes. Does not write files.",
    inputSchema: {
      kind: z.enum(ARTIFACT_KINDS as [string, ...string[]]),
      baseUrl: z.string().url().optional().describe("App URL under test. Default http://localhost:4173"),
      startCommand: z.string().optional().describe("Command that serves the built app. Default 'npm run preview'"),
      routes: z.array(z.string()).optional().describe("Routes to scan, e.g. ['/', '/login']. Default ['/']"),
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  async ({ kind, baseUrl, startCommand, routes }) =>
    json(generateArtifact(kind as (typeof ARTIFACT_KINDS)[number], { baseUrl, startCommand, routes })),
);

// ---------------------------------------------------------------- resources

server.registerResource(
  "model",
  "sla://model",
  {
    title: "Six-layer model",
    description: "The complete six-layer System-Level Accessibility model as JSON.",
    mimeType: "application/json",
  },
  async (uri) => ({
    contents: [
      { uri: uri.href, mimeType: "application/json", text: JSON.stringify({ principle: CORE_PRINCIPLE, layers: LAYERS }, null, 2) },
    ],
  }),
);

server.registerResource(
  "layer",
  new ResourceTemplate("sla://layer/{id}", {
    list: async () => ({
      resources: LAYERS.map((l) => ({ uri: `sla://layer/${l.id}`, name: `${l.id} ${l.name}`, mimeType: "application/json" })),
    }),
  }),
  { title: "Layer", description: "One layer of the model (L1-L6).", mimeType: "application/json" },
  async (uri, { id }) => {
    const layer = getLayer(String(id));
    if (!layer) throw new Error(`Unknown layer: ${id}`);
    return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(layer, null, 2) }] };
  },
);

server.registerResource(
  "team-guide",
  new ResourceTemplate("sla://guide/{size}", {
    list: async () => ({
      resources: (Object.keys(TEAM_GUIDES) as TeamSize[]).map((s) => ({
        uri: `sla://guide/${s}`,
        name: `${TEAM_GUIDES[s].title} (${TEAM_GUIDES[s].headcount})`,
        mimeType: "application/json",
      })),
    }),
  }),
  { title: "Scaled guide", description: "Adoption guide for solo, startup or growing teams.", mimeType: "application/json" },
  async (uri, { size }) => {
    const guide = TEAM_GUIDES[String(size) as TeamSize];
    if (!guide) throw new Error(`Unknown team size: ${size}. Use solo, startup or growing.`);
    return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(guide, null, 2) }] };
  },
);

server.registerResource(
  "pattern",
  new ResourceTemplate("sla://pattern/{id}", {
    list: async () => ({
      resources: PATTERNS.map((x) => ({ uri: `sla://pattern/${x.id}`, name: x.title, mimeType: "application/json" })),
    }),
  }),
  { title: "Implementation pattern", description: "A pattern from the roqn-ui reference implementation.", mimeType: "application/json" },
  async (uri, { id }) => {
    const found = getPattern(String(id));
    if (!found) throw new Error(`Unknown pattern: ${id}`);
    return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(found, null, 2) }] };
  },
);

server.registerResource(
  "ai-rules",
  "sla://ai-rules",
  {
    title: "Rules for AI-generated UI",
    description:
      "Rules an AI assistant should follow when generating UI code, and the generate-then-review loop to run before showing the code.",
    mimeType: "text/markdown",
  },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "text/markdown", text: aiRulesMarkdown() }],
  }),
);

// ---------------------------------------------------------------- prompts

server.registerPrompt(
  "generate-accessible-ui",
  {
    title: "Generate UI with the accessibility rules applied",
    description: "Generate UI code under the Layer 1 rules, then review it with review_markup and fix findings before showing it.",
    argsSchema: {
      task: z.string().describe("The UI to build."),
      stack: z.string().optional().describe("Framework and component library in use, if any."),
    },
  },
  ({ task, stack }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text:
            `Build this UI: ${task}\n${stack ? `Stack: ${stack}\n` : ""}\n` +
            `Rules to follow while generating:\n${AI_GENERATION_RULES.map((r, i) => `${i + 1}. ${r}`).join("\n")}\n\n` +
            `Then:\n${AI_VERIFY_LOOP.map((r, i) => `${i + 1}. ${r}`).join("\n")}\n\n` +
            AI_RULES_LIMITS,
        },
      },
    ],
  }),
);

server.registerPrompt(
  "system-accessibility-review",
  {
    title: "Review a system against the six layers",
    description: "Walk through all six layers for a described system or codebase and identify the weakest layer.",
    argsSchema: {
      system: z.string().describe("Short description of the product, stack and team."),
      teamSize: teamSizeSchema.optional(),
    },
  },
  ({ system, teamSize }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text:
            `Review this system using the six-layer System-Level Accessibility model.\n\n` +
            `System: ${system}\n${teamSize ? `Team size: ${teamSize}\n` : ""}\n` +
            `1. Call get_layer to load the model.\n` +
            `2. For each practice, ask the user for evidence and classify it as absent, partial or enforced using the definitions from get_layer. Do not assume; ask where evidence is missing.\n` +
            `3. Call assess_maturity with the levels the user confirms.\n` +
            `4. Name the layer with the lowest practice coverage, the failure mode it leaves open, and the two smallest next steps. Say plainly that this is a self-assessment of practice coverage, not a measure of accessibility.\n` +
            `5. Where the user shares markup, use review_markup and show the linked pattern from get_pattern for each finding. Where CI is missing, offer generate_enforcement_artifact.\n` +
            `Remember: automated checks catch only part of accessibility issues; keep manual assistive technology testing in the plan.`,
        },
      },
    ],
  }),
);

// ---------------------------------------------------------------- start

const transport = new StdioServerTransport();
await server.connect(transport);
