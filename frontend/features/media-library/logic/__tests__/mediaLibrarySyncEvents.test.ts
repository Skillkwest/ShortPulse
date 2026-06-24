import { afterEach, describe, expect, it, vi } from "vitest";
import {
  publishMediaLibraryChanged,
  subscribeMediaLibraryChanged,
  type MediaLibraryChangedPayload,
} from "../mediaLibrarySyncEvents";

describe("mediaLibrarySyncEvents", () => {
  const unsubscribers: Array<() => void> = [];

  afterEach(() => {
    while (unsubscribers.length > 0) {
      unsubscribers.pop()?.();
    }
  });

  it("publishes normalized media library change payloads", () => {
    const onChange = vi.fn();
    unsubscribers.push(subscribeMediaLibraryChanged(onChange));

    publishMediaLibraryChanged({
      userId: " user-1 ",
      reason: "reference_grid_upload",
      mediaFileIds: ["media-1", " media-1 ", "media-2"],
      promptIds: [""],
      folderIds: [" folder-1 "],
      atMs: 123,
    });

    expect(onChange).toHaveBeenCalledWith({
      userId: "user-1",
      reason: "reference_grid_upload",
      mediaFileIds: ["media-1", "media-2"],
      promptIds: [],
      folderIds: ["folder-1"],
      atMs: 123,
    } satisfies MediaLibraryChangedPayload);
  });

  it("scopes subscriptions by user id when requested", () => {
    const scoped = vi.fn();
    const unscoped = vi.fn();
    unsubscribers.push(subscribeMediaLibraryChanged(scoped, { userId: "user-1" }));
    unsubscribers.push(subscribeMediaLibraryChanged(unscoped));

    publishMediaLibraryChanged({
      userId: "user-2",
      reason: "ai_studio_output_save",
      mediaFileIds: ["media-2"],
    });
    publishMediaLibraryChanged({
      userId: "user-1",
      reason: "ai_studio_output_save",
      mediaFileIds: ["media-1"],
    });

    expect(scoped).toHaveBeenCalledTimes(1);
    expect(scoped.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        userId: "user-1",
        mediaFileIds: ["media-1"],
      })
    );
    expect(unscoped).toHaveBeenCalledTimes(2);
  });
});
