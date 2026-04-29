import { vi } from "vitest";
import pulseStudioAgentHandler from "../../pages/api/ai/studio-agent-pulse";
import standardStudioAgentHandler from "../../pages/api/ai/studio-agent-standard";

const hasPulseContext = (value: unknown): boolean =>
  Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "pulse" in value &&
    (value as { pulse?: unknown }).pulse != null
  );

const studioAgentHandler = async (req: never, res: never) => {
  const request = req as { body?: { context?: unknown } };
  return hasPulseContext(request.body?.context)
    ? pulseStudioAgentHandler(req, res)
    : standardStudioAgentHandler(req, res);
};

export default studioAgentHandler;

export const requireApiUserMock = vi.fn();
export const runThinkerFormatterTurnMock = vi.fn();
export const readAgentConversationCanonicalPromptMock = vi.fn();
export const upsertAgentConversationCanonicalPromptMock = vi.fn();
export const logApiRouteExceptionMock = vi.fn();
export const resolveRuntimeSafetyProfileMock = vi.fn();

let apiUserCounter = 0;

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../features/ai-agent/logic/studioAgentThinkerFormatter", () => ({
  runThinkerFormatterTurn: (...args: unknown[]) => runThinkerFormatterTurnMock(...args),
}));

vi.mock("../../lib/server/api/agentConversationState", async () => {
  const actual = await vi.importActual("../../lib/server/api/agentConversationState");
  return {
    ...(actual as object),
    readAgentConversationCanonicalPrompt: (...args: unknown[]) =>
      readAgentConversationCanonicalPromptMock(...args),
    upsertAgentConversationCanonicalPrompt: (...args: unknown[]) =>
      upsertAgentConversationCanonicalPromptMock(...args),
  };
});

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/agentSafetyPolicyControlPlane", () => ({
  resolveRuntimeSafetyProfile: (...args: unknown[]) => resolveRuntimeSafetyProfileMock(...args),
}));

export const createMockResponse = () => {
  const headers = new Map<string, string>();
  const res: {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
    setHeader: ReturnType<typeof vi.fn>;
    getHeader: ReturnType<typeof vi.fn>;
  } = {
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
    getHeader: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.setHeader.mockImplementation((name: string, value: string) => {
    headers.set(name.toLowerCase(), value);
    return res;
  });
  res.getHeader.mockImplementation((name: string) => headers.get(name.toLowerCase()));
  return res;
};

export const extractTelemetryPaths = (infoSpy: ReturnType<typeof vi.spyOn>): string[] =>
  infoSpy.mock.calls
    .filter((call: unknown[]) => call[0] === "[studio-agent][telemetry]")
    .map((call: unknown[]) => {
      try {
        const payload = JSON.parse(String(call[1])) as { path?: string };
        return typeof payload.path === "string" ? payload.path : "";
      } catch {
        return "";
      }
    })
    .filter(Boolean);

export const extractTelemetryPayloads = (
  infoSpy: ReturnType<typeof vi.spyOn>
): Array<Record<string, unknown>> =>
  infoSpy.mock.calls
    .filter((call: unknown[]) => call[0] === "[studio-agent][telemetry]")
    .map((call: unknown[]) => {
      try {
        return JSON.parse(String(call[1])) as Record<string, unknown>;
      } catch {
        return {};
      }
    });

export const extractInputPrecheckTelemetryPayloads = (
  infoSpy: ReturnType<typeof vi.spyOn>
): Array<Record<string, unknown>> =>
  infoSpy.mock.calls
    .filter((call: unknown[]) => call[0] === "[studio-agent][safety-input-precheck]")
    .map((call: unknown[]) => {
      try {
        return JSON.parse(String(call[1])) as Record<string, unknown>;
      } catch {
        return {};
      }
    });

export const resetStudioAgentRuntimeTestState = () => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = "test-key";
  process.env.STUDIO_AGENT_ENABLED = "true";
  process.env.STUDIO_AGENT_CANONICAL_DB_ENABLED = "false";
  process.env.STUDIO_AGENT_SERVER_VISION_ENABLED = "false";
  process.env.STUDIO_AGENT_SINGLE_STAGE_ENABLED = "true";
  process.env.STUDIO_AGENT_LEGACY_V2_FALLBACK_ENABLED = "false";
  process.env.STUDIO_AGENT_TEXT_FAST_PATH_ENABLED = "true";
  delete process.env.STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED;
  delete process.env.STUDIO_AGENT_DIRECT_OPENAI_MODEL;
  delete process.env.STUDIO_AGENT_PULSE_MODEL;
  process.env.STUDIO_AGENT_SAFETY_POSTPROCESS_ENABLED = "true";
  process.env.STUDIO_AGENT_SAFETY_DEBUG = "false";
  process.env.STUDIO_AGENT_TIMEOUT_MS = String(20000);
  delete process.env.STUDIO_AGENT_VISION_TIMEOUT_MS;
  delete process.env.STUDIO_AGENT_TURN_TIMEOUT_MS;
  delete process.env.STUDIO_AGENT_PULSE_TURN_TIMEOUT_MS;
  process.env.NEXT_PUBLIC_AGENT_V2 = "false";
  delete process.env.SHORTPULSE_OPENAI_RESPONSES_ENABLED;
  delete process.env.SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED;
  delete process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED;
  delete process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES;
  delete process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_STUDIO_AGENT;

  requireApiUserMock.mockImplementation(async () => {
    apiUserCounter += 1;
    return { id: `user-${apiUserCounter}`, email: "user@example.com" };
  });
  resolveRuntimeSafetyProfileMock.mockResolvedValue({
    profileId: "prod_safe_v1",
    policyVersion: 1,
    source: "env",
  });
  readAgentConversationCanonicalPromptMock.mockResolvedValue(null);
  upsertAgentConversationCanonicalPromptMock.mockResolvedValue("saved prompt");
  runThinkerFormatterTurnMock.mockResolvedValue({
    ok: true,
    result: {
      parsed: {
        message: "Enhanced prompt output",
        actions: {
          applyPrompt: "Enhanced prompt output",
        },
      },
      nextCanonical: "Enhanced prompt output",
      semanticStatus: "ready",
      usage: {},
    },
  });
  vi.stubGlobal("fetch", vi.fn());
};
