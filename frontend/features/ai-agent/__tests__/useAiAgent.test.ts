import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRuntimeMode } from "../../../prefabs/agent";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { resolvePulseCreateAgentTransportSuccess } from "../client/pulseTransportResultResolution";
import { sendPulseCreateAgentTurn } from "../client/pulseStudioAgentTransport";
import { resolveStandardCreateAgentTransportSuccess } from "../client/standardTransportResultResolution";
import { sendStandardCreateAgentTurn } from "../client/standardStudioAgentTransport";
import type { SendResult, CreateAgentStateOptions } from "../createAgentStateTypes";
import { buildPulseCreateAgentContext } from "../logic/pulseCreateAgentContextBuilder";
import { buildStandardCreateAgentContext } from "../logic/standardContextBuilder";
import { useCreateAgentStateCore } from "../useCreateAgentStateCore";
import * as safetyInputPrecheckModule from "../../agent-runtime/studioAgentSafetyInputPrecheck";

vi.mock("../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);

type TestCreateAgentStateOptions = CreateAgentStateOptions & {
  runtimeMode?: AgentRuntimeMode;
};

const useCreateAgentStateTestHarness = ({
  runtimeMode = "standard",
  sendAgentTurn,
  resolveTransportSuccess,
  ...options
}: TestCreateAgentStateOptions = {}) => {
  const isPulseRuntime = runtimeMode === "pulse";
  const resolvedSendAgentTurn =
    sendAgentTurn ?? (isPulseRuntime ? sendPulseCreateAgentTurn : sendStandardCreateAgentTurn);
  const resolvedTransportSuccess =
    resolveTransportSuccess ??
    (isPulseRuntime
      ? resolvePulseCreateAgentTransportSuccess
      : (response) => ({
          ...resolveStandardCreateAgentTransportSuccess(response),
          workflowSession: null,
        }));

  return useCreateAgentStateCore({
    ...options,
    requestRuntimeMode: runtimeMode,
    allowSessionNamespaceOverride: isPulseRuntime,
    sessionNamespaceOverrideErrorText: !isPulseRuntime
      ? "Standard agent cannot send to an override session namespace."
      : undefined,
    buildAgentContext: isPulseRuntime
      ? buildPulseCreateAgentContext
      : buildStandardCreateAgentContext,
    sendAgentTurn: resolvedSendAgentTurn,
    resolveTransportSuccess: resolvedTransportSuccess,
  });
};

describe("useCreateAgentStateCore", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    window.sessionStorage.clear();
    delete process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED;
    delete process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_PROFILE_ACTIVE;
    delete process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED;
  });

  it("allows image-context-only turns without injecting describe text", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Image context received." }),
    } as Response);
    const { result } = renderHook(() =>
      useCreateAgentStateTestHarness({ enabled: true, runtimeMode: "pulse" })
    );

    await act(async () => {
      await result.current.send({
        text: "",
        payloadText: "",
        skipUserEcho: true,
        context: {
          media: [{ id: "img-1", kind: "image", url: "https://cdn.test/image.png" }],
        },
      });
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    const requestInit = fetchWithAuthMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(requestInit?.body ?? "{}")) as {
      messages?: Array<{ role: string; content: string }>;
      clientSessionKey?: string;
    };
    expect(body.messages?.[body.messages.length - 1]).toEqual({ role: "user", content: " " });
    expect(
      result.current.messages.some((message) => message.content === "Describe this image")
    ).toBe(false);
    expect(typeof body.clientSessionKey).toBe("string");
    expect((body.clientSessionKey ?? "").length).toBeGreaterThan(0);
  });

  it("still returns early for empty text with no media context", async () => {
    const { result } = renderHook(() =>
      useCreateAgentStateTestHarness({ enabled: true, runtimeMode: "pulse" })
    );

    await act(async () => {
      await result.current.send({
        text: "   ",
        payloadText: "   ",
        skipUserEcho: true,
        context: {},
      });
    });

    expect(fetchWithAuthMock).not.toHaveBeenCalled();
  });

  it("allows hidden payload-only turns for pulse activation seeds", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Pulse activated." }),
    } as Response);
    const { result } = renderHook(() =>
      useCreateAgentStateTestHarness({ enabled: true, runtimeMode: "pulse" })
    );

    await act(async () => {
      await result.current.send({
        text: "",
        payloadText: "pulse_activation_seed:story_builder",
        skipUserEcho: true,
        context: {
          pulse: {
            presetId: "story_builder",
            label: "Story Builder",
            instructions: "Guide the user through story setup.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage: "Upload your characters first.",
            workflowStageHints: ["Upload Characters"],
            outputMode: "chat_reply",
            memoryPolicy: "session",
            source: "builtin",
          },
        },
      });
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    const requestInit = fetchWithAuthMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(requestInit?.body ?? "{}")) as {
      messages?: Array<{ role: string; content: string }>;
    };
    expect(body.messages?.[body.messages.length - 1]).toEqual({
      role: "user",
      content: "pulse_activation_seed:story_builder",
    });
    expect(result.current.messages.some((message) => message.role === "user")).toBe(false);
  });

  it("keeps isSending true until the last overlapping request settles", async () => {
    const resolvers: Array<(value: { ok: true; data: { message: string } }) => void> = [];
    const sendAgentTurn = vi.fn(
      () =>
        new Promise<{ ok: true; data: { message: string } }>((resolve) => {
          resolvers.push(resolve);
        })
    );
    const resolveTransportSuccess = vi.fn((response: { message: string }) => ({
      actions: undefined,
      workflowSession: null,
      assistantContent: response.message,
      assistantOutputPrompt: null,
      canonicalPrompt: null,
    }));
    const { result } = renderHook(() =>
      useCreateAgentStateTestHarness({
        enabled: true,
        runtimeMode: "pulse",
        sendAgentTurn,
        resolveTransportSuccess,
      })
    );

    await act(async () => {
      void result.current.send({ text: "first" });
      void result.current.send({ text: "second" });
    });

    expect(result.current.isSending).toBe(true);

    await act(async () => {
      resolvers[0]?.({ ok: true, data: { message: "First done" } });
      await Promise.resolve();
    });

    expect(result.current.isSending).toBe(true);

    await act(async () => {
      resolvers[1]?.({ ok: true, data: { message: "Second done" } });
      await Promise.resolve();
    });

    expect(result.current.isSending).toBe(false);
    expect(sendAgentTurn).toHaveBeenCalledTimes(2);
  });

  it("keeps built-in pulse context in kickoff requests when instructions are empty client-side", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Pulse activated." }),
    } as Response);
    const { result } = renderHook(() =>
      useCreateAgentStateTestHarness({ enabled: true, runtimeMode: "pulse" })
    );

    await act(async () => {
      await result.current.send({
        text: "",
        payloadText: "pulse_activation_seed:story_builder",
        skipUserEcho: true,
        context: {
          pulse: {
            presetId: "story_builder",
            label: "Story Builder",
            instructions: "",
            pulseKind: "guided_workflow",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            outputMode: "chat_reply",
            source: "builtin",
          },
        },
      });
    });

    const requestInit = fetchWithAuthMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(requestInit?.body ?? "{}")) as {
      context?: { pulse?: Record<string, unknown> };
    };
    expect(body.context?.pulse).toEqual({
      presetId: "story_builder",
      label: "Story Builder",
      description: null,
      pulseKind: "guided_workflow",
      runtimeMode: "workflow_gpt",
      activationMode: "activate_and_start",
      starterAssistantMessage: null,
      workflowSession: null,
      workflowStageHints: null,
      outputMode: "chat_reply",
      memoryPolicy: "session",
      source: "builtin",
    });
  });

  it("preserves pulse context when input precheck rewrites the request context without pulse metadata", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Pulse activated." }),
    } as Response);
    vi.spyOn(safetyInputPrecheckModule, "runStudioAgentSafetyInputPrecheck").mockImplementation(
      ({ messages, canonicalPrompt }) => ({
        outcome: "pass",
        messages,
        context: { activePrompt: "rewritten safe prompt" },
        canonicalPrompt,
        rewrittenFieldCount: 1,
        providerCallSkipped: false,
        scopeTelemetry: {
          refusalField: null,
          rewrittenFields: ["active_prompt"],
          nonBlockingSignalCount: 1,
          fieldModes: {
            latest_user_turn: "enforce",
            history_user_turn: "rewrite_only",
            active_prompt: "rewrite_only",
            last_assistant_message: "rewrite_only",
            reference_prompt_snippet: "rewrite_only",
            reference_caption: "rewrite_only",
            canonical_prompt: "enforce",
          },
        },
      })
    );
    const { result } = renderHook(() =>
      useCreateAgentStateTestHarness({ enabled: true, runtimeMode: "pulse" })
    );

    await act(async () => {
      await result.current.send({
        text: "",
        payloadText: "pulse_activation_seed:image",
        skipUserEcho: true,
        context: {
          pulse: {
            presetId: "image",
            label: "Video Prompt Magic",
            instructions: "",
            pulseKind: "guided_workflow",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            outputMode: "chat_reply",
            source: "builtin",
          },
          activePrompt: "describe this image",
        },
      });
    });

    const requestInit = fetchWithAuthMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(requestInit?.body ?? "{}")) as {
      context?: { pulse?: Record<string, unknown>; activePrompt?: string };
    };
    expect(body.context?.activePrompt).toBe("rewritten safe prompt");
    expect(body.context?.pulse).toEqual(
      expect.objectContaining({
        presetId: "image",
        label: "Video Prompt Magic",
        pulseKind: "guided_workflow",
        runtimeMode: "workflow_gpt",
        activationMode: "activate_and_start",
        outputMode: "chat_reply",
        source: "builtin",
      })
    );
  });

  it("keeps a pulse activation reply when the hook namespace switches to the override before the response resolves", async () => {
    let resolveFetch: ((value: Response | PromiseLike<Response>) => void) | null = null;
    fetchWithAuthMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { result, rerender } = renderHook(
      ({ sessionNamespace }: { sessionNamespace: string }) =>
        useCreateAgentStateTestHarness({ enabled: true, sessionNamespace, runtimeMode: "pulse" }),
      {
        initialProps: {
          sessionNamespace: "ai-studio:seed:none::pulse:none",
        },
      }
    );

    let sendResultPromise!: Promise<SendResult>;
    await act(async () => {
      sendResultPromise = result.current.send({
        text: "",
        payloadText: "pulse_activation_seed:story_builder",
        sessionNamespaceOverride: "ai-studio:seed:none::pulse:story_builder",
        skipUserEcho: true,
        context: {
          pulse: {
            presetId: "story_builder",
            label: "Story Builder",
            instructions: "Guide the user through story setup.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage: "Upload your characters first.",
            workflowStageHints: ["Upload Characters"],
            outputMode: "chat_reply",
            memoryPolicy: "session",
            source: "builtin",
          },
        },
      });
    });

    await act(async () => {
      rerender({ sessionNamespace: "ai-studio:seed:none::pulse:story_builder" });
    });

    await act(async () => {
      resolveFetch?.({
        ok: true,
        json: async () => ({ message: "Pulse activated." }),
      } as Response);
      await sendResultPromise;
    });

    const sendResult = await sendResultPromise;
    expect(sendResult.discarded).not.toBe(true);
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "Pulse activated.",
      })
    );
  });

  it("keeps a pulse activation reply when the override response resolves before the namespace rerender", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Pulse activated." }),
    } as Response);

    const { result, rerender } = renderHook(
      ({ sessionNamespace }: { sessionNamespace: string }) =>
        useCreateAgentStateTestHarness({ enabled: true, sessionNamespace, runtimeMode: "pulse" }),
      {
        initialProps: {
          sessionNamespace: "ai-studio:seed:none::pulse:none",
        },
      }
    );

    act(() => {
      result.current.appendUserMessage("Previous Pulse transcript");
    });
    expect(result.current.messages).toHaveLength(1);

    let sendResult!: SendResult;
    await act(async () => {
      sendResult = await result.current.send({
        text: "",
        payloadText: "pulse_activation_seed:custom",
        sessionNamespaceOverride: "ai-studio:seed:none::pulse:custom",
        isolateHistory: true,
        skipUserEcho: true,
        context: {
          pulse: {
            presetId: "custom",
            label: "Custom Pulse",
            instructions: "Ask one focused setup question before generating.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage: null,
            workflowStageHints: null,
            outputMode: "chat_reply",
            memoryPolicy: "session",
            source: "custom",
          },
        },
      });
    });

    expect(sendResult.discarded).not.toBe(true);
    expect(result.current.messages).toEqual([
      expect.objectContaining({
        role: "assistant",
        content: "Pulse activated.",
      }),
    ]);

    await act(async () => {
      rerender({ sessionNamespace: "ai-studio:seed:none::pulse:custom" });
    });

    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "Pulse activated.",
      })
    );
  });

  it("restores the previous Pulse session identity after an override kickoff fails", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "upstream failed" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Recovered existing Pulse." }),
      } as Response);

    const { result } = renderHook(() =>
      useCreateAgentStateTestHarness({
        enabled: true,
        runtimeMode: "pulse",
        sessionNamespace: "ai-studio:seed:none::pulse:image",
      })
    );

    let failedKickoff!: SendResult;
    await act(async () => {
      failedKickoff = await result.current.send({
        text: "",
        payloadText: "pulse_activation_seed:story_builder",
        sessionNamespaceOverride: "ai-studio:seed:none::pulse:story_builder",
        isolateHistory: true,
        skipUserEcho: true,
        context: {
          pulse: {
            presetId: "story_builder",
            label: "Story Builder",
            instructions: "Guide the user through story setup.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage: "Upload your characters first.",
            workflowStageHints: ["Upload Characters"],
            outputMode: "chat_reply",
            memoryPolicy: "session",
            source: "builtin",
          },
        },
      });
    });

    expect(failedKickoff).toEqual(
      expect.objectContaining({
        response: null,
        failureKind: "transport_error",
      })
    );

    let recoveredSend!: SendResult;
    await act(async () => {
      recoveredSend = await result.current.send({
        text: "continue existing pulse",
        payloadText: "continue existing pulse",
        context: {
          pulse: {
            presetId: "image",
            label: "Video Prompt Magic",
            instructions: "Guide the user through a single-shot workflow.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage: "Upload your image to get the process started :)",
            workflowStageHints: ["Image Gate"],
            outputMode: "chat_reply",
            memoryPolicy: "session",
            source: "builtin",
          },
        },
      });
    });

    expect(recoveredSend.discarded).not.toBe(true);
    const recoveredBody = JSON.parse(
      String(fetchWithAuthMock.mock.calls[1]?.[1]?.body ?? "{}")
    ) as { clientSessionNamespace?: string };
    expect(recoveredBody.clientSessionNamespace).toBe("ai-studio:seed:none::pulse:image");
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "Recovered existing Pulse.",
      })
    );
  });

  it("restores the previous Pulse transcript and session identity after a client-side kickoff refusal", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Recovered existing Pulse." }),
    } as Response);

    const { result } = renderHook(() =>
      useCreateAgentStateTestHarness({
        enabled: true,
        runtimeMode: "pulse",
        sessionNamespace: "ai-studio:seed:none::pulse:image",
      })
    );

    act(() => {
      result.current.appendUserMessage("Previous Pulse transcript");
    });
    expect(result.current.messages).toHaveLength(1);

    let refusalResult!: SendResult;
    await act(async () => {
      refusalResult = await result.current.send({
        text: "graphic sexual intercourse with explicit anatomy",
        payloadText: "graphic sexual intercourse with explicit anatomy",
        sessionNamespaceOverride: "ai-studio:seed:none::pulse:story_builder",
        isolateHistory: true,
        skipUserEcho: true,
        context: {
          pulse: {
            presetId: "story_builder",
            label: "Story Builder",
            instructions: "Guide the user through story setup.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage: "Upload your characters first.",
            workflowStageHints: ["Upload Characters"],
            outputMode: "chat_reply",
            memoryPolicy: "session",
            source: "builtin",
          },
        },
      });
    });

    expect(refusalResult.response).toEqual(
      expect.objectContaining({
        message: "I cannot describe this.",
      })
    );
    expect(fetchWithAuthMock).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([
      expect.objectContaining({
        role: "user",
        content: "Previous Pulse transcript",
      }),
      expect.objectContaining({
        role: "assistant",
        content: "I cannot describe this.",
      }),
    ]);

    let recoveredSend!: SendResult;
    await act(async () => {
      recoveredSend = await result.current.send({
        text: "continue existing pulse",
        payloadText: "continue existing pulse",
        context: {
          pulse: {
            presetId: "image",
            label: "Video Prompt Magic",
            instructions: "Guide the user through a single-shot workflow.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage: "Upload your image to get the process started :)",
            workflowStageHints: ["Image Gate"],
            outputMode: "chat_reply",
            memoryPolicy: "session",
            source: "builtin",
          },
        },
      });
    });

    expect(recoveredSend.discarded).not.toBe(true);
    const recoveredBody = JSON.parse(
      String(fetchWithAuthMock.mock.calls[0]?.[1]?.body ?? "{}")
    ) as { clientSessionNamespace?: string };
    expect(recoveredBody.clientSessionNamespace).toBe("ai-studio:seed:none::pulse:image");
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "Recovered existing Pulse.",
      })
    );
  });

  it("restores the previous Pulse transcript and session identity after an assistant-visible kickoff refusal", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "I cannot describe this.",
            decision: "refuse",
            outcome_class: "refusal_safety",
            reason_code: "SAFETY_INPUT_REFUSAL",
            retryable: false,
          }),
          {
            status: 422,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Recovered existing Pulse." }),
      } as Response);

    const { result } = renderHook(() =>
      useCreateAgentStateTestHarness({
        enabled: true,
        runtimeMode: "pulse",
        sessionNamespace: "ai-studio:seed:none::pulse:image",
      })
    );

    act(() => {
      result.current.appendUserMessage("Previous Pulse transcript");
    });
    expect(result.current.messages).toHaveLength(1);

    let refusalResult!: SendResult;
    await act(async () => {
      refusalResult = await result.current.send({
        text: "",
        payloadText: "pulse_activation_seed:story_builder",
        sessionNamespaceOverride: "ai-studio:seed:none::pulse:story_builder",
        isolateHistory: true,
        skipUserEcho: true,
        context: {
          pulse: {
            presetId: "story_builder",
            label: "Story Builder",
            instructions: "Guide the user through story setup.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage: "Upload your characters first.",
            workflowStageHints: ["Upload Characters"],
            outputMode: "chat_reply",
            memoryPolicy: "session",
            source: "builtin",
          },
        },
      });
    });

    expect(refusalResult.response).toEqual(
      expect.objectContaining({
        message: "I cannot describe this.",
        outcome_class: "refusal_safety",
      })
    );
    expect(result.current.messages).toEqual([
      expect.objectContaining({
        role: "user",
        content: "Previous Pulse transcript",
      }),
      expect.objectContaining({
        role: "assistant",
        content: "I cannot describe this.",
      }),
    ]);

    let recoveredSend!: SendResult;
    await act(async () => {
      recoveredSend = await result.current.send({
        text: "continue existing pulse",
        payloadText: "continue existing pulse",
        context: {
          pulse: {
            presetId: "image",
            label: "Video Prompt Magic",
            instructions: "Guide the user through a single-shot workflow.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage: "Upload your image to get the process started :)",
            workflowStageHints: ["Image Gate"],
            outputMode: "chat_reply",
            memoryPolicy: "session",
            source: "builtin",
          },
        },
      });
    });

    expect(recoveredSend.discarded).not.toBe(true);
    const recoveredBody = JSON.parse(
      String(fetchWithAuthMock.mock.calls[1]?.[1]?.body ?? "{}")
    ) as { clientSessionNamespace?: string };
    expect(recoveredBody.clientSessionNamespace).toBe("ai-studio:seed:none::pulse:image");
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "Recovered existing Pulse.",
      })
    );
  });

  it("refuses explicit input in client precheck without transport call", async () => {
    const { result } = renderHook(() =>
      useCreateAgentStateTestHarness({ enabled: true, runtimeMode: "pulse" })
    );

    await act(async () => {
      await result.current.send({
        text: "graphic sexual intercourse with explicit anatomy",
        payloadText: "graphic sexual intercourse with explicit anatomy",
      });
    });

    expect(fetchWithAuthMock).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "I cannot describe this.",
        canUseAsPrompt: false,
      })
    );
  });

  it("sends Standard input through without local rewrite", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "safe rewrite pass" }),
    } as Response);
    const { result } = renderHook(() => useCreateAgentStateTestHarness({ enabled: true }));

    await act(async () => {
      await result.current.send({
        text: "a sexy topless model in lingerie",
        payloadText: "a sexy topless model in lingerie",
      });
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    const requestInit = fetchWithAuthMock.mock.calls[0]?.[1];
    const bodyText = String(requestInit?.body ?? "");
    expect(bodyText.toLowerCase()).toContain("topless");
    expect(bodyText.toLowerCase()).toContain("lingerie");
  });

  it("skips client precheck when disabled and sends original payload", async () => {
    process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED = "false";
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "ok" }),
    } as Response);
    const { result } = renderHook(() => useCreateAgentStateTestHarness({ enabled: true }));

    await act(async () => {
      await result.current.send({
        text: "a sexy topless model in lingerie",
        payloadText: "a sexy topless model in lingerie",
      });
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    const requestInit = fetchWithAuthMock.mock.calls[0]?.[1];
    const bodyText = String(requestInit?.body ?? "");
    expect(bodyText.toLowerCase()).toContain("topless");
    expect(bodyText.toLowerCase()).toContain("lingerie");
  });

  it("sends Standard requests to the Standard route", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "ok" }),
    } as Response);
    const { result } = renderHook(() => useCreateAgentStateTestHarness({ enabled: true }));

    await act(async () => {
      await result.current.send({
        text: "hello standard model",
        payloadText: "hello standard model",
      });
    });

    const requestInit = fetchWithAuthMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(requestInit?.body ?? "{}")) as {
      runtimeMode?: string;
    };
    expect(body.runtimeMode).toBe("standard");
    expect(fetchWithAuthMock.mock.calls[0]?.[0]).toBe("/api/ai/studio-agent-standard");
  });

  it("includes pulse runtimeMode when configured for Pulse mode", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "ok" }),
    } as Response);
    const { result } = renderHook(() =>
      useCreateAgentStateTestHarness({ enabled: true, runtimeMode: "pulse" })
    );

    await act(async () => {
      await result.current.send({
        text: "continue pulse",
        payloadText: "continue pulse",
      });
    });

    const requestInit = fetchWithAuthMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(requestInit?.body ?? "{}")) as {
      runtimeMode?: string;
    };
    expect(body.runtimeMode).toBe("pulse");
    expect(fetchWithAuthMock.mock.calls[0]?.[0]).toBe("/api/ai/studio-agent-pulse");
  });

  it("preserves exact completed chat_reply artifacts for draggable Pulse output", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: "final artifact in 16:9",
        workflowSession: {
          presetId: "story_builder",
          status: "completed",
          currentStepIndex: 6,
          currentStepLabel: "Image Prompts",
          currentStepPrompt: null,
          collectedInputs: ["grimdark"],
          lastArtifact: "final artifact in 16:9",
          finalArtifactSource: "chat_reply",
        },
      }),
    } as Response);
    const { result } = renderHook(() =>
      useCreateAgentStateTestHarness({ enabled: true, runtimeMode: "pulse" })
    );

    let sendResult: Awaited<ReturnType<typeof result.current.send>> | undefined;
    await act(async () => {
      sendResult = await result.current.send({
        text: "finalize",
        payloadText: "finalize",
      });
    });

    expect(sendResult?.workflowSession).toEqual({
      presetId: "story_builder",
      status: "completed",
      currentStepIndex: 6,
      currentStepLabel: "Image Prompts",
      currentStepPrompt: null,
      collectedInputs: ["grimdark"],
      lastArtifact: "final artifact in 16:9",
      finalArtifactSource: "chat_reply",
    });
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "final artifact in 16:9",
        outputPrompt: "final artifact in 16:9",
        canUseAsPrompt: true,
      })
    );
  });

  it("uses the runtime-owned request history resolver without changing visible transcript state", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "ok" }),
    } as Response);
    const initialMessages = [
      { id: "assistant-1", role: "assistant" as const, content: "Older assistant context" },
      { id: "user-1", role: "user" as const, content: "Latest user context" },
    ];
    const { result } = renderHook(() =>
      useCreateAgentStateTestHarness({
        enabled: true,
        runtimeMode: "standard",
        initialMessages,
        resolveRequestHistory: (messages) => messages.slice(-1),
      })
    );

    await act(async () => {
      await result.current.send({
        text: "current turn",
        payloadText: "current turn",
      });
    });

    const requestInit = fetchWithAuthMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(requestInit?.body ?? "{}")) as {
      messages?: Array<{ role: string; content: string }>;
    };
    expect(body.messages).toEqual([
      { role: "user", content: "Latest user context" },
      { role: "user", content: "current turn" },
    ]);
    expect(result.current.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: "Older assistant context",
        }),
      ])
    );
  });

  it("reuses stored clientSessionKey across hook remounts and rotates on reset", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "ok" }),
    } as Response);

    const { result, unmount } = renderHook(() =>
      useCreateAgentStateTestHarness({ enabled: true, sessionNamespace: "ai-studio:test" })
    );

    await act(async () => {
      await result.current.send({
        text: "first",
        payloadText: "first",
      });
    });

    const firstBody = JSON.parse(String(fetchWithAuthMock.mock.calls[0]?.[1]?.body ?? "{}")) as {
      clientSessionKey?: string;
    };
    expect(typeof firstBody.clientSessionKey).toBe("string");
    const firstKey = firstBody.clientSessionKey as string;

    unmount();

    const remounted = renderHook(() =>
      useCreateAgentStateTestHarness({ enabled: true, sessionNamespace: "ai-studio:test" })
    );
    await act(async () => {
      await remounted.result.current.send({
        text: "second",
        payloadText: "second",
      });
    });

    const secondBody = JSON.parse(String(fetchWithAuthMock.mock.calls[1]?.[1]?.body ?? "{}")) as {
      clientSessionKey?: string;
    };
    expect(secondBody.clientSessionKey).toBe(firstKey);

    act(() => {
      remounted.result.current.reset();
    });

    await act(async () => {
      await remounted.result.current.send({
        text: "third",
        payloadText: "third",
      });
    });

    const thirdBody = JSON.parse(String(fetchWithAuthMock.mock.calls[2]?.[1]?.body ?? "{}")) as {
      clientSessionKey?: string;
    };
    expect(thirdBody.clientSessionKey).not.toBe(firstKey);
  });

  it("switches clientSessionKey by sessionNamespace and restores prior namespace key", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "ok" }),
    } as Response);

    const hook = renderHook(
      ({ namespace }) =>
        useCreateAgentStateTestHarness({ enabled: true, sessionNamespace: namespace }),
      { initialProps: { namespace: "ai-studio:tool-a" } }
    );

    await act(async () => {
      await hook.result.current.send({ text: "a1", payloadText: "a1" });
    });
    const bodyA1 = JSON.parse(String(fetchWithAuthMock.mock.calls[0]?.[1]?.body ?? "{}")) as {
      clientSessionKey?: string;
    };
    const keyA = bodyA1.clientSessionKey;
    expect(typeof keyA).toBe("string");

    hook.rerender({ namespace: "ai-studio:tool-b" });
    await act(async () => {
      await hook.result.current.send({ text: "b1", payloadText: "b1" });
    });
    const bodyB1 = JSON.parse(String(fetchWithAuthMock.mock.calls[1]?.[1]?.body ?? "{}")) as {
      clientSessionKey?: string;
    };
    const keyB = bodyB1.clientSessionKey;
    expect(typeof keyB).toBe("string");
    expect(keyB).not.toBe(keyA);

    hook.rerender({ namespace: "ai-studio:tool-a" });
    await act(async () => {
      await hook.result.current.send({ text: "a2", payloadText: "a2" });
    });
    const bodyA2 = JSON.parse(String(fetchWithAuthMock.mock.calls[2]?.[1]?.body ?? "{}")) as {
      clientSessionKey?: string;
    };
    expect(bodyA2.clientSessionKey).toBe(keyA);
  });

  it("clears in-memory history and canonical prompt when sessionNamespace changes", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: "old assistant output",
          canonicalPrompt: "old canonical prompt",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "new assistant output" }),
      } as Response);

    const hook = renderHook(
      ({ namespace }) =>
        useCreateAgentStateTestHarness({ enabled: true, sessionNamespace: namespace }),
      { initialProps: { namespace: "ai-studio:session-a:create:text" } }
    );

    await act(async () => {
      await hook.result.current.send({
        text: "first turn",
        payloadText: "first turn",
      });
    });

    expect(hook.result.current.messages.length).toBeGreaterThan(0);

    hook.rerender({ namespace: "ai-studio:session-b:create:text" });
    await waitFor(() => {
      expect(hook.result.current.messages).toEqual([]);
    });

    await act(async () => {
      await hook.result.current.send({
        text: "second turn",
        payloadText: "second turn",
      });
    });

    const secondBody = JSON.parse(String(fetchWithAuthMock.mock.calls[1]?.[1]?.body ?? "{}")) as {
      messages?: Array<{ role: string; content: string }>;
      canonicalPrompt?: string | null;
    };
    expect(secondBody.messages).toEqual([{ role: "user", content: "second turn" }]);
    expect(secondBody.canonicalPrompt ?? null).toBeNull();
  });

  it("ignores canonicalPrompt returned by Standard responses on later Standard turns", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: "first standard reply",
          canonicalPrompt: "hidden standard canonical prompt",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: "second standard reply",
        }),
      } as Response);

    const hook = renderHook(() =>
      useCreateAgentStateTestHarness({
        enabled: true,
        sessionNamespace: "ai-studio:session-standard-1::standard",
      })
    );

    await act(async () => {
      await hook.result.current.send({
        text: "first turn",
        payloadText: "first turn",
      });
    });

    await act(async () => {
      await hook.result.current.send({
        text: "second turn",
        payloadText: "second turn",
      });
    });

    const secondBody = JSON.parse(String(fetchWithAuthMock.mock.calls[1]?.[1]?.body ?? "{}")) as {
      messages?: Array<{ role: string; content: string }>;
      canonicalPrompt?: string | null;
    };
    expect(secondBody.canonicalPrompt ?? null).toBeNull();
    expect(secondBody.messages).toEqual([
      { role: "user", content: "first turn" },
      { role: "assistant", content: "first standard reply" },
      { role: "user", content: "second turn" },
    ]);
  });

  it("carries hidden Standard conversation state across later Standard turns", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: "first standard reply",
          conversationState: {
            previousResponseId: "resp_standard_1",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: "second standard reply",
        }),
      } as Response);

    const hook = renderHook(() =>
      useCreateAgentStateTestHarness({
        enabled: true,
        sessionNamespace: "ai-studio:session-standard-state::standard",
      })
    );

    await act(async () => {
      await hook.result.current.send({
        text: "first turn",
        payloadText: "first turn",
      });
    });

    await act(async () => {
      await hook.result.current.send({
        text: "second turn",
        payloadText: "second turn",
      });
    });

    const firstBody = JSON.parse(String(fetchWithAuthMock.mock.calls[0]?.[1]?.body ?? "{}")) as {
      conversationState?: { previousResponseId?: string | null } | null;
    };
    const secondBody = JSON.parse(String(fetchWithAuthMock.mock.calls[1]?.[1]?.body ?? "{}")) as {
      conversationState?: { previousResponseId?: string | null } | null;
    };

    expect(firstBody.conversationState ?? null).toBeNull();
    expect(secondBody.conversationState).toEqual({
      previousResponseId: "resp_standard_1",
    });
  });

  it("clears hidden Standard conversation state when a later Standard response omits it", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: "first standard reply",
          conversationState: {
            previousResponseId: "resp_standard_1",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: "second standard reply",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: "third standard reply",
        }),
      } as Response);

    const hook = renderHook(() =>
      useCreateAgentStateTestHarness({
        enabled: true,
        sessionNamespace: "ai-studio:session-standard-state-clear::standard",
      })
    );

    await act(async () => {
      await hook.result.current.send({
        text: "first turn",
        payloadText: "first turn",
      });
    });
    await act(async () => {
      await hook.result.current.send({
        text: "second turn",
        payloadText: "second turn",
      });
    });
    await act(async () => {
      await hook.result.current.send({
        text: "third turn",
        payloadText: "third turn",
      });
    });

    const thirdBody = JSON.parse(String(fetchWithAuthMock.mock.calls[2]?.[1]?.body ?? "{}")) as {
      conversationState?: { previousResponseId?: string | null } | null;
    };

    expect(thirdBody.conversationState ?? null).toBeNull();
  });

  it("keeps Standard override sends blocked from Pulse bootstrap namespaces", async () => {
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: "standard reply",
        canonicalPrompt: "standard canonical prompt",
      }),
    } as Response);

    const hook = renderHook(() =>
      useCreateAgentStateTestHarness({
        enabled: true,
        sessionNamespace: "ai-studio:session-a::standard",
      })
    );

    await act(async () => {
      await hook.result.current.send({
        text: "standard turn",
        payloadText: "standard turn",
      });
    });

    let pulseSendResult: SendResult | null = null;
    await act(async () => {
      pulseSendResult = await hook.result.current.send({
        text: "",
        payloadText: "pulse_activation_seed:story_builder",
        sessionNamespaceOverride: "ai-studio:session-a::pulse:story_builder",
        isolateHistory: true,
        skipUserEcho: true,
        context: {
          pulse: {
            presetId: "story_builder",
            label: "Story Builder",
            instructions: "Guide the user through story setup.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage: "Upload your characters first.",
            workflowStageHints: ["Upload Characters"],
            outputMode: "chat_reply",
            memoryPolicy: "session",
            source: "builtin",
          },
        },
      });
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    expect(pulseSendResult).toEqual(
      expect.objectContaining({
        response: null,
        failureKind: "transport_error",
      })
    );
    expect(hook.result.current.error).toContain("Standard agent cannot send");
  });

  it("isolates canonical prompt continuity across separate Standard and Pulse hooks", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: "standard reply",
          canonicalPrompt: "standard canonical prompt",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "pulse activated" }),
      } as Response);

    const standardHook = renderHook(() =>
      useCreateAgentStateTestHarness({
        enabled: true,
        sessionNamespace: "ai-studio:session-a::standard",
      })
    );

    await act(async () => {
      await standardHook.result.current.send({
        text: "standard turn",
        payloadText: "standard turn",
      });
    });

    const pulseHook = renderHook(() =>
      useCreateAgentStateTestHarness({
        enabled: true,
        sessionNamespace: "ai-studio:session-a::pulse:story_builder",
        runtimeMode: "pulse",
      })
    );

    await act(async () => {
      await pulseHook.result.current.send({
        text: "",
        payloadText: "pulse_activation_seed:story_builder",
        isolateHistory: true,
        skipUserEcho: true,
        context: {
          pulse: {
            presetId: "story_builder",
            label: "Story Builder",
            instructions: "Guide the user through story setup.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage: "Upload your characters first.",
            workflowStageHints: ["Upload Characters"],
            outputMode: "chat_reply",
            memoryPolicy: "session",
            source: "builtin",
          },
        },
      });
    });

    const pulseBody = JSON.parse(String(fetchWithAuthMock.mock.calls[1]?.[1]?.body ?? "{}")) as {
      messages?: Array<{ role: string; content: string }>;
      canonicalPrompt?: string | null;
    };
    expect(pulseBody.messages).toEqual([
      { role: "user", content: "pulse_activation_seed:story_builder" },
    ]);
    expect(pulseBody.canonicalPrompt ?? null).toBeNull();
  });

  it("discards a late response after the session namespace changes", async () => {
    let resolveFirstResponse: ((value: Response) => void) | null = null;
    fetchWithAuthMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFirstResponse = resolve;
        })
    );

    const hook = renderHook(
      ({ namespace }) =>
        useCreateAgentStateTestHarness({ enabled: true, sessionNamespace: namespace }),
      { initialProps: { namespace: "ai-studio:session-a:create:pulse-a" } }
    );

    let firstSendPromise: ReturnType<typeof hook.result.current.send>;
    await act(async () => {
      firstSendPromise = hook.result.current.send({
        text: "pulse a question",
        payloadText: "pulse a question",
      });
    });

    await act(async () => {
      hook.rerender({ namespace: "ai-studio:session-a:create:pulse-b" });
    });
    await waitFor(() => {
      expect(hook.result.current.messages).toEqual([]);
    });

    await act(async () => {
      resolveFirstResponse?.({
        ok: true,
        json: async () => ({ message: "late pulse a reply" }),
      } as Response);
    });

    const firstSendResult = await firstSendPromise!;

    expect(firstSendResult).toEqual(
      expect.objectContaining({
        response: null,
        discarded: true,
      })
    );
    expect(hook.result.current.messages).toEqual([]);
    expect(hook.result.current.error).toBeNull();
  });

  it("treats refusal payloads as assistant responses without setting error", async () => {
    fetchWithAuthMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "I cannot describe this." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );
    const { result } = renderHook(() => useCreateAgentStateTestHarness({ enabled: true }));

    await act(async () => {
      await result.current.send({
        text: "describe this image",
        payloadText: "describe this image",
      });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "I cannot describe this.",
        canUseAsPrompt: false,
      })
    );
  });

  it("keeps Standard message-only successes as plain assistant chat replies", async () => {
    fetchWithAuthMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "Hello. How can I help?",
          actions: undefined,
          outcome_class: "success_message",
          reason_code: "SUCCESS_MESSAGE",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    const { result } = renderHook(() =>
      useCreateAgentStateTestHarness({ enabled: true, runtimeMode: "standard" })
    );

    await act(async () => {
      await result.current.send({
        text: "hello",
        payloadText: "hello",
      });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "Hello. How can I help?",
        outputPrompt: null,
        canUseAsPrompt: false,
        outcomeClass: "success_message",
      })
    );
  });

  it("keeps Standard assistant chat replies in outbound history", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "Hello. How can I help?",
            actions: undefined,
            outcome_class: "success_message",
            reason_code: "SUCCESS_MESSAGE",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "Following up on your question.",
            actions: undefined,
            outcome_class: "success_message",
            reason_code: "SUCCESS_MESSAGE",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );
    const { result } = renderHook(() =>
      useCreateAgentStateTestHarness({ enabled: true, runtimeMode: "standard" })
    );

    await act(async () => {
      await result.current.send({
        text: "hello",
        payloadText: "hello",
      });
    });

    await act(async () => {
      await result.current.send({
        text: "follow up",
        payloadText: "follow up",
      });
    });

    const secondBody = JSON.parse(String(fetchWithAuthMock.mock.calls[1]?.[1]?.body ?? "{}")) as {
      messages?: Array<{ role: string; content: string }>;
    };
    expect(secondBody.messages).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "Hello. How can I help?" },
      { role: "user", content: "follow up" },
    ]);
  });

  it("keeps Pulse assistant workflow/chat replies in outbound history", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "Step 2 - Share a plot seed.",
            workflowSession: {
              presetId: "story_builder",
              status: "awaiting_input",
              currentStepIndex: 2,
              currentStepLabel: "Plot Seed",
              currentStepPrompt: "Step 2 - Share a plot seed.",
              collectedInputs: [],
              lastArtifact: null,
              finalArtifactSource: null,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "Step 3 - How long should it be?",
            workflowSession: {
              presetId: "story_builder",
              status: "awaiting_input",
              currentStepIndex: 3,
              currentStepLabel: "Runtime",
              currentStepPrompt: "Step 3 - How long should it be?",
              collectedInputs: ["A knight enters a cursed forest."],
              lastArtifact: null,
              finalArtifactSource: null,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );
    const { result } = renderHook(() =>
      useCreateAgentStateTestHarness({ enabled: true, runtimeMode: "pulse" })
    );

    await act(async () => {
      await result.current.send({
        text: "start pulse",
        payloadText: "start pulse",
      });
    });

    await act(async () => {
      await result.current.send({
        text: "A knight enters a cursed forest.",
        payloadText: "A knight enters a cursed forest.",
      });
    });

    const secondBody = JSON.parse(String(fetchWithAuthMock.mock.calls[1]?.[1]?.body ?? "{}")) as {
      messages?: Array<{ role: string; content: string }>;
    };
    expect(secondBody.messages).toEqual([
      { role: "user", content: "start pulse" },
      { role: "assistant", content: "Step 2 - Share a plot seed." },
      { role: "user", content: "A knight enters a cursed forest." },
    ]);
  });

  it("keeps custom Pulse startup replies in outbound history for follow-up turns", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message:
              "Tell me about your storyboard.\n1. What is the story about?\n2. Who or what is the main subject?",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "What aspect ratio and how many scenes do you want?",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );
    const { result } = renderHook(() =>
      useCreateAgentStateTestHarness({ enabled: true, runtimeMode: "pulse" })
    );

    await act(async () => {
      await result.current.send({
        text: "start custom pulse",
        payloadText: "start custom pulse",
      });
    });

    await act(async () => {
      await result.current.send({
        text: "bugs dark bugs",
        payloadText: "bugs dark bugs",
      });
    });

    const secondBody = JSON.parse(String(fetchWithAuthMock.mock.calls[1]?.[1]?.body ?? "{}")) as {
      messages?: Array<{ role: string; content: string }>;
    };
    expect(secondBody.messages).toEqual([
      { role: "user", content: "start custom pulse" },
      {
        role: "assistant",
        content:
          "Tell me about your storyboard.\n1. What is the story about?\n2. Who or what is the main subject?",
      },
      { role: "user", content: "bugs dark bugs" },
    ]);
  });

  it("preserves Pulse chat replies that look like prompt metadata", async () => {
    fetchWithAuthMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message:
            "This prompt now includes a sharper product angle. What product should anchor the first shot?",
          actions: undefined,
          workflowSession: {
            presetId: "pulse_custom",
            status: "awaiting_input",
            currentStepIndex: 1,
            currentStepLabel: null,
            currentStepPrompt:
              "This prompt now includes a sharper product angle. What product should anchor the first shot?",
            collectedInputs: [],
            lastArtifact: null,
            finalArtifactSource: null,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    const { result } = renderHook(() =>
      useCreateAgentStateTestHarness({ enabled: true, runtimeMode: "pulse" })
    );

    await act(async () => {
      await result.current.send({
        text: "",
        payloadText: 'Pulse "Custom Pulse" was just activated.\n\nStart the workflow now.',
        skipUserEcho: true,
      });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content:
          "This prompt now includes a sharper product angle. What product should anchor the first shot?",
        canUseAsPrompt: false,
      })
    );
  });

  it("keeps Standard prompt successes usable as output prompts", async () => {
    fetchWithAuthMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "Cinematic portrait of a woman in golden-hour forest light.",
          actions: {
            applyPrompt: "Cinematic portrait of a woman in golden-hour forest light.",
          },
          outcome_class: "success_prompt",
          reason_code: "SUCCESS_PROMPT",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    const { result } = renderHook(() =>
      useCreateAgentStateTestHarness({ enabled: true, runtimeMode: "standard" })
    );

    await act(async () => {
      await result.current.send({
        text: "make a portrait prompt",
        payloadText: "make a portrait prompt",
      });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "Cinematic portrait of a woman in golden-hour forest light.",
        outputPrompt: "Cinematic portrait of a woman in golden-hour forest light.",
        canUseAsPrompt: true,
        outcomeClass: "success_prompt",
      })
    );
  });

  it("keeps legacy Standard prompt replies usable when outcome_class is omitted", async () => {
    fetchWithAuthMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "Cinematic portrait of a woman in golden-hour forest light.",
          actions: {
            applyPrompt: "Cinematic portrait of a woman in golden-hour forest light.",
          },
          reason_code: "SUCCESS_PROMPT",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    const { result } = renderHook(() =>
      useCreateAgentStateTestHarness({ enabled: true, runtimeMode: "standard" })
    );

    await act(async () => {
      await result.current.send({
        text: "make a portrait prompt",
        payloadText: "make a portrait prompt",
      });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "Cinematic portrait of a woman in golden-hour forest light.",
        outputPrompt: "Cinematic portrait of a woman in golden-hour forest light.",
        canUseAsPrompt: true,
        reasonCode: "SUCCESS_PROMPT",
      })
    );
  });

  it("prefers the explicit Standard reply and prompt artifact contract when present", async () => {
    const sendAgentTurn = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        message: "legacy compatibility message",
        actions: {
          applyPrompt: "legacy compatibility prompt",
        },
        outcome_class: "success_prompt",
        reason_code: "SUCCESS_PROMPT",
      },
    });
    const resolveTransportSuccess = vi.fn(() => ({
      actions: {
        applyPrompt: "legacy compatibility prompt",
      },
      workflowSession: null,
      canonicalPrompt: null,
      assistantReply: {
        text: "Preferred Standard reply",
      },
      promptArtifact: {
        text: "Preferred Standard prompt artifact",
      },
      assistantContent: "legacy compatibility message",
      assistantOutputPrompt: "legacy compatibility prompt",
    }));
    const { result } = renderHook(() =>
      useCreateAgentStateTestHarness({
        enabled: true,
        runtimeMode: "standard",
        sendAgentTurn,
        resolveTransportSuccess,
      })
    );

    await act(async () => {
      await result.current.send({
        text: "make a portrait prompt",
        payloadText: "make a portrait prompt",
      });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "Preferred Standard reply",
        outputPrompt: "Preferred Standard prompt artifact",
        canUseAsPrompt: true,
        outcomeClass: "success_prompt",
      })
    );
  });

  it("prioritizes machine refusal fields over legacy string heuristics", async () => {
    fetchWithAuthMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "blocked by policy profile",
          decision: "refuse",
          outcome_class: "refusal_safety",
          reason_code: "SAFETY_INPUT_REFUSAL",
          retryable: false,
        }),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    const { result } = renderHook(() => useCreateAgentStateTestHarness({ enabled: true }));

    await act(async () => {
      await result.current.send({
        text: "request",
        payloadText: "request",
      });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "I cannot describe this.",
      })
    );
  });

  it("surfaces machine upstream-error transport payloads as errors", async () => {
    fetchWithAuthMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "temporary upstream saturation",
          traceId: "agent-trace-789",
          decision: "error",
          outcome_class: "upstream_error",
          reason_code: "UPSTREAM_ERROR",
          retryable: true,
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    const { result } = renderHook(() => useCreateAgentStateTestHarness({ enabled: true }));
    let sendResult:
      | {
          response: unknown;
          actions: unknown;
        }
      | undefined;

    await act(async () => {
      sendResult = await result.current.send({
        text: "request",
        payloadText: "request",
      });
    });

    expect(sendResult).toEqual(
      expect.objectContaining({
        response: null,
        errorText: "temporary upstream saturation (Trace ID: agent-trace-789)",
        failureKind: "transport_error",
      })
    );
    expect(result.current.error).toBe("temporary upstream saturation (Trace ID: agent-trace-789)");
    expect(result.current.messages.at(-1)).not.toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "temporary upstream saturation",
      })
    );
  });

  it("surfaces sanitized pulse media-fetch failures without exposing signed urls", async () => {
    fetchWithAuthMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Upstream error",
          detail:
            "One attached image could not be fetched by the provider. Try re-adding the preview or using a smaller image.",
          decision: "error",
          outcome_class: "upstream_error",
          reason_code: "UPSTREAM_ERROR",
          retryable: true,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    const { result } = renderHook(() => useCreateAgentStateTestHarness({ enabled: true }));
    let sendResult:
      | {
          response: unknown;
          actions: unknown;
          errorText?: string | null;
          failureKind?: string;
        }
      | undefined;

    await act(async () => {
      sendResult = await result.current.send({
        text: "request",
        payloadText: "request",
      });
    });

    expect(sendResult).toEqual(
      expect.objectContaining({
        response: null,
        errorText:
          "One attached image could not be fetched by the provider. Try re-adding the preview or using a smaller image.",
        failureKind: "transport_error",
      })
    );
    expect(result.current.error).toBe(
      "One attached image could not be fetched by the provider. Try re-adding the preview or using a smaller image."
    );
    expect(result.current.error).not.toContain("/storage/v1/object/sign/");
  });

  it("surfaces structured infra errors in hook state", async () => {
    fetchWithAuthMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Upstream error", detail: "invalid api key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );
    const { result } = renderHook(() => useCreateAgentStateTestHarness({ enabled: true }));

    await act(async () => {
      await result.current.send({
        text: "refine prompt",
        payloadText: "refine prompt",
      });
    });

    expect(result.current.error?.toLowerCase()).toContain("invalid api key");
  });

  it("assigns stable ids to user and assistant messages generated by the hook", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "assistant output" }),
    } as Response);
    const { result } = renderHook(() => useCreateAgentStateTestHarness({ enabled: true }));

    await act(async () => {
      await result.current.send({
        text: "user message",
        payloadText: "user message",
      });
    });

    const userMessage = result.current.messages.find((message) => message.role === "user");
    const assistantMessage = result.current.messages.find(
      (message) => message.role === "assistant"
    );
    expect(userMessage?.id).toMatch(/^agent-user-/);
    expect(assistantMessage?.id).toMatch(/^agent-assistant-/);
  });

  it("appends Pulse assistant history from applyPrompt when the response omits message text", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        actions: { applyPrompt: "cinematic fragrance bottle with glossy reflections" },
      }),
    } as Response);
    const { result } = renderHook(() =>
      useCreateAgentStateTestHarness({ enabled: true, runtimeMode: "pulse" })
    );

    await act(async () => {
      await result.current.send({
        text: "refine this product shot",
        payloadText: "refine this product shot",
      });
    });

    expect(result.current.messages).toEqual([
      expect.objectContaining({
        role: "user",
        content: "refine this product shot",
      }),
      expect.objectContaining({
        role: "assistant",
        content: "cinematic fragrance bottle with glossy reflections",
      }),
    ]);
  });

  it("updates only the targeted message when updateMessageById is used", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "assistant output" }),
    } as Response);
    const { result } = renderHook(() => useCreateAgentStateTestHarness({ enabled: true }));

    await act(async () => {
      await result.current.send({
        text: "user message",
        payloadText: "user message",
      });
    });

    const assistantMessage = result.current.messages.find(
      (message) => message.role === "assistant"
    );
    expect(assistantMessage?.id).toBeTruthy();

    act(() => {
      result.current.updateMessageById(String(assistantMessage?.id), (message) => ({
        ...message,
        content: "edited assistant output",
      }));
    });

    const updatedAssistant = result.current.messages.find(
      (message) => message.role === "assistant"
    );
    expect(updatedAssistant?.content).toBe("edited assistant output");
    expect(updatedAssistant?.id).toBe(assistantMessage?.id);
  });

  it("replaces chat history when replaceMessages is used", () => {
    const { result } = renderHook(() => useCreateAgentStateTestHarness({ enabled: true }));

    act(() => {
      result.current.replaceMessages([
        { id: "agent-user-restored-1", role: "user", content: "restored user" },
        { id: "agent-assistant-restored-1", role: "assistant", content: "restored assistant" },
      ]);
    });

    expect(result.current.messages).toEqual([
      { id: "agent-user-restored-1", role: "user", content: "restored user" },
      { id: "agent-assistant-restored-1", role: "assistant", content: "restored assistant" },
    ]);
    expect(result.current.error).toBeNull();
  });
});
