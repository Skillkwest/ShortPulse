import type { AiStudioErrorCategory } from "../logic/errorPresentation";
import type { StudioOutput } from "../types";

export type AiStudioErrorScenarioId =
  | "content_policy"
  | "provider_upstream"
  | "raw_json_validation"
  | "missing_input"
  | "reference_upload"
  | "preflight_timeout"
  | "no_media"
  | "save_autosave"
  | "unknown_fallback";

export type AiStudioErrorScenario = {
  id: AiStudioErrorScenarioId;
  label: string;
  output: StudioOutput;
  expectedCategory: AiStudioErrorCategory;
  expectedCompactText?: string;
  expectedCardText: string;
  expectedBannerText: string;
  expectedDetailText: string;
  rawPayloadProbe?: string;
  hiddenCardProbes: string[];
};

const createFailedOutput = (
  id: AiStudioErrorScenarioId,
  overrides: Partial<StudioOutput>
): StudioOutput => ({
  id: `fixture-${id}`,
  prompt: "Create a cinematic product reference.",
  mode: "image",
  aspect: "1:1",
  model: "Seedream 4.5 Edit",
  modelId: "fal-ai/bytedance/seedream/v4.5/edit",
  status: "ready",
  timestamp: "Failed",
  taskState: "fail",
  ...overrides,
});

