// High-confidence repository secret exposure checks.
// Run with: node scripts/check_secret_exposure.js
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const REPO_ROOT = process.cwd();

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp4",
  ".mov",
  ".mp3",
  ".wav",
  ".bin",
  ".lockb",
]);

const SECRET_CHECKS = [
  {
    name: "OpenAI token literal",
    regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}\b/g,
  },
  {
    name: "Supabase service-role token literal",
    regex: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: "Private key block",
    regex: /-----BEGIN (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----/g,
  },
  {
    name: "OPENAI_API_KEY assignment with non-placeholder value",
    regex:
      /\bOPENAI_API_KEY\s*=\s*(?!your_|example|placeholder|changeme|test|dummy|fake)[A-Za-z0-9_][^\s#"'`]{19,}/gi,
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY assignment with non-placeholder value",
    regex:
      /\bSUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!your_|example|placeholder|changeme|test|dummy|fake)[A-Za-z0-9_][^\s#"'`]{19,}/gi,
  },
  {
    name: "FAL_KEY assignment with non-placeholder value",
    regex:
      /\bFAL_KEY\s*=\s*(?!your_|example|placeholder|changeme|test|dummy|fake)[A-Za-z0-9_][^\s#"'`]{19,}/gi,
  },
];

function isLikelyTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return !BINARY_EXTENSIONS.has(ext);
}

function listTrackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return output.split("\0").filter(Boolean);
}

function collectViolationsForFile(relPath) {
  const fullPath = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(fullPath) || !isLikelyTextFile(fullPath)) {
    return [];
  }

  let content = "";
  try {
    content = fs.readFileSync(fullPath, "utf8");
  } catch {
    return [];
  }

  const violations = [];
  const lines = content.split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    for (const check of SECRET_CHECKS) {
      check.regex.lastIndex = 0;
      if (!check.regex.test(line)) continue;
      violations.push(`${relPath}:${lineIndex + 1} matched "${check.name}"`);
    }
  }

  return violations;
}

function run() {
  const trackedFiles = listTrackedFiles();
  const violations = [];

  for (const relPath of trackedFiles) {
    violations.push(...collectViolationsForFile(relPath));
  }

  if (violations.length > 0) {
    console.error("Secret exposure checks failed:");
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log("Secret exposure checks passed.");
}

run();
