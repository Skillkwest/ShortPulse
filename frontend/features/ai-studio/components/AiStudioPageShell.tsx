/**
 * AI Studio page shell.
 * Owns the project-bootstrap gate and the stable outer render tree around page content and project modal.
 */
import Head from "next/head";
import React from "react";
import { AiStudioPageContent } from "./AiStudioPageContent";
import { AiStudioProjectEntryState } from "./AiStudioProjectEntryState";
import { AiStudioModalActivityProvider } from "./modal-layer/AiStudioModalLayer";

type AiStudioPageShellProps = {
  pageContentProps: React.ComponentProps<typeof AiStudioPageContent>;
  projectBootstrapError: string | null;
  projectEntryPhase: React.ComponentProps<typeof AiStudioProjectEntryState>["phase"];
  projectError: string | null;
  projectId: string | null;
  projectStatus: "idle" | "loading" | "ready" | "error";
  projectTitle: string | null;
  projectsModalOpen: boolean;
  referenceGridPreconnectOrigin: string | null;
  retryProjectBootstrap: () => void;
  resetProjectWorkspace: () => Promise<void>;
  shouldGateProjectBootstrap: boolean;
  onCloseProjectsModal: () => void;
  onOpenProjectsModal: () => void;
  onSelectProjectFromModal: (projectId: string) => void;
  onCreateProjectFromModal?: (projectId: string) => Promise<void> | void;
};

const LazyProjectsModal = React.lazy(() =>
  import("./ProjectsModal").then((module) => ({
    default: module.ProjectsModal,
  }))
);

/**
 * Renders the stable AI Studio page shell around the page content.
 */
export const AiStudioPageShell = ({
  pageContentProps,
  projectBootstrapError,
  projectEntryPhase,
  projectError,
  projectId,
  projectStatus,
  projectTitle,
  projectsModalOpen,
  referenceGridPreconnectOrigin,
  retryProjectBootstrap,
  resetProjectWorkspace,
  shouldGateProjectBootstrap,
  onCloseProjectsModal,
  onOpenProjectsModal,
  onSelectProjectFromModal,
  onCreateProjectFromModal,
}: AiStudioPageShellProps) => {
  const resettableWorkspaceError = Boolean(
    projectBootstrapError &&
    /invalid project workspace snapshot|project workspace snapshot is invalid/i.test(
      projectBootstrapError
    )
  );
  const projectsModal = projectsModalOpen ? (
    <React.Suspense fallback={<p className="tiny subdued">Loading projects...</p>}>
      <LazyProjectsModal
        isOpen={projectsModalOpen}
        currentProjectId={projectId}
        onClose={onCloseProjectsModal}
        onSelectProject={onSelectProjectFromModal}
        onCreateProject={onCreateProjectFromModal}
      />
    </React.Suspense>
  ) : null;

  if (shouldGateProjectBootstrap) {
    return (
      <AiStudioModalActivityProvider>
        <Head>
          <title>ShortPulse · AI Studio</title>
          <meta name="description" content="AI Studio — prompt, generate, preview, save." />
        </Head>
        {projectStatus === "error" || projectBootstrapError ? (
          <AiStudioProjectEntryState
            variant="error"
            phase={projectEntryPhase}
            projectTitle={projectTitle}
            errorTitle={
              projectStatus === "error" ? "Project unavailable" : "Project workspace unavailable"
            }
            errorMessage={
              projectStatus === "error"
                ? (projectError ?? "Failed to load project.")
                : (projectBootstrapError ?? "Failed to load project workspace.")
            }
            primaryActionLabel={
              projectStatus === "error"
                ? "Open projects"
                : resettableWorkspaceError
                  ? "Reset saved workspace"
                  : "Retry workspace load"
            }
            onPrimaryAction={
              projectStatus === "error"
                ? onOpenProjectsModal
                : resettableWorkspaceError
                  ? () => {
                      void resetProjectWorkspace();
                    }
                  : retryProjectBootstrap
            }
            secondaryActionLabel={
              resettableWorkspaceError ? "Retry workspace load" : "Back to dashboard"
            }
            onSecondaryAction={
              resettableWorkspaceError
                ? retryProjectBootstrap
                : () => {
                    window.location.assign("/dashboard");
                  }
            }
          />
        ) : (
          <AiStudioProjectEntryState
            variant="loading"
            phase={projectEntryPhase}
            projectTitle={projectTitle}
          />
        )}
        {projectsModal}
      </AiStudioModalActivityProvider>
    );
  }

  return (
    <AiStudioModalActivityProvider>
      <Head>
        <title>ShortPulse · AI Studio</title>
        <meta name="description" content="AI Studio — prompt, generate, preview, save." />
        {referenceGridPreconnectOrigin ? (
          <>
            <link rel="preconnect" href={referenceGridPreconnectOrigin} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={referenceGridPreconnectOrigin} />
          </>
        ) : null}
      </Head>
      <AiStudioPageContent {...pageContentProps} />
      {projectsModal}
    </AiStudioModalActivityProvider>
  );
};
