import { describe, expect, it } from "vitest";
import {
  resolveViewportTapState,
  shouldCreateDraftFromPointerDetail,
  shouldSuppressDraftCreation,
} from "../canvasInteractionController";

describe("canvasInteractionController", () => {
  it("accepts pointer detail fallback only for primary pointer when space-pan is inactive", () => {
    expect(
      shouldCreateDraftFromPointerDetail({
        button: 0,
        detail: 2,
        isSpacePanActive: false,
      })
    ).toBe(true);
    expect(
      shouldCreateDraftFromPointerDetail({
        button: 1,
        detail: 2,
        isSpacePanActive: false,
      })
    ).toBe(false);
    expect(
      shouldCreateDraftFromPointerDetail({
        button: 0,
        detail: 2,
        isSpacePanActive: true,
      })
    ).toBe(false);
  });

  it("suppresses duplicate draft creation near the recent creation point", () => {
    expect(
      shouldSuppressDraftCreation({
        lastCreation: {
          timeStamp: 1000,
          clientX: 100,
          clientY: 100,
        },
        nextPoint: {
          timeStamp: 1200,
          clientX: 106,
          clientY: 104,
        },
      })
    ).toBe(true);
  });

  it("creates draft only on qualifying second tap", () => {
    const first = resolveViewportTapState({
      previousTap: null,
      nextTap: {
        timeStamp: 1000,
        clientX: 200,
        clientY: 150,
      },
      isSpacePanActive: false,
      travelDistance: 0,
    });
    expect(first.shouldCreateDraft).toBe(false);
    expect(first.nextStoredTap).toBeTruthy();

    const second = resolveViewportTapState({
      previousTap: first.nextStoredTap,
      nextTap: {
        timeStamp: 1200,
        clientX: 203,
        clientY: 151,
      },
      isSpacePanActive: false,
      travelDistance: 0,
    });
    expect(second.shouldCreateDraft).toBe(true);
    expect(second.nextStoredTap).toBeNull();
  });
});
