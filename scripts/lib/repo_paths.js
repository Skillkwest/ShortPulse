const path = require("path");

const SCRIPTS_LIB_ROOT = __dirname;
const SCRIPTS_ROOT = path.resolve(SCRIPTS_LIB_ROOT, "..");
const REPO_ROOT = path.resolve(SCRIPTS_ROOT, "..");
const FRONTEND_ROOT = path.join(REPO_ROOT, "frontend");

function resolveRepoPath(...segments) {
  return path.join(REPO_ROOT, ...segments);
}

function resolveFrontendPath(...segments) {
  return path.join(FRONTEND_ROOT, ...segments);
}

module.exports = {
  FRONTEND_ROOT,
  REPO_ROOT,
  resolveFrontendPath,
  resolveRepoPath,
};
