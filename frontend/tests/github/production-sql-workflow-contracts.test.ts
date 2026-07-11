/**
 * Security contract tests for production SQL GitHub Actions workflows.
 * These source-level checks keep production database credentials bound to the
 * reviewed production ref and to the exact steps that need database access.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const WORKFLOW_ROOT = resolve(process.cwd(), "../.github/workflows");
const IMMUTABLE_ACTION_PATTERN = /^\s*uses:\s+[^\s@]+@[0-9a-f]{40}(?:\s+#.*)?$/gm;

const WORKFLOWS = [
  {
    file: "apply-control-plane-ops-sql.yml",
    job: "apply_control_plane_ops_sql",
    databaseSteps: ["Apply selected control-plane SQL"],
  },
  {
    file: "apply-hosted-sql-migration.yml",
    job: "apply_hosted_sql_migration",
    databaseSteps: [
      "Apply selected hosted SQL migration",
      "Verify hosted SQL lint after apply",
      "Verify hosted runtime schema contract after apply",
    ],
  },
  {
    file: "apply-conversation-state-migration-028.yml",
    job: "apply_conversation_state_migration",
    databaseSteps: ["Apply selected migration SQL"],
  },
] as const;

function readWorkflow(file: string): string {
  return readFileSync(resolve(WORKFLOW_ROOT, file), "utf8");
}

function namedStepBlocks(source: string): Array<{ name: string; source: string }> {
  const starts = [...source.matchAll(/^ {6}- name: (.+)$/gm)];
  return starts.map((match, index) => ({
    name: match[1].trim(),
    source: source.slice(match.index, starts[index + 1]?.index ?? source.length),
  }));
}

describe("production SQL workflow security contracts", () => {
  for (const workflow of WORKFLOWS) {
    describe(workflow.file, () => {
      const source = readWorkflow(workflow.file);

      it("is production-only before environment-secret access", () => {
        expect(source).toContain(`${workflow.job}:\n    if: github.ref == 'refs/heads/production'`);
        expect(source).toContain("    environment: Production");
        expect(source).not.toContain("target_environment:");

        const assertionIndex = source.indexOf("      - name: Assert production dispatch ref");
        const checkoutIndex = source.indexOf("      - uses: actions/checkout@");
        const firstSecretIndex = source.indexOf("secrets.");
        expect(assertionIndex).toBeGreaterThan(-1);
        expect(assertionIndex).toBeLessThan(checkoutIndex);
        expect(assertionIndex).toBeLessThan(firstSecretIndex);
        expect(source).toContain('if [ "$GITHUB_REF" != "refs/heads/production" ]; then');
      });

      it("checks out production explicitly and proves the checkout SHA", () => {
        expect(source).toMatch(
          /uses: actions\/checkout@[0-9a-f]{40}[^\n]*\n {8}with:\n {10}ref: refs\/heads\/production/
        );
        expect(source).toContain('CHECKOUT_SHA="$(git rev-parse HEAD)"');
        expect(source).toContain('if [ "$CHECKOUT_SHA" != "$GITHUB_SHA" ]; then');
        expect(source).toContain('echo "sha=$CHECKOUT_SHA" >> "$GITHUB_OUTPUT"');
      });

      it("pins every external action and grants only read access to contents", () => {
        const allUses = source.match(/^\s*uses:\s+.*$/gm) ?? [];
        const immutableUses = source.match(IMMUTABLE_ACTION_PATTERN) ?? [];
        expect(immutableUses).toEqual(allUses);
        expect(source).toContain("    permissions:\n      contents: read");
        expect(source).not.toMatch(/^\s+\w[\w-]*:\s+write\s*$/m);
      });

      it("scopes the production database secret to exact database steps", () => {
        const secretSteps = namedStepBlocks(source)
          .filter(({ source: stepSource }) => stepSource.includes("secrets.SUPABASE_DB_URL"))
          .map(({ name }) => name);
        expect(secretSteps).toEqual(workflow.databaseSteps);
      });

      it("hashes the selected SQL and writes the required evidence summary", () => {
        expect(source).toMatch(/sha256sum "\$(?:SQL_FILE|SQL_REALPATH)"/);
        for (const label of [
          "Trigger ref",
          "Trigger SHA",
          "Checkout SHA",
          "SQL file",
          "SQL SHA-256",
          "Actor",
          "Environment",
          "Result",
        ]) {
          expect(source).toContain(`printf '%s\\n' "- ${label}:`);
        }
        expect(source).toContain("      - name: Write step summary");
        expect(source).toContain("        if: always()");
        const summaryStep = namedStepBlocks(source).find(
          ({ name }) => name === "Write step summary"
        );
        expect(summaryStep?.source).toContain("        env:");
        expect(summaryStep?.source.split("        run: |", 2)[1]).not.toContain("${{");
      });
    });
  }
});
