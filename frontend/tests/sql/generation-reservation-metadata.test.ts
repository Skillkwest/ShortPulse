import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const migrationPaths = [
  "../sql/migrations/002_add_generation_credit_reservations.sql",
  "../sql/migrations/013_fix_generation_reservation_rpc_ambiguity.sql",
  "../sql/migrations/014_harden_generation_reservation_rpc_security.sql",
];

describe("generation reservation capture migrations", () => {
  it("preserve reservation metadata when capturing a generation charge", () => {
    for (const relativePath of migrationPaths) {
      const absolutePath = path.resolve(process.cwd(), relativePath);
      const sql = fs.readFileSync(absolutePath, "utf8");
      expect(sql).toContain("coalesce(reservation_row.metadata, '{}'::jsonb)");
      expect(sql).toContain("coalesce(p_metadata, '{}'::jsonb)");
    }
  });
});
