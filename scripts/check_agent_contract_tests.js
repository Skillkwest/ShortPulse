// Contract-focused agent API regression test gate.
// Run with: node scripts/check_agent_contract_tests.js
const { spawnSync } = require("child_process");
const path = require("path");

const REPO_ROOT = process.cwd();
const FRONTEND_DIR = path.join(REPO_ROOT, "frontend");

const args = [
  "run",
  "test",
  "--",
  "tests/api/studio-agent.runtime.test.ts",
  "tests/api/generate-prompt.sanitization.test.ts",
  "tests/api/describe-image.route.test.ts",
  "tests/api/auth-guarded-ai-routes.test.ts",
];

const result = spawnSync("npm", args, {
  cwd: FRONTEND_DIR,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Agent contract tests passed.");
