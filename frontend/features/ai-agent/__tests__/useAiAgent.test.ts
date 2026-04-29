import { readFileSync } from "node:fs";
import path from "node:path";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAiAgent } from "../useAiAgent";
import type { SendResult } from "../useAiAgentTypes";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";

vi.mock("../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);

describe("useAiAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    delete process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED;
    delete process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_PROFILE_ACTIVE;
    delete process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED;
  });

  it("keeps Standard Create hook out of Pulse response parsing modules", () => {
    const standardHookSource = readFileSync(
      path.join(process.cwd(), "features/ai-agent/useStandardCreateAgent.ts"),
      "utf8"
    );
    const standardParserSource = readFileSync(
      path.join(process.cwd(), "features/ai-agent/client/standardTransportResultResolution.ts"),
      "utf8"
    );

    expect(standardHookSource).not.toContain("transportResultResolution");
    expect(standardHookSource).not.toContain("pulseTransportResultResolution");
    expect(standardHookSource).not.toContain("logic/contextBuilder");
    expect(standardParserSource).not.toContain("resolveWorkflowSession");
    expect(standardParserSource).not.toContain("AgentPulseWorkflowSession");
  });

  it("allows image-context-only turns without injecting describe text", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Image context received." }),
    } as Response);
    const { result } = renderHook(() => useAiAgent({ enabled: true, runtimeMode: "pulse" }));

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
    const { result } = renderHook(() => useAiAgent({ enabled: true }));

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
    const { result } = renderHook(() => useAiAgent({ enabled: true }));

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

  it("keeps a pulse activation reply when the hook namespace switches to the override before the response resolves", async () => {
    let resolveFetch: ((value: Response | PromiseLike<Response>) => void) | null = null;
    fetchWithAuthMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { result, rerender } = renderHook(
      ({ sessionNamespace }: { sessionNamespace: string }) =>
        useAiAgent({ enabled: true, sessionNamespace, runtimeMode: "pulse" }),
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
        useAiAgent({ enabled: true, sessionNamespace, runtimeMode: "pulse" }),
      {
        initialProps: {
          sessionNamespace: "ai-studio:seed:none::pulse:none",
        },
      }
    );

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
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "Pulse activated.",
      })
    );

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

  it("refuses explicit input in client precheck without transport call", async () => {
    const { result } = renderHook(() => useAiAgent({ enabled: true }));

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

  it("rewrites suggestive input before transport call", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "safe rewrite pass" }),
    } as Response);
    const { result } = renderHook(() => useAiAgent({ enabled: true }));

    await act(async () => {
      await result.current.send({
        text: "a sexy topless model in lingerie",
        payloadText: "a sexy topless model in lingerie",
      });
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    const requestInit = fetchWithAuthMock.mock.calls[0]?.[1];
    const bodyText = String(requestInit?.body ?? "");
    expect(bodyText.toLowerCase()).not.toContain("topless");
    expect(bodyText.toLowerCase()).not.toContain("lingerie");
    expect(bodyText.toLowerCase()).toContain("fully clothed");
  });

  it("skips client precheck when disabled and sends original payload", async () => {
    process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED = "false";
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "ok" }),
    } as Response);
    const { result } = renderHook(() => useAiAgent({ enabled: true }));

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

  it("includes directOpenAiBypass when the direct bypass option is enabled", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "ok" }),
    } as Response);
    const { result } = renderHook(() =>
      useAiAgent({ enabled: true, directOpenAiBypassEnabled: true })
    );

    await act(async () => {
      await result.current.send({
        text: "hello direct model",
        payloadText: "hello direct model",
      });
    });

    const requestInit = fetchWithAuthMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(requestInit?.body ?? "{}")) as {
      directOpenAiBypass?: boolean;
      runtimeMode?: string;
    };
    expect(body.directOpenAiBypass).toBe(true);
    expect(body.runtimeMode).toBe("standard");
    expect(fetchWithAuthMock.mock.calls[0]?.[0]).toBe("/api/ai/studio-agent-standard");
  });

  it("includes pulse runtimeMode when configured for Pulse mode", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "ok" }),
    } as Response);
    const { result } = renderHook(() => useAiAgent({ enabled: true, runtimeMode: "pulse" }));

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

  it("preserves finalArtifactSource from workflow-session responses", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: "final artifact",
        workflowSession: {
          presetId: "story_builder",
          status: "completed",
          currentStepIndex: 6,
          currentStepLabel: "Image Prompts",
          currentStepPrompt: null,
          collectedInputs: ["grimdark"],
          lastArtifact: "final artifact",
          finalArtifactSource: "chat_reply",
        },
      }),
    } as Response);
    const { result } = renderHook(() => useAiAgent({ enabled: true }));

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
      lastArtifact: "final artifact",
      finalArtifactSource: "chat_reply",
    });
  });

  it("reuses stored clientSessionKey across hook remounts and rotates on reset", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "ok" }),
    } as Response);

    const { result, unmount } = renderHook(() =>
      useAiAgent({ enabled: true, sessionNamespace: "ai-studio:test" })
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
      useAiAgent({ enabled: true, sessionNamespace: "ai-studio:test" })
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
      ({ namespace }) => useAiAgent({ enabled: true, sessionNamespace: namespace }),
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
      ({ namespace }) => useAiAgent({ enabled: true, sessionNamespace: namespace }),
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

  it("keeps Standard override sends blocked from Pulse bootstrap namespaces", async () => {
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: "standard reply",
        canonicalPrompt: "standard canonical prompt",
      }),
    } as Response);

    const hook = renderHook(() =>
      useAiAgent({ enabled: true, sessionNamespace: "ai-studio:session-a::standard" })
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
      useAiAgent({ enabled: true, sessionNamespace: "ai-studio:session-a::standard" })
    );

    await act(async () => {
      await standardHook.result.current.send({
        text: "standard turn",
        payloadText: "standard turn",
      });
    });

    const pulseHook = renderHook(() =>
      useAiAgent({
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
      ({ namespace }) => useAiAgent({ enabled: true, sessionNamespace: namespace }),
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
    const { result } = renderHook(() => useAiAgent({ enabled: true }));

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

  it("treats infra fallback payloads as assistant responses without setting error", async () => {
    fetchWithAuthMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "I can't process that request right now. Please try again.",
          actions: undefined,
          outcome_class: "fallback_infra",
          reason_code: "INFRA_FALLBACK_TRANSIENT",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    const { result } = renderHook(() => useAiAgent({ enabled: true }));

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
        content: "I can't process that request right now. Please try again.",
        canUseAsPrompt: false,
        outcomeClass: "fallback_infra",
      })
    );
  });

  it("marks Standard message-only successes as non-prompt assistant responses", async () => {
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
    const { result } = renderHook(() => useAiAgent({ enabled: true, runtimeMode: "standard" }));

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
    const { result } = renderHook(() => useAiAgent({ enabled: true, runtimeMode: "pulse" }));

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
    const { result } = renderHook(() => useAiAgent({ enabled: true, runtimeMode: "standard" }));

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
    const { result } = renderHook(() => useAiAgent({ enabled: true }));

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

  it("prioritizes machine fallback fields over non-actionable transport errors", async () => {
    fetchWithAuthMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "temporary upstream saturation",
          decision: "allow",
          outcome_class: "fallback_infra",
          reason_code: "INFRA_FALLBACK_TRANSIENT",
          retryable: true,
          fallback_reason: "responses_unavailable",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    const { result } = renderHook(() => useAiAgent({ enabled: true }));
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
        response: expect.objectContaining({
          outcome_class: "fallback_infra",
          reason_code: "INFRA_FALLBACK_TRANSIENT",
          fallback_reason: "responses_unavailable",
        }),
      })
    );
    expect(result.current.error).toBeNull();
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "temporary upstream saturation",
        canUseAsPrompt: false,
        outcomeClass: "fallback_infra",
      })
    );
  });

  it("surfaces structured infra errors in hook state", async () => {
    fetchWithAuthMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Upstream error", detail: "invalid api key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );
    const { result } = renderHook(() => useAiAgent({ enabled: true }));

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
    const { result } = renderHook(() => useAiAgent({ enabled: true }));

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

  it("appends assistant history from applyPrompt when the response omits message text", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        actions: { applyPrompt: "cinematic fragrance bottle with glossy reflections" },
      }),
    } as Response);
    const { result } = renderHook(() => useAiAgent({ enabled: true }));

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
    const { result } = renderHook(() => useAiAgent({ enabled: true }));

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
    const { result } = renderHook(() => useAiAgent({ enabled: true }));

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
