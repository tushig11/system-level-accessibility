import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({ command: "node", args: ["dist/index.js"] });
const client = new Client({ name: "smoke-test", version: "0.0.0" });
await client.connect(transport);

const call = async (name, args) => {
  const res = await client.callTool({ name, arguments: args });
  assert.ok(!res.isError, `${name} returned an error: ${JSON.stringify(res.content)}`);
  return JSON.parse(res.content[0].text);
};

let passed = 0;
const ok = (label, fn) => {
  fn();
  passed++;
  console.log(`  ok  ${label}`);
};

// ---- discovery
const tools = (await client.listTools()).tools.map((t) => t.name).sort();
ok("lists 6 tools", () =>
  assert.deepEqual(tools, [
    "assess_maturity",
    "generate_enforcement_artifact",
    "get_adoption_plan",
    "get_layer",
    "get_pattern",
    "review_markup",
  ]),
);

// ---- get_layer: numbering must match the official model
const model = await call("get_layer", {});
ok("six layers, L2=Distribution, L3=Preservation", () => {
  assert.equal(model.layers.length, 6);
  assert.equal(model.layers[1].name, "Distribution Layer");
  assert.equal(model.layers[2].name, "Preservation Layer");
  assert.equal(model.layers[3].name, "Enforcement Layer");
  assert.equal(model.layers[4].name, "Boundary Layer");
});
const l3 = await call("get_layer", { layer: "3" });
ok("get_layer accepts bare number", () => assert.equal(l3.id, "L3"));
const bad = await client.callTool({ name: "get_layer", arguments: { layer: "L9" } });
ok("unknown layer is an error", () => assert.equal(bad.isError, true));
ok("every practice defines partial, enforced and a verification step", () => {
  for (const layer of model.layers)
    for (const pr of layer.practices) {
      assert.ok(pr.partial && pr.enforced && pr.verify, `${pr.id} is missing evidence fields`);
    }
});

// ---- assess_maturity (levels: absent | partial | enforced)
const a1 = await call("assess_maturity", {
  teamSize: "startup",
  practices: {
    "L1.semantic-html": "enforced",
    "L1.accessible-names": "enforced",
    "L2.shared-library": "partial",
    "L4.ci-checks": "partial",
    "bogus.id": "enforced",
  },
});
ok("startup assessment: only L1/L2/L4 relevant, unknown ids reported", () => {
  assert.deepEqual(a1.unknownPracticeIds, ["bogus.id"]);
  assert.deepEqual(a1.layers.filter((l) => l.relevant).map((l) => l.layer), ["L1", "L2", "L4"]);
  assert.ok(!a1.priorities.some((p) => p.layer === "L5"), "L5 must not be prioritized for startups");
});
ok("partial counts 0.5 and unreported practices count as absent", () => {
  const l1 = a1.layers.find((l) => l.layer === "L1");
  const l2 = a1.layers.find((l) => l.layer === "L2");
  const l4 = a1.layers.find((l) => l.layer === "L4");
  assert.equal(l1.coverage, 0.5); // 2 enforced of 4
  assert.equal(l2.coverage, 0.17); // 0.5 of 3
  assert.equal(l4.coverage, 0.13); // 0.5 of 4
  assert.ok(a1.unreported.includes("L1.keyboard-focus"));
});
ok("lowest coverage layer is prioritized first", () => assert.equal(a1.priorities[0].layer, "L4"));
ok("partial practices say what enforced looks like; enforced ones say how to confirm", () => {
  const ci = a1.layers.find((l) => l.layer === "L4").practices.find((x) => x.id === "L4.ci-checks");
  assert.match(ci.toReachEnforced, /blocks the merge/);
  const names = a1.layers.find((l) => l.layer === "L1").practices.find((x) => x.id === "L1.accessible-names");
  assert.ok(names.confirmBy && !names.toReachEnforced);
});
ok("assessment states its limits", () => {
  assert.equal(a1.measure, "practice coverage (self-reported)");
  assert.match(a1.limits, /not a WCAG conformance result/);
});
const allEnforced = Object.fromEntries(
  model.layers.filter((l) => ["L1", "L2", "L4"].includes(l.id)).flatMap((l) => l.practices.map((pr) => [pr.id, "enforced"])),
);
const full = await call("assess_maturity", { teamSize: "solo", practices: allEnforced });
ok("solo team with every relevant practice enforced has no priorities", () => {
  assert.equal(full.priorities.length, 0);
  assert.match(full.summary, /Confirm each with its verification step/);
});
let invalidRejected = false;
try {
  const r = await client.callTool({
    name: "assess_maturity",
    arguments: { teamSize: "solo", practices: { "L1.semantic-html": "yes" } },
  });
  invalidRejected = r.isError === true;
} catch {
  invalidRejected = true;
}
ok("invalid level is rejected", () => assert.equal(invalidRejected, true));

