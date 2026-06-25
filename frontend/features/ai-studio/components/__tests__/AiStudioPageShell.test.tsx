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
  it("renders AI Studio content once the project bootstrap gate is open", () => {
    render(
      <AiStudioPageShell
        pageContentProps={{} as React.ComponentProps<typeof AiStudioPageShell>["pageContentProps"]}
        projectBootstrapError={null}
        projectEntryPhase="restoring-workspace"
        projectError={null}
        projectId="project-1"
        projectStatus="ready"
        projectTitle="Project One"
        projectsModalOpen={false}
        referenceGridPreconnectOrigin={null}
        retryProjectBootstrap={vi.fn()}
        resetProjectWorkspace={vi.fn(async () => undefined)}
        shouldGateProjectBootstrap={false}
        onCloseProjectsModal={vi.fn()}
        onOpenProjectsModal={vi.fn()}
        onSelectProjectFromModal={vi.fn()}
        onCreateProjectFromModal={vi.fn()}
      />
    );

    expect(screen.getByText("AI Studio content")).toBeInTheDocument();
    expect(screen.queryByLabelText("Project restore progress")).not.toBeInTheDocument();
  });

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
        retryProjectBootstrap={vi.fn()}
        resetProjectWorkspace={vi.fn(async () => undefined)}
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

  it("keeps the projects modal available while project bootstrap is gated", async () => {
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
        retryProjectBootstrap={vi.fn()}
        resetProjectWorkspace={vi.fn(async () => undefined)}
        shouldGateProjectBootstrap
        onCloseProjectsModal={vi.fn()}
        onOpenProjectsModal={vi.fn()}
        onSelectProjectFromModal={vi.fn()}
        onCreateProjectFromModal={vi.fn()}
      />
    );

    expect(await screen.findByText("Projects modal open")).toBeInTheDocument();
    expect(screen.getByText("Create project enabled")).toBeInTheDocument();
  });

  it("keeps retry primary and requires confirmation before resetting invalid saved workspace", () => {
    const handleResetProjectWorkspace = vi.fn(async () => undefined);
    const handleRetryBootstrap = vi.fn();

    render(
      <AiStudioPageShell
        pageContentProps={{} as React.ComponentProps<typeof AiStudioPageShell>["pageContentProps"]}
        projectBootstrapError="Project workspace snapshot is invalid."
        projectEntryPhase="loading-workspace"
        projectError={null}
        projectId="project-1"
        projectStatus="ready"
        projectTitle="Project One"
        projectsModalOpen={false}
        referenceGridPreconnectOrigin={null}
        retryProjectBootstrap={handleRetryBootstrap}
        resetProjectWorkspace={handleResetProjectWorkspace}
        shouldGateProjectBootstrap
        onCloseProjectsModal={vi.fn()}
        onOpenProjectsModal={vi.fn()}
        onSelectProjectFromModal={vi.fn()}
        onCreateProjectFromModal={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry workspace load" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset saved workspace" }));

    expect(handleRetryBootstrap).toHaveBeenCalledTimes(1);
    expect(handleResetProjectWorkspace).not.toHaveBeenCalled();
    expect(screen.getByText(/only if retry does not restore this project/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm reset workspace" }));

    expect(handleResetProjectWorkspace).toHaveBeenCalledTimes(1);
  });
});