export const AI_STUDIO_ERROR_SCENARIOS: AiStudioErrorScenario[] = [
  {
    id: "content_policy",
    label: "content policy safety failure",
    output: createFailedOutput("content_policy", {
      errorMessage: "Your request was blocked by the safety system.",
      errorMessageShort: "Content not allowed",
      errorDetail: "Your request was blocked by the safety system. Reason: explicit.",
    }),
    expectedCategory: "content_policy",
    expectedCompactText: "Content not allowed",
    expectedCardText: "Explicit content blocked",
    expectedBannerText: "explicit or unsafe content",
    expectedDetailText: "explicit or unsafe content",
    hiddenCardProbes: ["Reason: explicit", "explicit or unsafe content"],
  },
  {
    id: "provider_upstream",
    label: "opaque upstream provider failure",
    output: createFailedOutput("provider_upstream", {
      model: "Kie Kling 3.0",
      modelId: "kie-ai/kling-3.0",
      errorMessage: "Internal Error, Please try again later.",
      errorMessageShort: "Generation failed",
      errorDetail: "Internal Error, Please try again later.",
      errorPayload: {
        provider: "kie",
        request_id: "req_provider_upstream",
        status: 500,
      },
    }),
    expectedCategory: "provider_error",
    expectedCardText: "Kling 3.0 generation failed",
    expectedBannerText: "No ShortPulse credits are charged",
    expectedDetailText: "Internal Error, Please try again later.",
    rawPayloadProbe: "req_provider_upstream",
    hiddenCardProbes: ["request_id", "No ShortPulse credits are charged"],
  },
  {
    id: "raw_json_validation",
    label: "raw provider validation payload",
    output: createFailedOutput("raw_json_validation", {
      errorMessage: "Invalid request",
      errorMessageShort: "Generation failed",
      errorDetail: '{"detail":[{"loc":["prompt"],"msg":"Field required","type":"missing"}]}',
      errorPayload: {
        detail: [{ loc: ["prompt"], msg: "Field required", type: "missing" }],
      },
    }),
    expectedCategory: "missing_input",
    expectedCardText: "Prompt is required.",
    expectedBannerText: "Prompt is required.",
    expectedDetailText: '"loc"',
    rawPayloadProbe: '"missing"',
    hiddenCardProbes: ['{"detail"', '"loc"'],
  },
  {
    id: "missing_input",
    label: "client-side missing input failure",
    output: createFailedOutput("missing_input", {
      model: "Kie Kling 3.0",
      modelId: "legacy-kie-kling",
      errorMessage: "Generation failed",
      errorMessageShort: "Generation failed",
      errorDetail: "Kie Kling 3.0 submit requires at least one image URL.",
    }),
    expectedCategory: "missing_input",
    expectedCardText: "Kling 3.0 submit requires at",
    expectedBannerText: "Kling 3.0 submit requires at least one image URL.",
    expectedDetailText: "Kie Kling 3.0 submit requires at least one image URL.",
    hiddenCardProbes: [],
  },
  {
    id: "reference_upload",
    label: "reference upload failure",
    output: createFailedOutput("reference_upload", {
      errorMessage: "Reference upload failed",
      errorMessageShort: "Upload failed",
      errorDetail: "Reference upload failed: 413 file too large for provider preflight.",
      errorPayload: {
        status: 413,
        message: "file too large",
        request_id: "req_upload_413",
      },
    }),
    expectedCategory: "reference_upload",
    expectedCardText: "Upload failed",
    expectedBannerText: "Reference upload failed",
    expectedDetailText: "413 file too large",
    rawPayloadProbe: "req_upload_413",
    hiddenCardProbes: ["413 file too large", "req_upload_413"],
  },
  {
    id: "preflight_timeout",
    label: "provider preflight timeout",
    output: createFailedOutput("preflight_timeout", {
      errorMessage: "Generation timed out. Please retry.",
      errorMessageShort: "Timed out",
      errorDetail: "Provider preflight timed out after 60 seconds while minting upload URLs.",
      errorPayload: {
        phase: "preflight",
        timeoutMs: 60000,
        request_id: "req_preflight_timeout",
      },
    }),
    expectedCategory: "preflight_timeout",
    expectedCardText: "Timed out",
    expectedBannerText: "Generation timed out",
    expectedDetailText: "Provider preflight timed out",
    rawPayloadProbe: "req_preflight_timeout",
    hiddenCardProbes: ["60000", "req_preflight_timeout"],
  },
  {
    id: "no_media",
    label: "terminal provider success without media",
    output: createFailedOutput("no_media", {
      errorMessage: "No media returned.",
      errorMessageShort: "No media returned.",
      errorDetail: "Provider terminal success without media payload.",
      errorPayload: {
        reason: "terminal_success_no_media",
        provider_status: "succeeded",
      },
    }),
    expectedCategory: "no_media",
    expectedCardText: "No media returned.",
    expectedBannerText: "No media returned.",
    expectedDetailText: "Provider terminal success without media payload.",
    rawPayloadProbe: "terminal_success_no_media",
    hiddenCardProbes: ["terminal_success_no_media", "provider_status"],
  },
  {
    id: "save_autosave",
    label: "reference autosave failure",
    output: createFailedOutput("save_autosave", {
      errorMessage: "Save failed",
      errorMessageShort: "Save failed",
      errorDetail: "Autosave failed while writing generated media to the project.",
      errorPayload: {
        table: "project_generation_items",
        code: "23505",
        request_id: "req_save_autosave",
      },
      saveState: "failed",
      saveError: "Autosave failed while writing generated media to the project.",
    }),
    expectedCategory: "save_error",
    expectedCardText: "Save failed",
    expectedBannerText: "Save failed",
    expectedDetailText: "Autosave failed",
    rawPayloadProbe: "req_save_autosave",
    hiddenCardProbes: ["project_generation_items", "23505"],
  },
  {
    id: "unknown_fallback",
    label: "unknown fallback failure",
    output: createFailedOutput("unknown_fallback", {
      errorMessage: "Something went wrong",
      errorMessageShort: null,
      errorDetail: null,
      errorPayload: {
        unexpected: true,
        trace: "unknown_error_trace",
      },
    }),
    expectedCategory: "unknown",
    expectedCardText: "Something went wrong",
    expectedBannerText: "Something went wrong",
    expectedDetailText: "unknown_error_trace",
    rawPayloadProbe: "unknown_error_trace",
    hiddenCardProbes: ["unknown_error_trace", "unexpected"],
  },
];

export const getAiStudioErrorScenario = (id: AiStudioErrorScenarioId): AiStudioErrorScenario => {
  const scenario = AI_STUDIO_ERROR_SCENARIOS.find((candidate) => candidate.id === id);
  if (!scenario) {
    throw new Error(`Unknown AI Studio error scenario: ${id}`);
  }
  return scenario;
};
