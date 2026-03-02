import { describe, expect, it } from "vitest";
import {
  canAutoPersistRecoveryMedia,
  canAutoSaveOutput,
  isAutoSaveEligibleOutput,
} from "../mediaAutosavePolicy";

describe("mediaAutosavePolicy", () => {
  it("always allows manual persistence intent", () => {
    expect(
      canAutoSaveOutput({
        intent: "manual",
        source: "generated",
        mediaAutosaveEnabled: false,
        hasMedia: false,
      })
    ).toEqual({
      allowed: true,
      reason: "manual_allowed",
    });
  });

  it("denies auto persistence when autosave is disabled", () => {
    expect(
      canAutoSaveOutput({
        intent: "auto",
        source: "generated",
        mediaAutosaveEnabled: false,
        hasMedia: true,
      })
    ).toEqual({
      allowed: false,
      reason: "autosave_disabled",
    });
  });

  it("denies auto persistence for prompt-only references and already-saved outputs", () => {
    expect(
      canAutoSaveOutput({
        intent: "auto",
        source: "prompt",
        mediaAutosaveEnabled: true,
        hasMedia: false,
        hasPromptOnlyText: true,
      })
    ).toEqual({
      allowed: false,
      reason: "prompt_only_reference",
    });
    expect(
      canAutoSaveOutput({
        intent: "auto",
        source: "generated",
        mediaAutosaveEnabled: true,
        hasMedia: true,
        saveState: "saved",
      })
    ).toEqual({
      allowed: false,
      reason: "already_saved",
    });
    expect(
      canAutoSaveOutput({
        intent: "auto",
        source: "generated",
        mediaAutosaveEnabled: true,
        hasMedia: true,
        saveState: "saving",
      })
    ).toEqual({
      allowed: false,
      reason: "already_saved",
    });
    expect(
      canAutoSaveOutput({
        intent: "auto",
        source: "library",
        mediaAutosaveEnabled: true,
        hasMedia: true,
        savedMediaIds: ["media-1"],
      })
    ).toEqual({
      allowed: false,
      reason: "already_persisted_library",
    });
  });

  it("allows auto persistence for eligible generated/upload/clipboard outputs", () => {
    expect(
      isAutoSaveEligibleOutput({
        intent: "auto",
        source: "generated",
        mediaAutosaveEnabled: true,
        hasMedia: true,
      })
    ).toBe(true);
    expect(
      isAutoSaveEligibleOutput({
        intent: "auto",
        source: "upload",
        mediaAutosaveEnabled: true,
        hasMedia: true,
      })
    ).toBe(true);
    expect(
      isAutoSaveEligibleOutput({
        intent: "auto",
        source: "clipboard",
        mediaAutosaveEnabled: true,
        hasMedia: true,
      })
    ).toBe(true);
  });

  it("mirrors recovery auto-persist decision policy", () => {
    expect(
      canAutoPersistRecoveryMedia({
        intent: "auto",
        mediaAutosaveEnabled: true,
      })
    ).toEqual({
      allowed: true,
      reason: "auto_allowed",
    });
    expect(
      canAutoPersistRecoveryMedia({
        intent: "auto",
        mediaAutosaveEnabled: false,
      })
    ).toEqual({
      allowed: false,
      reason: "autosave_disabled",
    });
  });
});
