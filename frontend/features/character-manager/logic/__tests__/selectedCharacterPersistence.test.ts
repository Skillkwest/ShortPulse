import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  persistSelectedCharacterId,
  readPersistedSelectedCharacterId,
  subscribeToSelectedCharacterId,
} from "../selectedCharacterPersistence";

describe("selectedCharacterPersistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("reads null when no selected character is persisted", () => {
    expect(readPersistedSelectedCharacterId()).toBeNull();
  });

  it("persists and reads selected character id", () => {
    persistSelectedCharacterId("char-7");
    expect(readPersistedSelectedCharacterId()).toBe("char-7");
  });

  it("keeps persisted selected character isolated per user scope", () => {
    persistSelectedCharacterId("char-user-a", { userId: "user-a" });
    persistSelectedCharacterId("char-user-b", { userId: "user-b" });

    expect(readPersistedSelectedCharacterId({ userId: "user-a" })).toBe("char-user-a");
    expect(readPersistedSelectedCharacterId({ userId: "user-b" })).toBe("char-user-b");
    expect(readPersistedSelectedCharacterId({ userId: "user-c" })).toBeNull();
  });

  it("notifies subscribers on persisted selection changes", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeToSelectedCharacterId(onChange);

    persistSelectedCharacterId("char-1");
    persistSelectedCharacterId("char-2");
    unsubscribe();

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, "char-1");
    expect(onChange).toHaveBeenNthCalledWith(2, "char-2");
  });

  it("filters subscriber events by user scope", () => {
    const onChangeUserA = vi.fn();
    const onChangeUserB = vi.fn();
    const unsubscribeA = subscribeToSelectedCharacterId(onChangeUserA, { userId: "user-a" });
    const unsubscribeB = subscribeToSelectedCharacterId(onChangeUserB, { userId: "user-b" });

    persistSelectedCharacterId("char-a", { userId: "user-a" });
    persistSelectedCharacterId("char-b", { userId: "user-b" });
    unsubscribeA();
    unsubscribeB();

    expect(onChangeUserA).toHaveBeenCalledTimes(1);
    expect(onChangeUserA).toHaveBeenCalledWith("char-a");
    expect(onChangeUserB).toHaveBeenCalledTimes(1);
    expect(onChangeUserB).toHaveBeenCalledWith("char-b");
  });

  it("does not dispatch duplicate change events when selection is unchanged", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    persistSelectedCharacterId("char-1");
    persistSelectedCharacterId("char-1");

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
  });
});
