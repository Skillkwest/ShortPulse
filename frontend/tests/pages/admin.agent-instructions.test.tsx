import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS,
  type CreatePulseBuiltInPresetDefinition,
} from "../../lib/model-runtime/createPulseBuiltIns";
import {
  SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS,
  type ExpertEditSystemPresetDefinition,
} from "../../features/ai-studio/components/edit/expertEditPresets";
import {
  SEEDED_BUILT_IN_STYLE_DEFINITIONS,
  type BuiltInStyleDefinition,
} from "../../lib/model-runtime/builtInStyles";
import { STYLE_PROMPT_MAX_CHARACTERS } from "../../lib/model-runtime/styleCreatorLimits";
import AdminAgentInstructionsPage from "../../pages/admin/agent-instructions";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useAdminAccessMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const resolveProcessedStyleSourceMock = vi.hoisted(() => vi.fn());
const isImageFileCandidateMock = vi.hoisted(() => vi.fn());

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

vi.mock("../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

vi.mock("../../features/ai-studio/logic/styleCreatorIntake", () => ({
  isImageFileCandidate: (...args: unknown[]) => isImageFileCandidateMock(...args),
  resolveProcessedStyleSource: (...args: unknown[]) => resolveProcessedStyleSourceMock(...args),
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
    degraded: false,
  }),
});

const buildStyleExtractPromptResponse = (promptBody = "Photographic, moody lighting") => ({
  ok: true,
  json: async () => ({
    promptBody,
    source: "control_plane" as const,
    updatedAt: "2026-05-05T18:00:00.000Z",
    updatedByEmail: "admin@example.com",
  }),
});

const buildStandardPromptResponse = (
  promptBody = "You are the ShortPulse AI Studio prompt editor."
) => ({
  ok: true,
  json: async () => ({
    promptBody,
    source: "control_plane" as const,
    updatedAt: "2026-05-05T18:00:00.000Z",
    updatedByEmail: "admin@example.com",
  }),
});

const buildEditSystemPresetResponse = (
  presetDefinitions: readonly ExpertEditSystemPresetDefinition[] = SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS
) => ({
  ok: true,
  json: async () => ({
    presetDefinitions,
    source: "control_plane" as const,
    updatedAt: "2026-05-05T18:00:00.000Z",
    updatedByEmail: "admin@example.com",
    degraded: false,
  }),
});

const buildBuiltInStyleResponse = (
  styleDefinitions: readonly BuiltInStyleDefinition[] = SEEDED_BUILT_IN_STYLE_DEFINITIONS
) => ({
  ok: true,
  json: async () => ({
    styleDefinitions,
    source: "control_plane" as const,
    updatedAt: "2026-05-05T18:00:00.000Z",
    updatedByEmail: "admin@example.com",
    degraded: false,
  }),
});

