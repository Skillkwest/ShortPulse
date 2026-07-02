/**
 * Guardrail test for control-plane enforce gate runtime RPC coverage.
 * Keeps the release enforce gate aligned with service-role-only RPC families
 * that are known to be production-critical.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const enforceGatePath = path.resolve(
  process.cwd(),
  "..",
  "sql",
  "check_control_plane_enforce_gate.sql"
);

const REQUIRED_RUNTIME_RPC_SIGNATURES = [
  "public.activate_billing_plan_offer(text,text,text,text,integer,integer,bigint,integer,text,text,boolean)",
  "public.activate_billing_storage_addon_offer(text,text,text,bigint,integer,text,text,boolean)",
] as const;

describe("check_control_plane_enforce_gate.sql", () => {
  it("tracks admin pricing offer activation RPC execute posture", () => {
    const sql = fs.readFileSync(enforceGatePath, "utf8");

    for (const signature of REQUIRED_RUNTIME_RPC_SIGNATURES) {
      expect(sql).toContain(signature);
    }

    expect(sql).toContain("has_function_privilege('service_role', r.regproc, 'EXECUTE')");
    expect(sql).toContain("not has_function_privilege('authenticated', r.regproc, 'EXECUTE')");
    expect(sql).toContain("not has_function_privilege('anon', r.regproc, 'EXECUTE')");
  });
});