// ---- get_pattern
const plist = await call("get_pattern", {});
ok("lists 7 patterns pinned to a roqn-ui commit", () => {
  assert.equal(plist.patterns.length, 7);
  assert.match(plist.source.commit, /^[0-9a-f]{40}$/);
});
const pl4 = await call("get_pattern", { layer: "L4" });
ok("layer filter returns only patterns that touch L4", () =>
  assert.deepEqual(pl4.patterns.map((x) => x.id).sort(), [
    "justified-lint-bypass",
    "placeholder-is-not-a-label",
    "steer-to-primitives",
  ]));
const pbtn = await call("get_pattern", { id: "icon-button-name-by-type" });
ok("pattern carries excerpts with permalinks, limits and caveats", () => {
  assert.ok(pbtn.excerpts[0].text.includes("IconOnlyButton"));
  assert.match(pbtn.excerpts[0].url, /github\.com\/tushig11\/roqn-ui\/blob\/[0-9a-f]{40}\/src\/components\/Button\/Button\.tsx/);
  assert.ok(pbtn.prevents.length && pbtn.doesNotPrevent.length && pbtn.caveats.length);
});
const pbad = await client.callTool({ name: "get_pattern", arguments: { id: "nope" } });
ok("unknown pattern is an error", () => assert.equal(pbad.isError, true));

// ---- get_adoption_plan
const plan = await call("get_adoption_plan", { teamSize: "growing" });
ok("growing plan covers L2-L6", () =>
  assert.deepEqual(plan.layers.map((l) => l.id), ["L2", "L3", "L4", "L5", "L6"]));

// ---- review_markup
const badCode = `
export function Toolbar({ onSave, items }) {
  return (
    <div>
      <div onClick={() => onSave()}>Save</div>
      <button onClick={() => onSave()}><svg viewBox="0 0 10 10"><path d="M0 0"/></svg></button>
      <img src="/logo.png" />
      <input type="text" name="q" />
      <a onClick={() => go()}>More</a>
      <a href="#">Top</a>
      <span role="button" onClick={() => onSave()}>Role only</span>
      <div tabIndex="3">x</div>
      <button aria-hidden="true">hidden</button>
      <input type="search" placeholder="Search" />
    </div>
  );
}
const css = \`button { outline: none; }\`;
`;
const r = await call("review_markup", { code: badCode });
const rules = new Set(r.findings.map((f) => f.rule));
ok("flags each seeded violation", () => {
  for (const rule of [
    "clickable-non-semantic",
    "button-name",
    "img-alt",
    "input-label",
    "anchor-without-href",
    "anchor-hash-href",
    "role-missing-keyboard",
    "positive-tabindex",
    "aria-hidden-focusable",
    "focus-outline-removed",
    "placeholder-as-label",
  ]) {
    assert.ok(rules.has(rule), `missing rule ${rule}; got ${[...rules].join(", ")}`);
  }
});
ok("every finding carries a systemFix and layer L1", () => {
  for (const f of r.findings) {
    assert.ok(f.systemFix && f.systemFix.length > 10);
    assert.equal(f.layer, "L1");
  }
});
ok("reports line numbers", () => {
  const img = r.findings.find((f) => f.rule === "img-alt");
  assert.equal(img.line, 7);
});
ok("a placeholder-only input reports placeholder-as-label, not a duplicate input-label", () => {
  const inputs = r.findings.filter((f) => f.element === "<input>").map((f) => [f.line, f.rule]);
  assert.deepEqual(inputs, [
    [8, "input-label"], // no placeholder: plain unlabeled input
    [14, "placeholder-as-label"], // placeholder only: one finding, not two
  ]);
});
ok("findings link to the pattern that shows the system-level fix", () => {
  const byRule = (rule) => r.findings.find((f) => f.rule === rule);
  assert.equal(byRule("button-name").pattern, "icon-button-name-by-type");
  assert.equal(byRule("input-label").pattern, "input-label-association");
  assert.equal(byRule("placeholder-as-label").pattern, "placeholder-is-not-a-label");
  assert.equal(byRule("clickable-non-semantic").pattern, "steer-to-primitives");
  assert.equal(byRule("focus-outline-removed").pattern, "tokens-focus-and-contrast");
  assert.equal(byRule("img-alt").pattern, undefined);
});

