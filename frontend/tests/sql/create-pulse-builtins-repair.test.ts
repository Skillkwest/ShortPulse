import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const forwardMigrationPath = path.resolve(
  process.cwd(),
  "../sql/migrations/199_repair_create_pulse_builtin_catalog.sql"
);

describe("Create Pulse built-in repair migration", () => {
  it("preserves operator-authored built-ins while repairing legacy seeded labels", () => {
    const migrationSql = fs.readFileSync(forwardMigrationPath, "utf8");

    expect(migrationSql).toContain("else definition.value");
    expect(migrationSql).toContain("definition.ordinality + 1000");
    expect(migrationSql).toContain(
      "definition.value->>'presetId' not in ('single_shot', 'legacy_prompt_modifier')"
    );
    expect(migrationSql).not.toContain(
      "definition.value->>'presetId' in ('single_shot', 'prompt_modifier'"
    );
    expect(migrationSql).not.toContain("jsonb_array_length(runtime.pulse_definitions) <> 3");
  });
});
