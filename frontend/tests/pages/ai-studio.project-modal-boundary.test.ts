/**
 * Guards the AI Studio page-to-shell project modal callback boundary.
 * This keeps project-route helpers wired through the runtime body instead of
 * referencing outer-scope locals that can explode at render time.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readPageSource = () => readFileSync(path.join(process.cwd(), "pages/ai-studio.tsx"), "utf8");

describe("AI Studio project modal boundary", () => {
  it("keeps the create-project navigation callback inside the shell runtime seam", () => {
    const source = readPageSource();

    expect(source).toContain("handleCreateProjectFromModal: navigateToProjectRoute,");
    expect(source).not.toContain("onCreateProjectFromModal={navigateToProjectRoute}");
  });

  it("keeps the remaining project modal controls owned by the shell runtime and forwards them into the shell", () => {
    const source = readPageSource();

    expect(source).toContain("effectiveProjectName,");
    expect(source).toContain("handleProjectNameCommit,");
    expect(source).toContain("handleOpenMediaLibraryPanelOnly,");
    expect(source).toContain("handleOpenProjectsModal,");
    expect(source).toContain("handleCloseProjectsModal,");
    expect(source).toContain("handleCreateProjectFromModal,");
    expect(source).toContain("handleSelectProjectFromModal,");
    expect(source).toContain("projectName: effectiveProjectName,");
    expect(source).toContain("onProjectNameCommit: handleProjectNameCommit,");
    expect(source).toContain("onOpenMediaLibrary: handleOpenMediaLibraryPanelOnly,");
    expect(source).toContain("onOpenProjectsModal={handleOpenProjectsModal}");
    expect(source).toContain("onCloseProjectsModal={handleCloseProjectsModal}");
    expect(source).toContain("onSelectProjectFromModal={handleSelectProjectFromModal}");
    expect(source).toContain("onCreateProjectFromModal={handleCreateProjectFromModal}");
  });
});