const goodCode = `
export function Form({ onSave, title }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(); }}>
      <label htmlFor="name">Name</label>
      <input id="name" type="text" />
      <label>Email <input type="email" /></label>
      <button type="submit" onClick={() => onSave()}>Save</button>
      <button aria-label="Close" onClick={() => close()}><svg viewBox="0 0 10 10" /></button>
      <button onClick={() => x()}>{title}</button>
      <img src="/a.png" alt="" />
      <a href="/home">Home</a>
      <input placeholder="Search" aria-label="Search" />
      <Button {...props} />
    </form>
  );
}
`;
const g = await call("review_markup", { code: goodCode });
ok("clean snippet yields zero errors and zero warnings", () => {
  assert.equal(g.counts.error, 0, JSON.stringify(g.findings, null, 2));
  assert.equal(g.counts.warning, 0, JSON.stringify(g.findings, null, 2));
});

const spread = await call("review_markup", { code: `<button {...props} onClick={() => x()}><svg/></button><img {...p} />` });
ok("spread props suppress absence-based findings", () => {
  assert.equal(spread.counts.error, 0, JSON.stringify(spread.findings));
  assert.ok(spread.skippedDueToSpread >= 2);
});

// ---- generate_enforcement_artifact
for (const kind of ["github-actions-axe", "playwright-axe-test", "pr-template", "definition-of-done"]) {
  const art = await call("generate_enforcement_artifact", { kind });
  ok(`artifact ${kind}`, () => {
    assert.ok(art.path && art.content.length > 100);
    assert.equal(art.layer, "L4");
  });
}
const wf = await call("generate_enforcement_artifact", {
  kind: "github-actions-axe",
  baseUrl: "http://localhost:3000",
  startCommand: "npm run start",
});
ok("workflow honors options", () => {
  assert.ok(wf.content.includes("http://localhost:3000"));
  assert.ok(wf.content.includes("npm run start &"));
});
const pw = await call("generate_enforcement_artifact", { kind: "playwright-axe-test", routes: ["/", "/login"] });
ok("playwright test honors routes", () => assert.ok(pw.content.includes('["/", "/login"]')));

// ---- resources and prompts
const res = (await client.listResources()).resources.map((r) => r.uri);
ok("lists static + templated resources", () => {
  assert.ok(res.includes("sla://model"));
  assert.ok(res.includes("sla://layer/L4"));
  assert.ok(res.includes("sla://guide/solo"));
  assert.ok(res.includes("sla://pattern/native-dialog-modal"));
});
const patRes = await client.readResource({ uri: "sla://pattern/native-dialog-modal" });
ok("reads pattern resource", () => {
  const pat = JSON.parse(patRes.contents[0].text);
  assert.equal(pat.id, "native-dialog-modal");
  assert.ok(pat.caveats.some((c) => /scroll lock/i.test(c)));
});
const layerRes = await client.readResource({ uri: "sla://layer/L5" });
ok("reads layer resource", () => assert.equal(JSON.parse(layerRes.contents[0].text).name, "Boundary Layer"));
const prompt = await client.getPrompt({ name: "system-accessibility-review", arguments: { system: "React storefront, 20 engineers" } });
ok("prompt renders", () => assert.ok(prompt.messages[0].content.text.includes("React storefront")));

