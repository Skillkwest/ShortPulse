import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const createComposerOutputGenerateCssPath = path.resolve(
  process.cwd(),
  "styles/ai-studio-create-composer-output-generate.css"
);
const createComposerChatCssPath = path.resolve(
  process.cwd(),
  "styles/ai-studio-create-composer-chat.css"
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

describe("create composer output generate layout contract", () => {
  it("bottom-aligns assistant-response generate controls within the response row", () => {
    const css = fs.readFileSync(createComposerOutputGenerateCssPath, "utf8");
    const controls = extractRuleBlock(
      css,
      ".create-composer-panel .create-composer-prompt-step .agent-message.agent-assistant.agent-message--with-output-generate .agent-output-bubble-controls"
    );

    expect(controls).toContain("align-self: stretch;");
    expect(controls).toContain("justify-content: flex-end;");
    expect(controls).toContain("min-height: 100%;");
  });

  it("keeps non-generate Standard assistant replies on the same transparent shell", () => {
    const css = fs.readFileSync(createComposerChatCssPath, "utf8");

    expect(css).toContain(
      ".agent-message.agent-assistant:not(.agent-intro):not(.agent-thinking-message):not("
    );
    expect(css).toContain(".agent-message--with-output-generate");
    expect(css).toContain("border-radius: 0;");
    expect(css).toContain("background: transparent;");
    expect(css).toContain("box-shadow: none;");
  });
});
