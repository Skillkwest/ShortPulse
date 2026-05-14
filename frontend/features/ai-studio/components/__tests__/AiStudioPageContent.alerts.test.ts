import { describe, expect, it } from "vitest";
import { groupVisibleFailuresForAlertStack } from "../AiStudioPageContent";

describe("groupVisibleFailuresForAlertStack", () => {
  it("groups repeated failures with the same model label and message", () => {
    const grouped = groupVisibleFailuresForAlertStack([
      {
        id: "out-1",
        model: "ElevenLabs Music",
        modelId: "music_v1",
        prompt: "first",
        errorMessage: "text must be 2000 characters or fewer.",
        errorMessageShort: "text must be 2000 characters or fewer.",
        errorDetail: "text must be 2000 characters or fewer.",
      },
      {
        id: "out-2",
        model: "ElevenLabs Music",
        modelId: "music_v1",
        prompt: "second",
        errorMessage: "text must be 2000 characters or fewer.",
        errorMessageShort: "text must be 2000 characters or fewer.",
        errorDetail: "text must be 2000 characters or fewer.",
      },
    ]);

    expect(grouped).toEqual([
      {
        ids: ["out-1", "out-2"],
        modelLabel: "ElevenLabs Music",
        failureMessage: "text must be 2000 characters or fewer.",
        count: 2,
      },
    ]);
  });

  it("keeps distinct provider messages in separate groups", () => {
    const grouped = groupVisibleFailuresForAlertStack([
      {
        id: "out-1",
        model: "ElevenLabs Music",
        modelId: "music_v1",
        prompt: "first",
        errorMessage: "text must be 2000 characters or fewer.",
        errorMessageShort: "text must be 2000 characters or fewer.",
        errorDetail: "text must be 2000 characters or fewer.",
      },
      {
        id: "out-2",
        model: "ElevenLabs Music",
        modelId: "music_v1",
        prompt: "second",
        errorMessage: "Provider unavailable",
        errorMessageShort: "Provider unavailable",
        errorDetail: "Provider unavailable",
      },
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0]?.count).toBe(1);
    expect(grouped[1]?.count).toBe(1);
  });
});
