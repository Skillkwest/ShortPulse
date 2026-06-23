import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetExclusiveSoundPlaybackForTests,
  claimExclusiveSoundPlayback,
  clearExclusiveSoundPlayback,
  markExclusiveSoundPlaying,
  requestExclusiveSoundPlayback,
} from "../exclusiveSoundPlayback";

describe("exclusiveSoundPlayback", () => {
  beforeEach(() => {
    __resetExclusiveSoundPlaybackForTests();
  });

  it("pauses the active player when a different player requests playback", () => {
    const pauseA = vi.fn();
    const pauseB = vi.fn();

    requestExclusiveSoundPlayback({ instanceKey: "a", pause: pauseA });
    markExclusiveSoundPlaying({ instanceKey: "a", pause: pauseA });
    requestExclusiveSoundPlayback({ instanceKey: "b", pause: pauseB });

    expect(pauseA).toHaveBeenCalledTimes(1);
    expect(pauseB).not.toHaveBeenCalled();
  });

  it("pauses a superseded pending player before it starts playing", () => {
    const pauseA = vi.fn();
    const pauseB = vi.fn();

    requestExclusiveSoundPlayback({ instanceKey: "a", pause: pauseA });
    requestExclusiveSoundPlayback({ instanceKey: "b", pause: pauseB });
    markExclusiveSoundPlaying({ instanceKey: "a", pause: pauseA });

    expect(pauseA).toHaveBeenCalledTimes(2);
    expect(pauseB).not.toHaveBeenCalled();
  });

  it("does not let a stale late starter pause the current requested player", () => {
    const pauseA = vi.fn();
    const pauseB = vi.fn();

    requestExclusiveSoundPlayback({ instanceKey: "a", pause: pauseA });
    requestExclusiveSoundPlayback({ instanceKey: "b", pause: pauseB });
    claimExclusiveSoundPlayback({ instanceKey: "a", pause: pauseA });

    expect(pauseA).toHaveBeenCalledTimes(2);
    expect(pauseB).not.toHaveBeenCalled();
  });

  it("ignores clear calls for other players and keeps the current owner active", () => {
    const pauseA = vi.fn();
    const pauseB = vi.fn();

    requestExclusiveSoundPlayback({ instanceKey: "a", pause: pauseA });
    markExclusiveSoundPlaying({ instanceKey: "a", pause: pauseA });
    clearExclusiveSoundPlayback("other");
    requestExclusiveSoundPlayback({ instanceKey: "b", pause: pauseB });

    expect(pauseA).toHaveBeenCalledTimes(1);
    expect(pauseB).not.toHaveBeenCalled();
  });
});
