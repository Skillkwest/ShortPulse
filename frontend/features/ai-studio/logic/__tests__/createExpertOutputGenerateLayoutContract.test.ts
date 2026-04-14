import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const createExpertOutputGenerateCssPath = path.resolve(
  process.cwd(),
  "styles/ai-studio-create-expert-output-generate.css"
);

const extractRuleBlock = (css: string, selector: string) => {
  const escapedSelector = selector
    .trim()
    .split(/\s+/)
    .map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  const pattern = new RegExp(`(^|\\n)${escapedSelector} \\{[\\s\\S]*?\\n\\}`, "gm");
  const matches = Array.from(css.matchAll(pattern));
  const match = matches.at(-1);
  expect(match).not.toBeUndefined();
  return match?.[0] ?? "";
};

describe("create expert output generate layout contract", () => {
  it("bottom-aligns assistant-response generate controls within the response row", () => {
    const css = fs.readFileSync(createExpertOutputGenerateCssPath, "utf8");
    const controls = extractRuleBlock(
      css,
      ".create-expert-panel .create-expert-prompt-step .agent-message.agent-assistant.agent-message--with-output-generate .agent-output-bubble-controls"
    );

    expect(controls).toContain("align-self: stretch;");
    expect(controls).toContain("justify-content: flex-end;");
    expect(controls).toContain("min-height: 100%;");
  });
});
