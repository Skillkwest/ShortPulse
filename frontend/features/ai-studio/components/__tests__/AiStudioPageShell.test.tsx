import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiStudioPageShell } from "../AiStudioPageShell";

vi.mock("../AiStudioPageContent", () => ({
  AiStudioPageContent: () => <div>AI Studio content</div>,
}));

vi.mock("../ProjectsModal", () => ({
  ProjectsModal: ({
    isOpen,
    onCreateProject,
  }: {
    isOpen: boolean;
    onCreateProject?: ((projectId: string) => Promise<void> | void) | undefined;
  }) =>
    isOpen ? (
      <div>
        <span>Projects modal open</span>
        {onCreateProject ? <span>Create project enabled</span> : null}
      </div>
    ) : null,
}));

describe("AiStudioPageShell", () => {
  it("opens project recovery from the gated error state", () => {
    const handleOpenProjectsModal = vi.fn();

    render(
      <AiStudioPageShell
        pageContentProps={{} as React.ComponentProps<typeof AiStudioPageShell>["pageContentProps"]}
        projectBootstrapError={null}
        projectEntryPhase="resolving-project"
        projectError="Project not found."
        projectId={null}
        projectStatus="error"
        projectTitle={null}
        projectsModalOpen={false}
        referenceGridPreconnectOrigin={null}
        refreshProject={vi.fn()}
        retryProjectBootstrap={vi.fn()}
        shouldGateProjectBootstrap
        onCloseProjectsModal={vi.fn()}
        onOpenProjectsModal={handleOpenProjectsModal}
        onSelectProjectFromModal={vi.fn()}
        onCreateProjectFromModal={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open projects" }));

    expect(handleOpenProjectsModal).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Project not found.")).toBeInTheDocument();
  });

  it("keeps the projects modal available while project bootstrap is gated", () => {
    render(
      <AiStudioPageShell
        pageContentProps={{} as React.ComponentProps<typeof AiStudioPageShell>["pageContentProps"]}
        projectBootstrapError={null}
        projectEntryPhase="resolving-project"
        projectError="Project not found."
        projectId={null}
        projectStatus="error"
        projectTitle={null}
        projectsModalOpen
        referenceGridPreconnectOrigin={null}
        refreshProject={vi.fn()}
        retryProjectBootstrap={vi.fn()}
        shouldGateProjectBootstrap
        onCloseProjectsModal={vi.fn()}
        onOpenProjectsModal={vi.fn()}
        onSelectProjectFromModal={vi.fn()}
        onCreateProjectFromModal={vi.fn()}
      />
    );

    expect(screen.getByText("Projects modal open")).toBeInTheDocument();
    expect(screen.getByText("Create project enabled")).toBeInTheDocument();
  });
});