describe("Admin agent instructions page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchWithAuthMock.mockImplementation(async (input: string) => {
      if (input === "/api/admin/agent-instructions/standard-system-prompt") {
        return buildStandardPromptResponse();
      }
      if (input === "/api/admin/agent-instructions/style-extract-prompt") {
        return buildStyleExtractPromptResponse();
      }
      if (input === "/api/admin/agent-instructions/edit-system-presets") {
        return buildEditSystemPresetResponse();
      }
      if (input === "/api/admin/agent-instructions/built-in-styles") {
        return buildBuiltInStyleResponse();
      }
      if (input === "/api/admin/agent-instructions/pulse-builtins") {
        return buildCatalogResponse();
      }
      throw new Error(`Unexpected fetch target: ${input}`);
    });
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
    isImageFileCandidateMock.mockReturnValue(true);
    resolveProcessedStyleSourceMock.mockResolvedValue({
      previewImageUrl: "data:image/jpeg;base64,uploaded-built-in-style-preview",
      extractionSourceImageUrl: "data:image/jpeg;base64,uploaded-built-in-style-source",
      promptText: "",
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
    expect(await screen.findByText("Global built-in Pulse set")).toBeInTheDocument();
    expect(screen.getByText("Global built-in Styles")).toBeInTheDocument();
    expect(screen.getByText("Standard Create Agent")).toBeInTheDocument();
    expect(screen.getByText("Video Prompt Magic")).toBeInTheDocument();
    expect(screen.getByText("Multi Sequence Video Prompt")).toBeInTheDocument();
    expect(screen.getByText("DFY Story Builder")).toBeInTheDocument();
    expect(screen.getByText("Style Extraction System Prompt")).toBeInTheDocument();
  });

  it("edits, adds, removes, resets, and saves built-in Pulse slots", async () => {
    const updatedDefinitions = [
      {
        ...CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS[0],
        label: "Global Prompt Director",
        systemInstructions: "Draft pulse instructions.",
      },
    ];

    fetchWithAuthMock.mockImplementation(async (input: string, init?: { method?: string }) => {
      if (input === "/api/admin/agent-instructions/standard-system-prompt") {
        if (init?.method === "PUT") {
          return buildStandardPromptResponse("Future standard instructions.");
        }
        return buildStandardPromptResponse();
      }
      if (input === "/api/admin/agent-instructions/style-extract-prompt") {
        return buildStyleExtractPromptResponse();
      }
      if (input === "/api/admin/agent-instructions/edit-system-presets") {
        return buildEditSystemPresetResponse();
      }
      if (input === "/api/admin/agent-instructions/built-in-styles") {
        return buildBuiltInStyleResponse();
      }
      if (input === "/api/admin/agent-instructions/pulse-builtins") {
        if (init?.method === "PUT") {
          return buildCatalogResponse(updatedDefinitions);
        }
        return buildCatalogResponse([CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS[0]]);
      }
      throw new Error(`Unexpected fetch target: ${input}`);
    });

    render(<AdminAgentInstructionsPage />);
    await screen.findByText("Video Prompt Magic");

    const standardCard = screen.getByText("Standard Create Agent").closest("article");
    if (!standardCard) throw new Error("Expected Standard Create Agent card.");
    fireEvent.click(within(standardCard).getByRole("button", { name: "Expand" }));
    fireEvent.change(within(standardCard).getByRole("textbox", { name: "Runtime system prompt" }), {
      target: { value: "Future standard instructions." },
    });
    expect(
      within(standardCard).getByRole("textbox", { name: "Runtime system prompt" })
    ).toHaveValue("Future standard instructions.");
    fireEvent.click(within(standardCard).getByRole("button", { name: "Save prompt" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/admin/agent-instructions/standard-system-prompt",
        expect.objectContaining({
          method: "PUT",
        })
      );
    });

    const standardSaveRequest = fetchWithAuthMock.mock.calls.find(
      ([input, init]) =>
        input === "/api/admin/agent-instructions/standard-system-prompt" && init?.method === "PUT"
    );
    expect(JSON.parse(String(standardSaveRequest?.[1]?.body))).toEqual({
      promptBody: "Future standard instructions.",
      expectedUpdatedAt: "2026-05-05T18:00:00.000Z",
    });

    const pulseCard = screen.getByText("Video Prompt Magic").closest("article");
    if (!pulseCard) throw new Error("Expected Video Prompt Magic card.");
    fireEvent.click(within(pulseCard).getByRole("button", { name: "Expand" }));

    fireEvent.change(within(pulseCard).getByRole("textbox", { name: "Title" }), {
      target: { value: "Global Prompt Director" },
    });
    fireEvent.change(within(pulseCard).getByRole("textbox", { name: "Prompt" }), {
      target: { value: "Draft pulse instructions." },
    });
    expect(within(pulseCard).getByText("Unsaved edits")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Add built-in Pulse/i }));
    expect(screen.getByText("Pulse Slot 2")).toBeInTheDocument();

    const newSlotCard = screen.getByText("Pulse Slot 2").closest("article");
    if (!newSlotCard) throw new Error("Expected new Pulse slot card.");
    fireEvent.change(within(newSlotCard).getByRole("textbox", { name: "Title" }), {
      target: { value: "Universal Story Pulse" },
    });
    fireEvent.click(within(newSlotCard).getByRole("button", { name: "Delete" }));
    expect(screen.queryByText("Pulse Slot 2")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save Pulse set" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/admin/agent-instructions/pulse-builtins",
        expect.objectContaining({
          method: "PUT",
        })
      );
    });

    const saveRequest = fetchWithAuthMock.mock.calls.find(
      ([input, init]) =>
        input === "/api/admin/agent-instructions/pulse-builtins" && init?.method === "PUT"
    );
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
      title: "Global Prompt Director",
      prompt: "Draft pulse instructions.",
    });

    expect(screen.getByText("Global Prompt Director")).toBeInTheDocument();
    expect(within(pulseCard).getByText("Stored")).toBeInTheDocument();

    fireEvent.change(within(pulseCard).getByRole("textbox", { name: "Title" }), {
      target: { value: "Temporary name" },
    });
    fireEvent.click(within(pulseCard).getByRole("button", { name: "Reset to stored" }));
    expect(within(pulseCard).getByRole("textbox", { name: "Title" })).toHaveValue(
      "Global Prompt Director"
    );
  }, 10_000);

  it("creates a built-in Pulse from the simple authoring fields", async () => {
    fetchWithAuthMock.mockImplementation(
      async (input: string, init?: { method?: string; body?: string }) => {
        if (input === "/api/admin/agent-instructions/standard-system-prompt") {
          return buildStandardPromptResponse();
        }
        if (input === "/api/admin/agent-instructions/style-extract-prompt") {
          return buildStyleExtractPromptResponse();
        }
        if (input === "/api/admin/agent-instructions/edit-system-presets") {
          return buildEditSystemPresetResponse();
        }
        if (input === "/api/admin/agent-instructions/built-in-styles") {
          return buildBuiltInStyleResponse();
        }
        if (input === "/api/admin/agent-instructions/pulse-builtins") {
          if (init?.method === "PUT") {
            return buildCatalogResponse();
          }
          return buildCatalogResponse();
        }
        throw new Error(`Unexpected fetch target: ${input}`);
      }
    );

    render(<AdminAgentInstructionsPage />);
    await screen.findByText("Video Prompt Magic");

    fireEvent.click(screen.getByRole("button", { name: /Add built-in Pulse/i }));
    const newSlotCard = screen.getByText("Pulse Slot 4").closest("article");
    if (!newSlotCard) throw new Error("Expected new Pulse slot card.");

    fireEvent.change(within(newSlotCard).getByRole("textbox", { name: "Title" }), {
      target: { value: "Prompt Modifier" },
    });
    fireEvent.change(within(newSlotCard).getByRole("textbox", { name: "Prompt" }), {
      target: {
        value: "Ask for the source prompt, then return a cleaner version.",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save Pulse set" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/admin/agent-instructions/pulse-builtins",
        expect.objectContaining({
          method: "PUT",
        })
      );
    });

    const saveRequest = fetchWithAuthMock.mock.calls.find(
      ([input, init]) =>
        input === "/api/admin/agent-instructions/pulse-builtins" && init?.method === "PUT"
    );
    const payload = JSON.parse(String(saveRequest?.[1]?.body)) as {
      builtInDefinitions: Array<Record<string, unknown>>;
    };
    expect(payload.builtInDefinitions[3]).toMatchObject({
      title: "Prompt Modifier",
      prompt: "Ask for the source prompt, then return a cleaner version.",
    });
  }, 10_000);

  it("edits, adds, removes, resets, and saves built-in Styles", async () => {
    const updatedStyleDefinitions: BuiltInStyleDefinition[] = [
      {
        ...SEEDED_BUILT_IN_STYLE_DEFINITIONS[1],
        title: "Editorial Cinematic",
        stylePrompt: "dramatic editorial lighting, rich contrast, polished color grade",
        previewImageUrl: "data:image/jpeg;base64,uploaded-built-in-style-preview",
      },
      {
        styleId: "lo-fi-noir",
        title: "Lo-fi Noir",
        stylePrompt: "grainy black-and-white street photography, strong contrast",
        previewImageUrl: "data:image/jpeg;base64,uploaded-built-in-style-preview",
        referenceImageName: null,
        schemaVersion: 1,
      },
    ];

    fetchWithAuthMock.mockImplementation(async (input: string, init?: { method?: string }) => {
      if (input === "/api/admin/agent-instructions/standard-system-prompt") {
        return buildStandardPromptResponse();
      }
      if (input === "/api/admin/agent-instructions/style-extract-prompt") {
        return buildStyleExtractPromptResponse();
      }
      if (input === "/api/admin/agent-instructions/edit-system-presets") {
        return buildEditSystemPresetResponse();
      }
      if (input === "/api/admin/agent-instructions/built-in-styles") {
        if (init?.method === "PUT") {
          return buildBuiltInStyleResponse(updatedStyleDefinitions);
        }
        return buildBuiltInStyleResponse([SEEDED_BUILT_IN_STYLE_DEFINITIONS[1]]);
      }
      if (input === "/api/admin/agent-instructions/pulse-builtins") {
        return buildCatalogResponse();
      }
      throw new Error(`Unexpected fetch target: ${input}`);
    });

    render(<AdminAgentInstructionsPage />);
    await screen.findByText("Global built-in Styles");

    const stylesCard = screen.getByText("Global built-in Styles").closest("article");
    if (!stylesCard) throw new Error("Expected built-in Styles card.");
    const cinematicTile = within(stylesCard).getByText("Cinematic").closest("article");
    if (!cinematicTile) throw new Error("Expected Cinematic style tile.");
    expect(within(cinematicTile).queryByText("Stored")).not.toBeInTheDocument();
    expect(within(cinematicTile).queryByRole("textbox", { name: "Style ID" })).toBeNull();
    expect(within(cinematicTile).queryByLabelText("Preview image URL")).toBeNull();
    expect(
      within(cinematicTile).queryByRole("textbox", { name: "Reference image name" })
    ).toBeNull();
    expect(within(cinematicTile).getByRole("textbox", { name: "Style name" })).toHaveValue(
      "Cinematic"
    );

    fireEvent.change(within(cinematicTile).getByRole("textbox", { name: "Style name" }), {
      target: { value: "Editorial Cinematic" },
    });
    fireEvent.change(within(cinematicTile).getByRole("textbox", { name: "Style Prompt" }), {
      target: { value: "dramatic editorial lighting, rich contrast, polished color grade" },
    });
    const previewUploadInput = within(cinematicTile).getByLabelText("Preview image");
    const previewFile = new File(["style-preview"], "cinematic-preview.png", {
      type: "image/png",
    });
    fireEvent.change(previewUploadInput, {
      target: {
        files: [previewFile],
      },
    });
    await waitFor(() => {
      expect(resolveProcessedStyleSourceMock).toHaveBeenCalledWith({ file: previewFile });
    });
    await waitFor(() => {
      expect(within(cinematicTile).getByAltText("Editorial Cinematic preview")).toHaveAttribute(
        "src",
        "data:image/jpeg;base64,uploaded-built-in-style-preview"
      );
    });
    expect(within(stylesCard).getByText("Unsaved edits")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Add built-in Style/i }));
    expect(screen.getByText("Style 2")).toBeInTheDocument();
    const newStyleCard = screen.getByText("Style 2").closest("article");
    if (!newStyleCard) throw new Error("Expected new Style card.");
    fireEvent.click(within(newStyleCard).getByRole("button", { name: /Delete Style 2/i }));
    expect(screen.queryByText("Style 2")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Add built-in Style/i }));
    const derivedStyleCard = screen.getByText("Style 2").closest("article");
    if (!derivedStyleCard) throw new Error("Expected derived Style card.");
    fireEvent.change(within(derivedStyleCard).getByRole("textbox", { name: "Style name" }), {
      target: { value: "Lo-fi Noir" },
    });
    const derivedStylePromptInput = within(derivedStyleCard).getByRole("textbox", {
      name: "Style Prompt",
    }) as HTMLTextAreaElement;
    expect(derivedStylePromptInput.maxLength).toBe(STYLE_PROMPT_MAX_CHARACTERS);
    fireEvent.change(derivedStylePromptInput, {
      target: { value: "x".repeat(STYLE_PROMPT_MAX_CHARACTERS + 50) },
    });
    expect(derivedStylePromptInput).toHaveValue("x".repeat(STYLE_PROMPT_MAX_CHARACTERS));
    expect(
      within(derivedStyleCard).getByText(
        `${STYLE_PROMPT_MAX_CHARACTERS} / ${STYLE_PROMPT_MAX_CHARACTERS}`
      )
    ).toBeInTheDocument();
    fireEvent.change(derivedStylePromptInput, {
      target: { value: "grainy black-and-white street photography, strong contrast" },
    });
    fireEvent.change(within(derivedStyleCard).getByLabelText("Preview image"), {
      target: {
        files: [
          new File(["lo-fi-preview"], "lo-fi-noir.png", {
            type: "image/png",
          }),
        ],
      },
    });
    await waitFor(() => {
      expect(within(derivedStyleCard).getByAltText("Lo-fi Noir preview")).toHaveAttribute(
        "src",
        "data:image/jpeg;base64,uploaded-built-in-style-preview"
      );
    });

    fireEvent.click(within(stylesCard).getByRole("button", { name: "Save Styles set" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/admin/agent-instructions/built-in-styles",
        expect.objectContaining({
          method: "PUT",
        })
      );
    });

    const saveRequest = fetchWithAuthMock.mock.calls.find(
      ([input, init]) =>
        input === "/api/admin/agent-instructions/built-in-styles" && init?.method === "PUT"
    );
    expect(saveRequest?.[1]).toMatchObject({
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    expect(JSON.parse(String(saveRequest?.[1]?.body))).toEqual({
      styleDefinitions: [
        {
          styleId: "cinematic",
          title: "Editorial Cinematic",
          stylePrompt: "dramatic editorial lighting, rich contrast, polished color grade",
          previewImageUrl: "data:image/jpeg;base64,uploaded-built-in-style-preview",
          referenceImageName: null,
          schemaVersion: 1,
        },
        {
          styleId: "lo-fi-noir",
          title: "Lo-fi Noir",
          stylePrompt: "grainy black-and-white street photography, strong contrast",
          previewImageUrl: "data:image/jpeg;base64,uploaded-built-in-style-preview",
          referenceImageName: null,
          schemaVersion: 1,
        },
      ],
      expectedUpdatedAt: "2026-05-05T18:00:00.000Z",
    });

    expect(within(stylesCard).getByText("Editorial Cinematic")).toBeInTheDocument();
    expect(within(stylesCard).getByText("Lo-fi Noir")).toBeInTheDocument();
    fireEvent.change(within(cinematicTile).getByRole("textbox", { name: "Style name" }), {
      target: { value: "Temporary style name" },
    });
    fireEvent.click(within(stylesCard).getByRole("button", { name: "Reset to stored" }));
    expect(within(cinematicTile).getByRole("textbox", { name: "Style name" })).toHaveValue(
      "Editorial Cinematic"
    );
  });

  it("saves one Pulse card without publishing other unsaved Pulse edits", async () => {
    const storedDefinitions = [
      CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS[0],
      CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS[1],
    ];
    const savedDefinitions = [
      {
        ...storedDefinitions[0],
        label: "Global Prompt Director",
      },
      storedDefinitions[1],
    ];

    fetchWithAuthMock.mockImplementation(
      async (input: string, init?: { method?: string; body?: string }) => {
        if (input === "/api/admin/agent-instructions/standard-system-prompt") {
          return buildStandardPromptResponse();
        }
        if (input === "/api/admin/agent-instructions/style-extract-prompt") {
          return buildStyleExtractPromptResponse();
        }
        if (input === "/api/admin/agent-instructions/edit-system-presets") {
          return buildEditSystemPresetResponse();
        }
        if (input === "/api/admin/agent-instructions/built-in-styles") {
          return buildBuiltInStyleResponse();
        }
        if (input === "/api/admin/agent-instructions/pulse-builtins") {
          if (init?.method === "PUT") {
            return buildCatalogResponse(savedDefinitions);
          }
          return buildCatalogResponse(storedDefinitions);
        }
        throw new Error(`Unexpected fetch target: ${input}`);
      }
    );

    render(<AdminAgentInstructionsPage />);
    await screen.findByText("Video Prompt Magic");

    const firstCard = screen.getByText("Video Prompt Magic").closest("article");
    const secondCard = screen.getByText("Multi Sequence Video Prompt").closest("article");
    if (!firstCard || !secondCard) throw new Error("Expected Pulse cards.");

    fireEvent.click(within(firstCard).getByRole("button", { name: "Expand" }));
    fireEvent.click(within(secondCard).getByRole("button", { name: "Expand" }));

    fireEvent.change(within(firstCard).getByRole("textbox", { name: "Title" }), {
      target: { value: "Global Prompt Director" },
    });
    fireEvent.change(within(secondCard).getByRole("textbox", { name: "Title" }), {
      target: { value: "Do Not Publish Yet" },
    });

    fireEvent.click(within(firstCard).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/admin/agent-instructions/pulse-builtins",
        expect.objectContaining({
          method: "PUT",
        })
      );
    });

    const saveRequest = fetchWithAuthMock.mock.calls.find(
      ([input, init]) =>
        input === "/api/admin/agent-instructions/pulse-builtins" && init?.method === "PUT"
    );
    const payload = JSON.parse(String(saveRequest?.[1]?.body)) as {
      builtInDefinitions: Array<Record<string, unknown>>;
      expectedUpdatedAt: string;
    };

    expect(payload.expectedUpdatedAt).toBe("2026-05-05T18:00:00.000Z");
    expect(payload.builtInDefinitions[0]?.title).toBe("Global Prompt Director");
    expect(payload.builtInDefinitions[1]?.title).toBe("Multi Sequence Video Prompt");

    expect(within(firstCard).getByText("Stored")).toBeInTheDocument();
    expect(within(secondCard).getByText("Unsaved edits")).toBeInTheDocument();
    expect(within(secondCard).getByRole("textbox", { name: "Title" })).toHaveValue(
      "Do Not Publish Yet"
    );
  });

  it("blocks global Pulse set saves while a new slot is blank or incomplete", async () => {
    render(<AdminAgentInstructionsPage />);
    await screen.findByText("Video Prompt Magic");

    fireEvent.click(screen.getByRole("button", { name: /Add built-in Pulse/i }));

    const globalSaveButton = screen.getByRole("button", { name: "Save Pulse set" });
    expect(globalSaveButton).toBeDisabled();

    const newSlotCard = screen.getByText("Pulse Slot 4").closest("article");
    if (!newSlotCard) throw new Error("Expected blank Pulse slot card.");
    fireEvent.change(within(newSlotCard).getByRole("textbox", { name: "Title" }), {
      target: { value: "Incomplete Pulse" },
    });

    expect(globalSaveButton).toBeDisabled();
    expect(
      fetchWithAuthMock.mock.calls.some(
        ([target, init]) =>
          target === "/api/admin/agent-instructions/pulse-builtins" &&
          (init as { method?: string } | undefined)?.method === "PUT"
      )
    ).toBe(false);
  });

  it("edits and saves the live style-extraction prompt", async () => {
    fetchWithAuthMock.mockImplementation(
      async (input: string, init?: { method?: string; body?: string }) => {
        if (input === "/api/admin/agent-instructions/standard-system-prompt") {
          return buildStandardPromptResponse();
        }
        if (input === "/api/admin/agent-instructions/style-extract-prompt") {
          if (init?.method === "PUT") {
            return buildStyleExtractPromptResponse("Digital Illustration, soft bloom");
          }
          return buildStyleExtractPromptResponse();
        }
        if (input === "/api/admin/agent-instructions/edit-system-presets") {
          return buildEditSystemPresetResponse();
        }
        if (input === "/api/admin/agent-instructions/built-in-styles") {
          return buildBuiltInStyleResponse();
        }
        if (input === "/api/admin/agent-instructions/pulse-builtins") {
          return buildCatalogResponse();
        }
        throw new Error(`Unexpected fetch target: ${input}`);
      }
    );

    render(<AdminAgentInstructionsPage />);
    await screen.findByText("Style Extraction System Prompt");

    const styleCard = screen.getByText("Style Extraction System Prompt").closest("article");
    if (!styleCard) throw new Error("Expected style extraction prompt card.");

    fireEvent.click(within(styleCard).getByRole("button", { name: "Expand" }));
    const promptBox = within(styleCard).getByRole("textbox", { name: "Runtime system prompt" });
    fireEvent.change(promptBox, {
      target: { value: "Digital Illustration, soft bloom" },
    });
    expect(within(styleCard).getByText("Unsaved edits")).toBeInTheDocument();

    fireEvent.click(within(styleCard).getByRole("button", { name: "Save prompt" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/admin/agent-instructions/style-extract-prompt",
        expect.objectContaining({
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        })
      );
    });

    const saveRequest = fetchWithAuthMock.mock.calls.find(
      ([input, init]) =>
        input === "/api/admin/agent-instructions/style-extract-prompt" && init?.method === "PUT"
    );
    expect(JSON.parse(String(saveRequest?.[1]?.body))).toEqual({
      promptBody: "Digital Illustration, soft bloom",
      expectedUpdatedAt: "2026-05-05T18:00:00.000Z",
    });
    expect(promptBox).toHaveValue("Digital Illustration, soft bloom");
    expect(within(styleCard).getByText("Live override")).toBeInTheDocument();
  });

  it("edits and saves the global Edit system preset catalog", async () => {
    fetchWithAuthMock.mockImplementation(
      async (input: string, init?: { method?: string; body?: string }) => {
        if (input === "/api/admin/agent-instructions/standard-system-prompt") {
          return buildStandardPromptResponse();
        }
        if (input === "/api/admin/agent-instructions/style-extract-prompt") {
          return buildStyleExtractPromptResponse();
        }
        if (input === "/api/admin/agent-instructions/edit-system-presets") {
          if (init?.method === "PUT") {
            const editedPresetDefinitions: ExpertEditSystemPresetDefinition[] =
              SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS.map((preset) =>
                preset.presetId === "selfie"
                  ? {
                      ...preset,
                      label: "Front Camera Selfie",
                      prompt: "Use a realistic front-camera selfie perspective.",
                    }
                  : { ...preset }
              );
            return buildEditSystemPresetResponse([...editedPresetDefinitions]);
          }
          return buildEditSystemPresetResponse();
        }
        if (input === "/api/admin/agent-instructions/built-in-styles") {
          return buildBuiltInStyleResponse();
        }
        if (input === "/api/admin/agent-instructions/pulse-builtins") {
          return buildCatalogResponse();
        }
        throw new Error(`Unexpected fetch target: ${input}`);
      }
    );

    render(<AdminAgentInstructionsPage />);
    await screen.findByText("Edit Mode System Presets");

    const editCard = screen.getByText("Edit Mode System Presets").closest("article");
    if (!editCard) throw new Error("Expected Edit system presets card.");

    fireEvent.click(within(editCard).getByRole("button", { name: "Expand" }));
    const presetGrid = within(editCard).getByRole("list", { name: "Edit mode system presets" });
    const selfieTile = within(presetGrid).getByText("Selfie").closest("article");
    if (!selfieTile) throw new Error("Expected Selfie preset tile.");
    const selfiePresetButton = within(selfieTile)
      .getAllByRole("button")
      .find((button) => !button.getAttribute("aria-label")?.startsWith("Delete "));
    if (!selfiePresetButton) throw new Error("Expected Selfie preset button.");
    fireEvent.click(selfiePresetButton);

    fireEvent.change(screen.getByRole("textbox", { name: "Preset Name" }), {
      target: { value: "Front Camera Selfie" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Preset Prompt" }), {
      target: { value: "Use a realistic front-camera selfie perspective." },
    });
    const editPresetDialog = screen.getByRole("dialog", { name: "Edit Selfie preset" });
    fireEvent.click(within(editPresetDialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/admin/agent-instructions/edit-system-presets",
        expect.objectContaining({
          method: "PUT",
        })
      );
    });

    const editSaveRequest = fetchWithAuthMock.mock.calls.find(
      ([input, init]) =>
        input === "/api/admin/agent-instructions/edit-system-presets" && init?.method === "PUT"
    );
    expect(JSON.parse(String(editSaveRequest?.[1]?.body))).toMatchObject({
      expectedUpdatedAt: "2026-05-05T18:00:00.000Z",
    });
    expect(within(editCard).getByText("Front Camera Selfie")).toBeInTheDocument();
  });

  it("surfaces degraded control-plane reads on the style-extraction prompt card", async () => {
    fetchWithAuthMock.mockImplementation(async (input: string) => {
      if (input === "/api/admin/agent-instructions/standard-system-prompt") {
        return buildStandardPromptResponse();
      }
      if (input === "/api/admin/agent-instructions/style-extract-prompt") {
        return {
          ok: true,
          json: async () => ({
            promptBody: "Seed fallback prompt",
            source: "seed" as const,
            updatedAt: null,
            updatedByEmail: null,
            degraded: true,
          }),
        };
      }
      if (input === "/api/admin/agent-instructions/edit-system-presets") {
        return buildEditSystemPresetResponse();
      }
      if (input === "/api/admin/agent-instructions/built-in-styles") {
        return buildBuiltInStyleResponse();
      }
      if (input === "/api/admin/agent-instructions/pulse-builtins") {
        return buildCatalogResponse();
      }
      throw new Error(`Unexpected fetch target: ${input}`);
    });

    render(<AdminAgentInstructionsPage />);
    const degradedMessage = await screen.findByText(
      "Live control-plane lookup failed. Showing the seeded code prompt until the admin route recovers."
    );

    expect(degradedMessage).toBeInTheDocument();
    const styleCard = screen.getByText("Style Extraction System Prompt").closest("article");
    if (!styleCard) throw new Error("Expected style extraction prompt card.");
    expect(within(styleCard).getByText("Seeded local copy")).toBeInTheDocument();
  });

  it("blocks Pulse saves when the catalog read is degraded", async () => {
    fetchWithAuthMock.mockImplementation(async (input: string) => {
      if (input === "/api/admin/agent-instructions/standard-system-prompt") {
        return buildStandardPromptResponse();
      }
      if (input === "/api/admin/agent-instructions/style-extract-prompt") {
        return buildStyleExtractPromptResponse();
      }
      if (input === "/api/admin/agent-instructions/edit-system-presets") {
        return buildEditSystemPresetResponse();
      }
      if (input === "/api/admin/agent-instructions/built-in-styles") {
        return buildBuiltInStyleResponse();
      }
      if (input === "/api/admin/agent-instructions/pulse-builtins") {
        if (fetchWithAuthMock.mock.calls.filter(([target]) => target === input).length > 1) {
          return buildCatalogResponse([
            {
              ...CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS[0],
              label: "Global Prompt Director",
            },
          ]);
        }
        return {
          ok: true,
          json: async () => ({
            builtInDefinitions: [CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS[0]],
            source: "seed" as const,
            updatedAt: null,
            updatedByEmail: null,
            degraded: true,
          }),
        };
      }
      throw new Error(`Unexpected fetch target: ${input}`);
    });

    render(<AdminAgentInstructionsPage />);
    const degradedMessage = await screen.findByText(
      "Live Pulse catalog lookup failed. Showing fallback Pulse content. Reload before saving so the live shared set is not overwritten."
    );

    expect(degradedMessage).toBeInTheDocument();

    const pulseCard = screen.getByText("Video Prompt Magic").closest("article");
    if (!pulseCard) throw new Error("Expected Pulse card.");
    fireEvent.click(within(pulseCard).getByRole("button", { name: "Expand" }));
    fireEvent.change(within(pulseCard).getByRole("textbox", { name: "Title" }), {
      target: { value: "Global Prompt Director" },
    });

    expect(within(pulseCard).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(
      fetchWithAuthMock.mock.calls.some(
        ([target, init]) =>
          target === "/api/admin/agent-instructions/pulse-builtins" &&
          (init as { method?: string } | undefined)?.method === "PUT"
      )
    ).toBe(false);
  });

  it("shows the Pulse save failure instead of hiding it behind a stale load warning", async () => {
    fetchWithAuthMock.mockImplementation(async (input: string, init?: { method?: string }) => {
      if (input === "/api/admin/agent-instructions/standard-system-prompt") {
        return buildStandardPromptResponse();
      }
      if (input === "/api/admin/agent-instructions/style-extract-prompt") {
        return buildStyleExtractPromptResponse();
      }
      if (input === "/api/admin/agent-instructions/edit-system-presets") {
        return buildEditSystemPresetResponse();
      }
      if (input === "/api/admin/agent-instructions/built-in-styles") {
        return buildBuiltInStyleResponse();
      }
      if (input === "/api/admin/agent-instructions/pulse-builtins") {
        if (init?.method === "PUT") {
          return {
            ok: false,
            json: async () => ({
              error: "Failed to save built-in guided workflows.",
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            builtInDefinitions: [CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS[0]],
            source: "control_plane" as const,
            updatedAt: "2026-05-08T17:00:00.000Z",
            updatedByEmail: "admin@example.com",
            degraded: false,
          }),
        };
      }
      throw new Error(`Unexpected fetch target: ${input}`);
    });

    render(<AdminAgentInstructionsPage />);
    const liveCatalogMessage = await screen.findByText(
      /Live global Pulse catalog last updated by admin@example.com/
    );
    expect(liveCatalogMessage).toBeInTheDocument();
    const liveCatalogMessageText = liveCatalogMessage.textContent ?? "";

    const pulseCard = screen.getByText("Video Prompt Magic").closest("article");
    if (!pulseCard) throw new Error("Expected Pulse card.");
    fireEvent.click(within(pulseCard).getByRole("button", { name: "Expand" }));
    fireEvent.change(within(pulseCard).getByRole("textbox", { name: "Title" }), {
      target: { value: "Global Prompt Director" },
    });
    fireEvent.click(within(pulseCard).getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Failed to save built-in guided workflows.")
    ).toBeInTheDocument();
    expect(screen.queryByText(liveCatalogMessageText)).not.toBeInTheDocument();
    expect(within(pulseCard).getByText("Unsaved edits")).toBeInTheDocument();
  });
});
