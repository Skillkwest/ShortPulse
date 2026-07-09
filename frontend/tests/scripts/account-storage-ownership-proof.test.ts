import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd(), "..");
const scriptPath = path.join(repoRoot, "frontend/scripts/account_storage_ownership_proof.mjs");
const packageJsonPath = path.join(repoRoot, "frontend/package.json");

describe("account storage ownership proof runner", () => {
  it("is wired as a report-only operator command", () => {
    const script = fs.readFileSync(scriptPath, "utf8");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["media:account-storage-proof"]).toBe(
      "node ./scripts/account_storage_ownership_proof.mjs"
    );
    expect(script).toContain("REPORT_SQL_PATH");
    expect(script).toContain("check_account_storage_ownership_proof.sql");
    expect(script).toContain('boundary: "report_only_no_deletion_authority"');
    expect(script).toContain("PGDATABASE: databaseUrl");
    expect(script).toContain("SHORTPULSE_PRODUCTION_DB_URL");

    for (const forbiddenFlag of ["--apply", "--delete", "--cleanup", "--remove"]) {
      expect(script).toContain(forbiddenFlag);
    }
    expect(script).not.toContain(".remove(");
    expect(script).not.toContain(".delete(");
    expect(script).not.toContain("storage.from(");
  });
});
