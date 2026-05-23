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
    name: "Supabase auth localStorage key",
    regex: /\bsb-[A-Za-z0-9_-]+-auth-token\b/g,
  },
  {
    name: "Supabase session access token field",
    regex:
      /"access_token"\s*:\s*"(?!<redacted>|redacted|example|placeholder|changeme|test|dummy|fake)[^"]{20,}"/gi,
  },
  {
    name: "Supabase session refresh token field",
    regex:
      /"refresh_token"\s*:\s*"(?!<redacted>|redacted|example|placeholder|changeme|test|dummy|fake)[^"]{20,}"/gi,
  },
  {
    name: "Signed Supabase storage URL",
    regex:
      /https:\/\/(?!example\.supabase\.co\b)[^"'\s]+\.supabase\.co\/storage\/v1\/object\/sign\/[^"'\s]+[?&]token=(?!abc\b|abc123\b|secret\b|example|placeholder|test|dummy|fake)[^"'\s)]+/gi,
  },
];

const SENSITIVE_FILE_CHECKS = [
  {
    name: "Playwright/Supabase storage-state file",
    regex: /(^|\/).*storage[-_]?state.*\.json$/i,
  },
  {
    name: "Playwright/auth-state file",
    regex: /(^|\/).*auth[-_]?state.*\.json$/i,
  },
  {
    name: "Session-state file",
    regex: /(^|\/).*session[-_]?state.*\.json$/i,
  },
  {
    name: "Playwright .auth JSON file",
    regex: /(^|\/)\.auth\/.*\.json$/i,
  },
];

const ENV_ASSIGNMENT_CHECKS = [
  {
    name: "OPENAI_API_KEY assignment with non-placeholder value",
    key: "OPENAI_API_KEY",
    regex:
      /\bOPENAI_API_KEY\s*=\s*(?!your_|example|placeholder|changeme|test|dummy|fake)[A-Za-z0-9_][^\s#"'`]{19,}/gi,
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY assignment with non-placeholder value",
    key: "SUPABASE_SERVICE_ROLE_KEY",
    regex:
      /\bSUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!your_|example|placeholder|changeme|test|dummy|fake)[A-Za-z0-9_][^\s#"'`]{19,}/gi,
  },
  {
    name: "FAL_KEY assignment with non-placeholder value",
    key: "FAL_KEY",
    regex:
      /\bFAL_KEY\s*=\s*(?!your_|example|placeholder|changeme|test|dummy|fake)[A-Za-z0-9_][^\s#"'`]{19,}/gi,
  },
];

const PLACEHOLDER_VALUE_REGEX =
  /^(["']?)(?:your_|example|placeholder|changeme|test|test-|dummy|fake|<redacted>|redacted)/i;

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

function collectViolationsForPath(relPath) {
  const fullPath = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    return [];
  }
  const violations = [];
  for (const check of SENSITIVE_FILE_CHECKS) {
    check.regex.lastIndex = 0;
    if (!check.regex.test(relPath)) continue;
    violations.push(`${relPath} matched sensitive filename "${check.name}"`);
  }
  return violations;
}

function extractEnvAssignmentValue(line, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = line.match(new RegExp(`\\b${escapedKey}\\s*=\\s*([^\\s#;]+)`));
  return match ? match[1].trim() : "";
}

function isRuntimeEnvReference(value) {
  return (
    value.startsWith("process.env.") ||
    value.startsWith("import.meta.env.") ||
    value.startsWith("Deno.env.") ||
    value === "originalOpenAiApiKey" ||
    value === "originalSupabaseServiceRoleKey" ||
    value === "originalFalKey"
  );
}

function isPlaceholderValue(value) {
  return PLACEHOLDER_VALUE_REGEX.test(value.replace(/^["']|["']$/g, ""));
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
    for (const check of ENV_ASSIGNMENT_CHECKS) {
      check.regex.lastIndex = 0;
      if (!check.regex.test(line)) continue;
      const value = extractEnvAssignmentValue(line, check.key);
      if (isRuntimeEnvReference(value) || isPlaceholderValue(value)) continue;
      violations.push(`${relPath}:${lineIndex + 1} matched "${check.name}"`);
    }
  }

  return violations;
}

function run() {
  const trackedFiles = listTrackedFiles();
  const violations = [];

  for (const relPath of trackedFiles) {
    violations.push(...collectViolationsForPath(relPath));
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
