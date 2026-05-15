import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "../../..");
const SCRIPT_PATH = path.join(REPO_ROOT, "scripts", "check_vercel_env_file.mjs");

const tempPaths = [];

const writeEnvFile = (content) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "shortpulse-env-file-cli-"));
  const filePath = path.join(tempDir, ".env.test");
  fs.writeFileSync(filePath, content);
  tempPaths.push(tempDir);
  return filePath;
};

afterEach(() => {
  for (const tempPath of tempPaths.splice(0)) {
    fs.rmSync(tempPath, { recursive: true, force: true });
  }
});

describe("check_vercel_env_file CLI", () => {
  it("allows preview env files to omit SHORTPULSE_PUBLIC_API_BASE_URL when APP_BASE_URL is set", () => {
    const filePath = writeEnvFile(`
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon
SUPABASE_SERVICE_ROLE_KEY=service
FAL_KEY=fal
SHORTPULSE_ADMIN_EMAILS=ops@example.com
APP_BASE_URL=https://preview.shortpulse.test
`);

    expect(() =>
      execFileSync(
        process.execPath,
        [SCRIPT_PATH, "--file", filePath, "--environment", "preview"],
        {
          cwd: REPO_ROOT,
          stdio: "pipe",
        }
      )
    ).not.toThrow();
  });

  it("fails when deployed public-origin env values disagree", () => {
    const filePath = writeEnvFile(`
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon
SUPABASE_SERVICE_ROLE_KEY=service
FAL_KEY=fal
SHORTPULSE_ADMIN_EMAILS=ops@example.com
APP_BASE_URL=https://www.shortpulse.ai
SHORTPULSE_PUBLIC_API_BASE_URL=https://preview.shortpulse.test
STRIPE_SECRET_KEY=stripe
STRIPE_WEBHOOK_SECRET=whsec
`);

    expect(() =>
      execFileSync(
        process.execPath,
        [SCRIPT_PATH, "--file", filePath, "--environment", "production"],
        {
          cwd: REPO_ROOT,
          stdio: "pipe",
        }
      )
    ).toThrowError(/APP_BASE_URL and SHORTPULSE_PUBLIC_API_BASE_URL must match/);
  });
});
