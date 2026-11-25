/**
 * Verifies that every pattern excerpt appears verbatim in the roqn-ui source.
 *
 * Usage: ROQN_UI_PATH=/path/to/roqn-ui node test/patterns-verify.mjs
 * Without ROQN_UI_PATH the check is skipped (so `npm test` works for people without a checkout).
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PATTERNS, ROQN_UI_COMMIT } from "../dist/patterns.js";

const root = process.env.ROQN_UI_PATH;
if (!root) {
  console.log("patterns-verify: ROQN_UI_PATH not set, skipping excerpt verification");
  process.exit(0);
}
assert.ok(existsSync(root), `ROQN_UI_PATH does not exist: ${root}`);

try {
  const head = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (head !== ROQN_UI_COMMIT) {
    console.warn(`  warn  roqn-ui checkout is at ${head.slice(0, 7)}, patterns are pinned to ${ROQN_UI_COMMIT.slice(0, 7)}`);
  }
} catch {
  console.warn("  warn  could not read git HEAD of roqn-ui checkout");
}

let checked = 0;
for (const pattern of PATTERNS) {
  for (const e of pattern.excerpts) {
    const path = join(root, e.file);
    assert.ok(existsSync(path), `${pattern.id}: missing file ${e.file}`);
    const source = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
    assert.ok(
      source.includes(e.text),
      `${pattern.id}: excerpt not found verbatim in ${e.file}:\n---\n${e.text}\n---`,
    );
    assert.ok(e.url.includes(ROQN_UI_COMMIT) && e.url.endsWith(e.file), `${pattern.id}: bad permalink ${e.url}`);
    checked++;
  }
  assert.ok(pattern.excerpts.length > 0, `${pattern.id}: no excerpts`);
  assert.ok(pattern.prevents.length > 0 && pattern.doesNotPrevent.length > 0, `${pattern.id}: must state limits`);
}
console.log(`  ok  ${checked} excerpts across ${PATTERNS.length} patterns match roqn-ui source verbatim`);
