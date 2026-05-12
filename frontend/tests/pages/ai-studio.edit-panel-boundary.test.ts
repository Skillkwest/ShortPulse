/**
 * Guards the AI Studio page-to-edit-panel boundary.
 * Keeps the route shell forwarding the composed Edit panel contract all the way
 * into the page content/runtime seam instead of bypassing or re-deriving it.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readPageSource = () => readFileSync(path.join(process.cwd(), "pages/ai-studio.tsx"), "utf8");

describe("AI Studio edit panel boundary", () => {
  it("forwards the composed edit panel props into the reference experience seam", () => {
    const source = readPageSource();

    expect(source).toContain("propertiesEditExpert: editExpertPanelProps,");
    expect(source).not.toContain("propertiesEditExpert: propertiesEditExpert,");
  });

  it("forwards the resolved edit panel props into page content runtime", () => {
    const source = readPageSource();

    expect(source).toContain(
      "const {\n    propertiesCreate: pagePropertiesCreate,\n    propertiesEditExpert,"
    );
    expect(source).toContain("propertiesEditExpert,\n    propertiesVideo,");
    expect(source).toContain("const pageContentProps = useAiStudioPageContentRuntime({");
  });
});
