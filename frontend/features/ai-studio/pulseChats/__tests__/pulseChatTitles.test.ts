import { describe, expect, it } from "vitest";
import type { AiStudioSessionAgentV1 } from "../../logic/sessionSnapshot";
import {
  formatPulseChatTimestamp,
  normalizePulseChatTitle,
  resolvePulseChatThreadTitle,
} from "../pulseChatTitles";
import { buildPulseChatThreadSnapshot } from "../pulseChatThread";

const buildRuntime = (messages: AiStudioSessionAgentV1["messages"]): AiStudioSessionAgentV1 => ({
  messages,
  input: "",
  latestAgentPrompt: null,
  promptOrigin: "manual",
  chatModeEnabled: true,
  pulseWorkflowSession: null,
});

describe("pulseChatTitles", () => {
  it("derives a title from the first visible user message", () => {
    const snapshot = buildPulseChatThreadSnapshot({
      presetId: "preset-1",
      presetLabel: "Story Builder",
      pulseSessionInstanceId: "session-1",
      pulsePrompt: "",
      runtime: buildRuntime([
        {
          id: "activation",
          role: "user",
          content: "pulse_activation_seed: start",
        },
        {
          id: "user-1",
          role: "user",
          content: "Build a cold open for a product launch. Make it crisp.",
        },
      ]),
    });

    expect(resolvePulseChatThreadTitle(snapshot)).toBe("Build a cold open");
  });

  it("falls back to assistant text and then preset labels", () => {
    const assistantSnapshot = buildPulseChatThreadSnapshot({
      presetId: "preset-1",
      presetLabel: "Story Builder",
      pulseSessionInstanceId: "session-1",
      pulsePrompt: "",
      runtime: buildRuntime([
        {
          id: "assistant-1",
          role: "assistant",
          content: "Tell me the setting first. Then I will shape the scene.",
        },
      ]),
    });
    const emptySnapshot = buildPulseChatThreadSnapshot({
      presetId: "preset-1",
      presetLabel: "Story Builder",
      pulseSessionInstanceId: "session-1",
      pulsePrompt: "",
      runtime: buildRuntime([]),
    });

    expect(resolvePulseChatThreadTitle(assistantSnapshot)).toBe("Tell me the setting");
    expect(resolvePulseChatThreadTitle(emptySnapshot)).toBe("Story Builder");
  });

  it("normalizes manual titles and formats explicit timestamps", () => {
    expect(normalizePulseChatTitle("  Launch    hook pass  ")).toBe("Launch hook pass");
    expect(normalizePulseChatTitle("The witch queen golden ritual performance")).toBe(
      "The witch queen golden"
    );
    expect(formatPulseChatTimestamp("2026-06-03T15:00:00.000Z")).toMatch(/Jun 3/i);
  });
});
