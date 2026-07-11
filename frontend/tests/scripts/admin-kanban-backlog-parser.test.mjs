import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BACKLOG_KANBAN_ID_PATTERN,
  parsePlanningBacklogMarkdown,
} from "../../../scripts/lib/planning_backlog_parser.mjs";

const repoRoot = path.resolve(process.cwd(), "..");
const backlogPath = path.join(repoRoot, "docs/planning/backlog.md");

describe("planning backlog parser", () => {
  it("extracts every current top-level backlog item with stable Kanban ids", () => {
    const markdown = fs.readFileSync(backlogPath, "utf8");
    const parsed = parsePlanningBacklogMarkdown(markdown);

    expect(parsed.errors).toEqual([]);
    expect(parsed.items).toHaveLength(47);
    expect(new Set(parsed.items.map((item) => item.sourceKey))).toHaveLength(47);
    expect(parsed.items.every((item) => BACKLOG_KANBAN_ID_PATTERN.test(item.sourceKey))).toBe(true);
    expect(parsed.items[0]).toMatchObject({
      sourceKey: "spb-p1-001",
      sourceSection: "Program 1: Runtime And Money",
      sourcePath: "docs/planning/backlog.md",
    });
    expect(parsed.items.at(-1)).toMatchObject({
      sourceKey: "spb-p5-003",
      sourceSection: "Program 5: Release Confidence And Research",
    });
  });

  it("rejects missing or duplicate Kanban ids instead of inventing board identity", () => {
    const markdown = [
      "## Program 1: Runtime And Money",
      "- First item <!-- kanban:spb-p1-001 -->",
      "- Missing id",
      "- Duplicate id <!-- kanban:spb-p1-001 -->",
    ].join("\n");

    const parsed = parsePlanningBacklogMarkdown(markdown, {
      sourcePath: "docs/planning/backlog.md",
    });

    expect(parsed.items).toHaveLength(1);
    expect(parsed.errors).toEqual([
      "docs/planning/backlog.md:3 missing kanban id comment",
      "docs/planning/backlog.md:4 duplicate kanban id spb-p1-001",
    ]);
  });
});
