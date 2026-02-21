// Disable-path + continuity-focused regression test gate for AI Studio agent.
// Run with: node scripts/check_agent_disable_continuity.js
const { spawnSync } = require("child_process");
const path = require("path");

const REPO_ROOT = process.cwd();
const FRONTEND_DIR = path.join(REPO_ROOT, "frontend");

const args = [
  "run",
  "test",
  "--",
  "tests/api/studio-agent.runtime.test.ts",
  "features/ai-agent/__tests__/useAiAgent.test.ts",
];

const result = spawnSync("npm", args, {
  cwd: FRONTEND_DIR,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Agent disable/continuity tests passed.");
