/**
 * Expert Edit secondary-rail motion contract tests.
 * Guards against stale centered transforms that can pull the secondary references/styles row
 * into overlapping positions during Edit panel entry.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const expertEditCssPath = path.resolve(process.cwd(), "styles/ai-studio-edit-expert.css");

const extractKeyframesBlock = (css: string, keyframeName: string) => {
  const pattern = new RegExp(
    `@keyframes ${keyframeName} \\{[\\s\\S]*?from \\{[\\s\\S]*?\\}[\\s\\S]*?to \\{[\\s\\S]*?\\}[\\s\\S]*?\\}`,
    "m"
  );
  const match = css.match(pattern);
  expect(match).not.toBeNull();
  return match?.[0] ?? "";
};

describe("expert edit secondary rail motion contract", () => {
  it("keeps secondary collapse animations aligned with the relative layout model", () => {
    const css = fs.readFileSync(expertEditCssPath, "utf8");
    const secondaryCollapse = extractKeyframesBlock(css, "edit-expert-secondary-collapse");
    const stylesCollapse = extractKeyframesBlock(css, "edit-expert-styles-collapse");

    expect(secondaryCollapse).not.toContain("translate(-50%, -50%)");
    expect(stylesCollapse).not.toContain("translate(-50%, -50%)");
  });
});
