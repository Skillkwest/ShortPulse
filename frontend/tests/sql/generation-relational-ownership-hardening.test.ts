import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = fs.existsSync(path.resolve(process.cwd(), "sql/migrations"))
  ? process.cwd()
  : path.resolve(process.cwd(), "..");
const migrationPath = path.join(
  repoRoot,
  "sql/migrations/224_harden_generation_relational_ownership.sql"
);
const rollbackPath = path.join(
  repoRoot,
  "sql/migrations/rollback/224_harden_generation_relational_ownership_rollback.sql"
);
const sql = fs.readFileSync(migrationPath, "utf8");
const rollbackSql = fs.readFileSync(rollbackPath, "utf8");

const serverOwnedTables = [
  "ai_generation_submit_queue",
  "generation_attempts",
  "generation_publications",
  "generation_projection",
  "ai_generation_outputs",
] as const;

describe("generation relational ownership hardening migration", () => {
  it("fails atomically when validation or catalog assumptions do not hold", () => {
    expect(sql).toMatch(/\nbegin;\n/);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
    expect(rollbackSql).toMatch(/\nbegin;\n/);
    expect(rollbackSql.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("pairs generation ownership on every server-owned child table", () => {
    for (const table of serverOwnedTables) {
      expect(sql).toContain(`alter table public.${table}`);
      expect(sql).toMatch(
        new RegExp(
          `${table}[_a-z]*generation_owner_fk[\\s\\S]*?foreign key \\(generation_id, user_id\\)[\\s\\S]*?references public\\.ai_generations \\(id, user_id\\)[\\s\\S]*?not valid;`
        )
      );
    }
  });

  it("pairs attempt, output, and media ownership where those references exist", () => {
    expect(sql).toContain("foreign key (generation_attempt_id, generation_id, user_id)");
    expect(sql).toContain("references public.generation_attempts (id, generation_id, user_id)");
    expect(sql).toContain("foreign key (generation_output_id, generation_id, user_id)");
    expect(sql).toContain("references public.ai_generation_outputs (id, generation_id, user_id)");
    expect(sql).toContain("foreign key (media_file_id, user_id)");
    expect(sql).toContain("foreign key (owned_media_file_id, user_id)");
    expect(sql).toContain("on delete set null (generation_attempt_id)");
    expect(sql).toContain("on delete set null (latest_attempt_id)");
    expect(sql).toContain("on delete set null (media_file_id)");
    expect(sql).toContain("on delete set null (owned_media_file_id)");
    expect(sql).toMatch(
      /foreign key \(generation_output_id, generation_id, user_id\)[\s\S]*?on delete cascade/
    );
    expect(sql.match(/validate constraint/g)).toHaveLength(11);
  });

  it("keeps authenticated reads while removing all browser mutation authority", () => {
    for (const table of serverOwnedTables) {
      expect(sql).toContain(
        `revoke all on table public.${table} from public, anon, authenticated;`
      );
      expect(sql).toContain(`grant select on table public.${table} to authenticated;`);
      expect(sql).toContain(
        `grant select, insert, update, delete on table public.${table} to service_role;`
      );
    }
    expect(sql).not.toMatch(/grant (insert|update|delete|all).*to (anon|authenticated)/i);
    expect(sql.match(/drop policy if exists modify_/g)).toHaveLength(5);
  });

  it("makes owner columns immutable without freezing mutable media linkage", () => {
    expect(sql).toContain(
      "create or replace function public.reject_generation_child_owner_reassignment"
    );
    expect(sql).toContain("before update of generation_id, user_id");
    expect(sql).not.toContain("before update of media_file_id");
    expect(sql.match(/trg_.*_owner_immutable/g)).toHaveLength(10);
  });

  it("provides only a narrow compatibility rollback without weakening ownership", () => {
    for (const table of serverOwnedTables) {
      expect(rollbackSql).toContain(
        `grant insert, update, delete on table public.${table} to authenticated;`
      );
    }
    expect(rollbackSql).not.toMatch(/drop constraint|drop trigger|drop function/i);
    expect(rollbackSql).not.toMatch(/grant (all|truncate|references|trigger)|to anon/i);
  });
});
