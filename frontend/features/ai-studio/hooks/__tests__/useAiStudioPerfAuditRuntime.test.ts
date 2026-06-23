import { describe, expect, it } from "vitest";
import {
  AI_STUDIO_PERF_AUDIT_ROOT_SELECTOR,
  createPerfAuditReferenceImageFile,
  getPerfAuditReferenceImageBytes,
  queryAiStudioPerfAudit,
  queryAiStudioPerfAuditAll,
  resolveAiStudioPerfAuditRoot,
} from "../useAiStudioPerfAuditRuntime";

describe("createPerfAuditReferenceImageFile", () => {
  it("builds a valid PNG file for shell audit drop sampling", async () => {
    const file = createPerfAuditReferenceImageFile();
    const bytes = getPerfAuditReferenceImageBytes();

    expect(file.name).toBe("audit-reference.png");
    expect(file.type).toBe("image/png");
    expect(file.size).toBe(bytes.length);
    expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });
});

describe("AI Studio perf audit DOM queries", () => {
  it("queries matching nodes only inside the AI Studio app root", () => {
    document.body.innerHTML = `
      <div id="extension-root">
        <button class="toolbar-item" data-tool-id="create" data-testid="outside-toolbar"></button>
        <section class="ai-properties">
          <button data-testid="outside-panel"></button>
        </section>
      </div>
      <main class="page page-wide ai-studio-page">
        <button class="toolbar-item" data-tool-id="create" data-testid="inside-toolbar"></button>
        <section class="ai-properties">
          <button data-testid="inside-panel"></button>
        </section>
      </main>
    `;

    expect(resolveAiStudioPerfAuditRoot()).toBe(
      document.querySelector(AI_STUDIO_PERF_AUDIT_ROOT_SELECTOR)
    );
    expect(
      queryAiStudioPerfAuditAll<HTMLButtonElement>(".toolbar-item[data-tool-id='create']").map(
        (node) => node.dataset.testid
      )
    ).toEqual(["inside-toolbar"]);
    expect(queryAiStudioPerfAudit<HTMLButtonElement>(".ai-properties button")?.dataset.testid).toBe(
      "inside-panel"
    );
  });

  it("returns no audit targets when only extension-injected matching nodes exist", () => {
    document.body.innerHTML = `
      <div id="extension-root">
        <button class="toolbar-item" data-tool-id="create" data-testid="outside-toolbar"></button>
        <div class="reference-card" data-testid="outside-card"></div>
      </div>
    `;

    expect(resolveAiStudioPerfAuditRoot()).toBeNull();
    expect(queryAiStudioPerfAudit<HTMLButtonElement>(".toolbar-item[data-tool-id='create']")).toBe(
      null
    );
    expect(queryAiStudioPerfAuditAll<HTMLElement>(".reference-card")).toEqual([]);
  });
});