// ---- AI generation rules
ok("lists ai-rules resource", () => assert.ok(res.includes("sla://ai-rules")));
const aiRes = await client.readResource({ uri: "sla://ai-rules" });
ok("ai-rules covers generation, verify loop and limits", () => {
  const t = aiRes.contents[0].text;
  assert.ok(/native elements/i.test(t));
  assert.ok(/placeholder is not a label/i.test(t));
  assert.ok(t.includes("review_markup"));
  assert.ok(/does not make output accessible by itself/i.test(t));
});
const genPrompt = await client.getPrompt({ name: "generate-accessible-ui", arguments: { task: "login form", stack: "React" } });
ok("generate prompt includes task, rules and review loop", () => {
  const t = genPrompt.messages[0].content.text;
  assert.ok(t.includes("login form") && t.includes("Stack: React"));
  assert.ok(t.includes("Call review_markup"));
});
const aiBad = await call("review_markup", { code: "<div onClick={go}>Go</div>" });
ok("loop premise: review_markup flags what the rules forbid", () =>
  assert.ok(aiBad.findings.some((f) => f.rule === "clickable-non-semantic")));

// ---- next actions and manual test script
const manual = await call("generate_enforcement_artifact", { kind: "manual-at-test-script" });
ok("manual test script covers keyboard, screen reader and recording", () => {
  assert.equal(manual.path, "docs/manual-accessibility-test.md");
  assert.ok(/Keyboard only/.test(manual.content) && /Screen reader pass/.test(manual.content) && /Record results/.test(manual.content));
  assert.ok(manual.notes.some((n) => /documentation/i.test(n)));
});
const l4 = await call("assess_maturity", { teamSize: "startup", practices: {} });
ok("every non-enforced practice has a first step", () => {
  for (const l of l4.layers) for (const x of l.practices) assert.ok(x.nextAction?.firstStep, `no next action for ${x.id}`);
});
ok("priorities carry actions for the top practices", () =>
  assert.ok(l4.priorities.every((p) => p.actions.length > 0 && p.actions.every((a) => a.nextAction))));
const kinds = ["github-actions-axe", "playwright-axe-test", "pr-template", "definition-of-done", "manual-at-test-script"];
const patternIds = (await call("get_pattern", {})).patterns.map((p) => p.id);
ok("linked artifacts and patterns exist", () => {
  for (const l of l4.layers) for (const x of l.practices) {
    for (const a of x.nextAction.artifacts ?? []) assert.ok(kinds.includes(a), `${x.id}: unknown artifact ${a}`);
    for (const pt of x.nextAction.patterns ?? []) assert.ok(patternIds.includes(pt), `${x.id}: unknown pattern ${pt}`);
  }
});
const enf = await call("assess_maturity", { teamSize: "solo", practices: { "L1.semantic-html": "enforced" } });
ok("enforced practice gets confirmBy, not nextAction", () => {
  const pr = enf.layers[0].practices.find((x) => x.id === "L1.semantic-html");
  assert.ok(pr.confirmBy && !pr.nextAction);
});

// ---- comments are not code
const commented = await call("review_markup", { code: '{/* <div onClick={x}>old</div> */}\n<!-- <img src="a.png"> -->\n<button type="button">Ok</button>' });
ok("commented-out markup is not reviewed", () => assert.equal(commented.findings.length, 0));
const afterComment = await call("review_markup", { code: '{/* note */}\n<img src="a.png" />' });
ok("line numbers survive comment removal", () => assert.deepEqual(afterComment.findings.map((f) => [f.line, f.rule]), [[2, "img-alt"]]));
const glob = await call("review_markup", { code: '<input type="file" accept="image/*" aria-label="Upload" />\n<img src="a.png" />' });
ok("glob in attribute does not hide later findings", () => assert.deepEqual(glob.findings.map((f) => f.rule), ["img-alt"]));

await client.close();
console.log(`\n${passed} checks passed`);
