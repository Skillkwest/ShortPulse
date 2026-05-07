import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS,
  type CreatePulseBuiltInPresetDefinition,
} from "../../features/ai-studio/components/create/createPulsePresets";
import AdminAgentInstructionsPage from "../../pages/admin/agent-instructions";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useAdminAccessMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("next/head", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode;
    href: string;
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("../../lib/authGuard", () => ({
  useProtectedRoute: (...args: unknown[]) => useProtectedRouteMock(...args),
}));

vi.mock("../../features/admin/logic/useAdminAccess", () => ({
  useAdminAccess: (...args: unknown[]) => useAdminAccessMock(...args),
}));

const buildCatalogResponse = (
  builtInDefinitions: readonly CreatePulseBuiltInPresetDefinition[] = CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS
) => ({
  ok: true,
  json: async () => ({
    builtInDefinitions,
    source: "control_plane" as const,
    updatedAt: "2026-05-05T18:00:00.000Z",
    updatedByEmail: "admin@example.com",
  }),
});

describe("Admin agent instructions page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(buildCatalogResponse());
    useProtectedRouteMock.mockReturnValue({
      loading: false,
      user: { id: "11111111-1111-4111-8111-111111111111", email: "admin@example.com" },
    });
    useAdminAccessMock.mockReturnValue({
      status: "ready",
      isLoading: false,
      isAdmin: true,
      error: null,
      refresh: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows Agent Instructions as a primary admin nav tab and renders the stored Standard and Pulse editors", async () => {
    render(<AdminAgentInstructionsPage />);

    expect(screen.getByRole("heading", { name: "Agent instructions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Agent Instructions" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(await screen.findByText("Global built-in guided workflow set")).toBeInTheDocument();
    expect(screen.getByText("Standard Create Agent")).toBeInTheDocument();
    expect(screen.getByText("Video Prompt Magic")).toBeInTheDocument();
    expect(screen.getByText("Multi Sequence Video Prompt")).toBeInTheDocument();
    expect(screen.getByText("DFY Story Builder")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Workflow name")).toHaveLength(3);
    expect(screen.getAllByLabelText("Preset ID")).toHaveLength(3);
    expect(screen.getAllByLabelText("Artifact target")).toHaveLength(3);
    expect(screen.getAllByLabelText("System instructions")).toHaveLength(3);
  });

  it("edits, adds, removes, resets, and saves built-in Pulse slots", async () => {
    const updatedDefinitions = [
      {
        ...CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS[0],
        label: "Global Prompt Director",
        description: "Runs the single-shot image-to-video workflow.",
        systemInstructions: "Draft pulse instructions.",
      },
    ];

    fetchMock
      .mockResolvedValueOnce(buildCatalogResponse([CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS[0]]))
      .mockResolvedValueOnce(buildCatalogResponse(updatedDefinitions));

    render(<AdminAgentInstructionsPage />);
    await screen.findByText("Video Prompt Magic");

    const standardCard = screen.getByText("Standard Create Agent").closest("article");
    if (!standardCard) throw new Error("Expected Standard Create Agent card.");
    fireEvent.change(
      within(standardCard).getByRole("textbox", { name: "System instructions draft" }),
      {
        target: { value: "Future standard instructions." },
      }
    );
    expect(
      within(standardCard).getByRole("textbox", { name: "System instructions draft" })
    ).toHaveValue("Future standard instructions.");

    const pulseCard = screen.getByText("Video Prompt Magic").closest("article");
    if (!pulseCard) throw new Error("Expected Video Prompt Magic card.");

    fireEvent.change(within(pulseCard).getByRole("textbox", { name: "Workflow name" }), {
      target: { value: "Global Prompt Director" },
    });
    fireEvent.change(within(pulseCard).getByRole("textbox", { name: "Description" }), {
      target: { value: "Runs the single-shot image-to-video workflow." },
    });
    fireEvent.change(within(pulseCard).getByRole("textbox", { name: "System instructions" }), {
      target: { value: "Draft pulse instructions." },
    });
    expect(within(pulseCard).getByText("Unsaved edits")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add guided workflow" }));
    expect(screen.getByText("Workflow Slot 2")).toBeInTheDocument();

    const newSlotCard = screen.getByText("Workflow Slot 2").closest("article");
    if (!newSlotCard) throw new Error("Expected new Pulse slot card.");
    fireEvent.change(within(newSlotCard).getByRole("textbox", { name: "Workflow name" }), {
      target: { value: "Universal Story Pulse" },
    });
    fireEvent.click(within(newSlotCard).getByRole("button", { name: "Remove" }));
    expect(screen.queryByText("Workflow Slot 2")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save guided workflow set" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const saveRequest = fetchMock.mock.calls[1];
    expect(saveRequest?.[0]).toBe("/api/admin/agent-instructions/pulse-builtins");
    expect(saveRequest?.[1]).toMatchObject({
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    const payload = JSON.parse(String(saveRequest?.[1]?.body)) as {
      builtInDefinitions: Array<Record<string, unknown>>;
    };
    expect(payload.builtInDefinitions[0]).toMatchObject({
      presetId: "image",
      label: "Global Prompt Director",
      description: "Runs the single-shot image-to-video workflow.",
      systemInstructions: "Draft pulse instructions.",
      artifactTarget: "video_prompt",
      starterAssistantMessage: "Upload your image to get the process started :)",
    });

    expect(screen.getByText("Global Prompt Director")).toBeInTheDocument();
    expect(within(pulseCard).getByText("Stored")).toBeInTheDocument();

    fireEvent.change(within(pulseCard).getByRole("textbox", { name: "Workflow name" }), {
      target: { value: "Temporary name" },
    });
    fireEvent.click(within(pulseCard).getByRole("button", { name: "Reset to stored" }));
    expect(within(pulseCard).getByRole("textbox", { name: "Workflow name" })).toHaveValue(
      "Global Prompt Director"
    );
  });
});
