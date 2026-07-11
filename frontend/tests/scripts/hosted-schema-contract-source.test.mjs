import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const checkerPath = path.resolve(process.cwd(), "../scripts/check_hosted_schema_contract.mjs");
const schemaSnapshotPath = path.resolve(process.cwd(), "../docs/supabase_full_schema.sql");

describe("hosted schema contract source", () => {
  it("checks the deterministic generation request index through the hosted DB contract", async () => {
    const source = await readFile(checkerPath, "utf8");

    expect(source).toContain("ai_generations_user_request_id_unique_idx");
    expect(source).toContain("pg_indexes");
    expect(source).toContain("required columns and indexes ok");
    expect(source).toContain("failures.push(...checkDbContract(dbUrl))");
  });

  it("keeps the full schema snapshot aligned with remux recovery projection migration 221", async () => {
    const snapshot = await readFile(schemaSnapshotPath, "utf8");

    expect(snapshot).toContain("create table if not exists public.generation_projection");
    expect(snapshot).toContain("remux_recovery jsonb");
    expect(snapshot).toContain("generation_projection_remux_recovery_object_check");
    expect(snapshot).toContain("ai_generations_user_request_id_unique_idx");
  });
});
