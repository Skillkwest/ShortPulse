// Rollback-lever verification gate for AI Studio agent runtime.
// Run with: node scripts/check_agent_rollback_verification.js
const { spawnSync } = require("child_process");
const path = require("path");

const REPO_ROOT = process.cwd();
const FRONTEND_DIR = path.join(REPO_ROOT, "frontend");
const TEST_NAME_PATTERN = [
  "uses legacy V2 fallback only when explicitly enabled",
  "uses v2 orchestration path when single-stage rollback lever is enabled",
  "does not trigger legacy fallback when single-stage returns safety refusal",
  "keeps prompt-only response parity between single-stage and legacy fallback",
].join("|");

const args = [
  "run",
  "test",
  "--",
  "tests/api/studio-agent.runtime.test.ts",
  "-t",
  TEST_NAME_PATTERN,
];

const result = spawnSync("npm", args, {
  cwd: FRONTEND_DIR,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Agent rollback verification tests passed.");
