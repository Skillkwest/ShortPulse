import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const forwardMigrationPath = path.resolve(
  process.cwd(),
  "../sql/migrations/199_repair_create_pulse_builtin_catalog.sql"
);

const guardedRepairMigrationPaths = [
  "../sql/migrations/206_repair_prompt_modifier_starter.sql",
  "../sql/migrations/216_repair_pulse_text_first_builtin_catalog.sql",
  "../sql/migrations/217_repair_pulse_single_shot_builtin_catalog.sql",
].map((migrationPath) => path.resolve(process.cwd(), migrationPath));

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

  it("only lets seeded Pulse repair migrations mutate system-owned catalog rows", () => {
    guardedRepairMigrationPaths.forEach((migrationPath) => {
      const migrationSql = fs.readFileSync(migrationPath, "utf8");

      expect(migrationSql).toContain("runtime.updated_by_user_id is null");
      expect(migrationSql).toContain(
        "coalesce(nullif(runtime.updated_by_email, ''), 'system_seed') = 'system_seed'"
      );
      expect(migrationSql).toContain("the admin-owned catalog is the authority");
    });
  });
});
