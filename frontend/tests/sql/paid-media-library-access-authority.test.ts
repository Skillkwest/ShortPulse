import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const forwardMigrationPath = path.resolve(
  process.cwd(),
  "../sql/migrations/201_harden_paid_media_library_access_contract_authority.sql"
);
const baselineMigrationPath = path.resolve(
  process.cwd(),
  "../sql/migrations/190_require_paid_plan_for_media_library_inserts.sql"
);
const fullSchemaPath = path.resolve(process.cwd(), "../docs/supabase_full_schema.sql");

describe("paid media-library access authority", () => {
  it("keeps media-library insert authority on current subscription contracts only", () => {
    const migrationSql = fs.readFileSync(forwardMigrationPath, "utf8");

    expect(migrationSql).toContain("from public.billing_subscription_contracts c");
    expect(migrationSql).toContain("c.ended_at is null");
    expect(migrationSql).toContain("lower(coalesce(c.plan_id, 'free')) <> 'free'");
    expect(migrationSql).toContain(
      "lower(coalesce(c.status, 'active')) in ('active', 'trialing', 'past_due', 'unpaid')"
    );
    expect(migrationSql).not.toContain("from public.billing_profiles");
    expect(migrationSql).toContain(
      "grant execute on function public.user_has_paid_media_library_access(uuid) to authenticated;"
    );
    expect(migrationSql).toContain(
      "grant execute on function public.user_has_paid_media_library_access(uuid) to service_role;"
    );
  });

  it("keeps the bootstrap migration and schema aligned with contract-only authority", () => {
    const baselineSql = fs.readFileSync(baselineMigrationPath, "utf8");
    const fullSchemaSql = fs.readFileSync(fullSchemaPath, "utf8");

    expect(baselineSql).toContain("from public.billing_subscription_contracts c");
    expect(fullSchemaSql).toContain("from public.billing_subscription_contracts c");
    expect(baselineSql).not.toContain("from public.billing_profiles p");
    expect(fullSchemaSql).not.toContain("from public.billing_profiles p");
    expect(fullSchemaSql).not.toContain("from billing_profiles profile");
  });
});
