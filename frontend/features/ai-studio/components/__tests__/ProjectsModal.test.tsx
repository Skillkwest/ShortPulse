import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import { ProjectsModal } from "../ProjectsModal";

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

const mockedFetchWithAuth = vi.mocked(fetchWithAuth);

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
};

describe("ProjectsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("does not render when closed", () => {
    render(<ProjectsModal isOpen={false} onClose={vi.fn()} onSelectProject={vi.fn()} />);

    expect(screen.queryByRole("dialog", { name: "Projects" })).not.toBeInTheDocument();
  });

  it("renders an animated loading spinner while projects load", () => {
    mockedFetchWithAuth.mockReturnValueOnce(new Promise(() => {}) as Promise<Response>);

    render(<ProjectsModal isOpen onClose={vi.fn()} onSelectProject={vi.fn()} />);

    const loadingState = screen.getByRole("status");
    expect(loadingState).toHaveAttribute("aria-busy", "true");
    expect(loadingState.querySelector(".ai-projects-modal-loading-spinner")).toBeInTheDocument();
    expect(screen.getByText("Loading projects")).toBeInTheDocument();
    expect(screen.getByText("Fetching your latest AI Studio projects.")).toBeInTheDocument();
  });

  it("loads saved projects and routes selection through the page callback", async () => {
    const onClose = vi.fn();
    const onSelectProject = vi.fn().mockResolvedValue(undefined);
    mockedFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        projects: [
          {
            id: "project-1",
            title: "Campaign Alpha",
            createdAt: "2026-04-24T17:00:00.000Z",
            updatedAt: "2026-04-24T18:00:00.000Z",
            previewImageUrls: [
              "https://cdn.example.com/alpha-1.png",
              "https://cdn.example.com/alpha-2.png",
            ],
          },
          {
            id: "project-2",
            title: "Current Workspace",
            createdAt: "2026-04-23T17:00:00.000Z",
            updatedAt: "2026-04-24T16:00:00.000Z",
            previewImageUrls: [],
          },
        ],
      }),
    } as Response);

    render(
      <ProjectsModal
        isOpen
        currentProjectId="project-2"
        onClose={onClose}
        onSelectProject={onSelectProject}
      />
    );

    expect(await screen.findByRole("dialog", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getByText("Open a saved AI Studio project.")).toBeInTheDocument();
    expect(screen.queryByText(/\d+ saved/)).not.toBeInTheDocument();
    expect(mockedFetchWithAuth).toHaveBeenCalledWith(
      "/api/projects?limit=12&offset=0&previewMode=none",
      {
        method: "GET",
        shortpulseAuthTimeoutMs: 5000,
        shortpulseRetryNetworkOnce: true,
      }
    );
    expect(mockedFetchWithAuth).not.toHaveBeenCalledWith(
      "/api/projects?limit=all",
      expect.anything()
    );
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(await screen.findByText("Current")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete selected project" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Delete project/i })).toBeNull();
    expect(
      screen.getByTestId("project-preview-grid-project-1").querySelectorAll("img")
    ).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Select project Campaign Alpha" }));

    expect(onSelectProject).not.toHaveBeenCalled();
    const selectedProjectButton = screen.getByRole("button", {
      name: "Open project Campaign Alpha",
    });
    expect(selectedProjectButton).toHaveTextContent("Campaign Alpha");
    expect(selectedProjectButton).toHaveTextContent("Open →");
    expect(
      selectedProjectButton.querySelector(".ai-projects-modal-card-open-content")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete selected project Campaign Alpha" })
    ).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Open project Campaign Alpha" }));

    await waitFor(() => {
      expect(onSelectProject).toHaveBeenCalledWith("project-1");
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole("button", { name: "Current project Current Workspace" })).toBeEnabled();
  });

  it("keeps project opening single-flight while navigation is pending", async () => {
    const deferredOpen = createDeferred<void>();
    const onSelectProject = vi.fn(() => deferredOpen.promise);
    const onClose = vi.fn();
    mockedFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        projects: [
          {
            id: "project-1",
            title: "Campaign Alpha",
            createdAt: "2026-04-24T17:00:00.000Z",
            updatedAt: "2026-04-24T18:00:00.000Z",
            previewImageUrls: [],
          },
          {
            id: "project-2",
            title: "Campaign Beta",
            createdAt: "2026-04-23T17:00:00.000Z",
            updatedAt: "2026-04-24T16:00:00.000Z",
            previewImageUrls: [],
          },
        ],
      }),
    } as Response);

    render(<ProjectsModal isOpen onClose={onClose} onSelectProject={onSelectProject} />);

    const alphaButton = await screen.findByRole("button", {
      name: "Select project Campaign Alpha",
    });
    const betaButton = screen.getByRole("button", { name: "Select project Campaign Beta" });

    fireEvent.click(alphaButton);
    expect(onSelectProject).not.toHaveBeenCalled();
    const alphaOpenButton = screen.getByRole("button", { name: "Open project Campaign Alpha" });
    fireEvent.click(alphaOpenButton);
    fireEvent.click(betaButton);

    expect(onSelectProject).toHaveBeenCalledTimes(1);
    expect(onSelectProject).toHaveBeenCalledWith("project-1");
    await waitFor(() => {
      expect(screen.getByText("Opening...")).toBeInTheDocument();
    });
    expect(alphaOpenButton).toHaveTextContent("Opening...");
    expect(alphaOpenButton).toHaveTextContent("Campaign Alpha");
    expect(alphaOpenButton.querySelector(".ai-projects-modal-card-open-content")).toHaveTextContent(
      "Opening"
    );
    expect(betaButton).toBeDisabled();

    deferredOpen.resolve();
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("creates a project from the modal header and routes through the create callback", async () => {
    const onClose = vi.fn();
    const onCreateProject = vi.fn().mockResolvedValue(undefined);
    mockedFetchWithAuth
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          projects: [
            {
              id: "project-1",
              title: "Campaign Alpha",
              createdAt: "2026-04-24T17:00:00.000Z",
              updatedAt: "2026-04-24T18:00:00.000Z",
              previewImageUrls: [],
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          project: {
            id: "project-created",
            title: "Launch Campaign",
            createdAt: "2026-05-10T17:00:00.000Z",
            updatedAt: "2026-05-10T17:00:00.000Z",
          },
        }),
      } as Response);

    render(
      <ProjectsModal
        isOpen
        onClose={onClose}
        onSelectProject={vi.fn()}
        onCreateProject={onCreateProject}
      />
    );

    const newProjectButton = await screen.findByRole("button", { name: "New Project" });
    const deleteSelectedButton = screen.getByRole("button", { name: "Delete selected project" });

    expect(newProjectButton).toBeInTheDocument();
    expect(
      deleteSelectedButton.compareDocumentPosition(newProjectButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    fireEvent.click(newProjectButton);
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "Launch Campaign" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(mockedFetchWithAuth).toHaveBeenCalledWith(
        "/api/projects/create",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ title: "Launch Campaign" }),
        })
      );
    });
    await waitFor(() => {
      expect(onCreateProject).toHaveBeenCalledWith("project-created");
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("deletes a saved project after confirmation", async () => {
    mockedFetchWithAuth
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          projects: [
            {
              id: "project-1",
              title: "Campaign Alpha",
              createdAt: "2026-04-24T17:00:00.000Z",
              updatedAt: "2026-04-24T18:00:00.000Z",
              previewImageUrls: [],
            },
            {
              id: "project-2",
              title: "Campaign Beta",
              createdAt: "2026-04-23T17:00:00.000Z",
              updatedAt: "2026-04-24T16:00:00.000Z",
              previewImageUrls: [],
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deletedProjectId: "project-1" }),
      } as Response);

    render(<ProjectsModal isOpen onClose={vi.fn()} onSelectProject={vi.fn()} />);

    expect(await screen.findByText("Campaign Alpha")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Delete selected project" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Select project Campaign Alpha" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete selected project Campaign Alpha" }));

    expect(screen.getByRole("dialog", { name: "Delete this project?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mockedFetchWithAuth).toHaveBeenCalledWith("/api/projects/project-1", {
        method: "DELETE",
        shortpulseAuthTimeoutMs: 5000,
      });
    });
    await waitFor(() => {
      expect(screen.queryByText("Campaign Alpha")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Campaign Beta")).toBeInTheDocument();
    expect(screen.queryByText(/\d+ saved/)).not.toBeInTheDocument();
  });

  it("removes a stale project card when delete returns not found", async () => {
    mockedFetchWithAuth
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          projects: [
            {
              id: "project-1",
              title: "Campaign Alpha",
              createdAt: "2026-04-24T17:00:00.000Z",
              updatedAt: "2026-04-24T18:00:00.000Z",
              previewImageUrls: [],
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: "Project not found" }),
      } as Response);

    render(<ProjectsModal isOpen onClose={vi.fn()} onSelectProject={vi.fn()} />);

    expect(await screen.findByText("Campaign Alpha")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select project Campaign Alpha" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete selected project Campaign Alpha" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("Campaign Alpha")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Project no longer exists.")).not.toBeInTheDocument();
    expect(screen.getByText("No saved projects yet")).toBeInTheDocument();
    expect(screen.queryByText(/\d+ saved/)).not.toBeInTheDocument();
  });

  it("guards against duplicate delete confirms before React disables the button", async () => {
    mockedFetchWithAuth
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          projects: [
            {
              id: "project-1",
              title: "Campaign Alpha",
              createdAt: "2026-04-24T17:00:00.000Z",
              updatedAt: "2026-04-24T18:00:00.000Z",
              previewImageUrls: [],
            },
          ],
        }),
      } as Response)
      .mockReturnValueOnce(new Promise(() => {}) as Promise<Response>);

    render(<ProjectsModal isOpen onClose={vi.fn()} onSelectProject={vi.fn()} />);

    expect(await screen.findByText("Campaign Alpha")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select project Campaign Alpha" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete selected project Campaign Alpha" }));
    const deleteButton = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteButton);
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockedFetchWithAuth).toHaveBeenCalledTimes(2);
    });
    expect(mockedFetchWithAuth).toHaveBeenLastCalledWith("/api/projects/project-1", {
      method: "DELETE",
      shortpulseAuthTimeoutMs: 5000,
    });
  });

  it("shows a retryable error state when project loading fails", async () => {
    mockedFetchWithAuth
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          projects: [
            {
              id: "project-1",
              title: "Campaign Alpha",
              createdAt: "2026-04-24T17:00:00.000Z",
              updatedAt: "2026-04-24T18:00:00.000Z",
              previewImageUrls: [],
            },
          ],
        }),
      } as Response);

    render(<ProjectsModal isOpen onClose={vi.fn()} onSelectProject={vi.fn()} />);

    expect(await screen.findByText("Projects unavailable")).toBeInTheDocument();
    expect(screen.getByText("Session expired. Retry project load.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Campaign Alpha")).toBeInTheDocument();
    expect(mockedFetchWithAuth).toHaveBeenCalledTimes(2);
  });

  it("shows a banner when project deletion fails", async () => {
    mockedFetchWithAuth
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          projects: [
            {
              id: "project-1",
              title: "Campaign Alpha",
              createdAt: "2026-04-24T17:00:00.000Z",
              updatedAt: "2026-04-24T18:00:00.000Z",
              previewImageUrls: [],
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized" }),
      } as Response);

    render(<ProjectsModal isOpen onClose={vi.fn()} onSelectProject={vi.fn()} />);

    expect(await screen.findByText("Campaign Alpha")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select project Campaign Alpha" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete selected project Campaign Alpha" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Session expired. Retry project delete.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open project Campaign Alpha" })).toBeInTheDocument();
  });
});
