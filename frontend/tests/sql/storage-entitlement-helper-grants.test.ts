import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "../sql/migrations/141_harden_storage_entitlement_helper_grants.sql"
);

describe("storage entitlement helper grants", () => {
  it("keeps arbitrary-user storage entitlement helpers service-role-only", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    for (const fn of [
      "resolve_media_storage_base_limit_bytes",
      "resolve_media_storage_addon_limit_bytes",
    ]) {
      expect(sql).toContain(`revoke all on function public.${fn}(uuid) from authenticated;`);
      expect(sql).toContain(`grant execute on function public.${fn}(uuid) to service_role;`);
    }
    const usageHelperSql = fs.readFileSync(
      path.resolve(process.cwd(), "../sql/migrations/188_add_media_storage_usage_helper.sql"),
      "utf8"
    );
    expect(usageHelperSql).toContain(
      "revoke all on function public.resolve_media_storage_usage_bytes(uuid) from authenticated;"
    );
    expect(usageHelperSql).toContain(
      "grant execute on function public.resolve_media_storage_usage_bytes(uuid) to service_role;"
    );
    expect(sql).toContain(
      "grant execute on function public.get_media_storage_quota_summary() to authenticated, service_role;"
    );
  });
});
