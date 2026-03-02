import { describe, expect, it } from "vitest";
import {
  CHAT_MODE_STORAGE_KEY,
  readChatModeFromStorage,
  writeChatModeToStorage,
} from "../chatModePreference";

const createStorage = (initial: Record<string, string> = {}) => {
  const values = { ...initial };
  return {
    getItem: (key: string) => (key in values ? (values[key] ?? null) : null),
    setItem: (key: string, value: string) => {
      values[key] = value;
    },
    values,
  };
};

describe("chatModePreference", () => {
  it("defaults to chat mode enabled when no storage value exists", () => {
    const storage = createStorage();
    expect(readChatModeFromStorage(storage)).toBe(true);
  });

  it("reads explicit chat mode values from storage", () => {
    expect(readChatModeFromStorage(createStorage({ [CHAT_MODE_STORAGE_KEY]: "0" }))).toBe(false);
    expect(readChatModeFromStorage(createStorage({ [CHAT_MODE_STORAGE_KEY]: "1" }))).toBe(true);
  });

  it("falls back to legacy raw prompt mode storage by inverting value", () => {
    expect(
      readChatModeFromStorage(createStorage({ "shortpulse.ai_studio.raw_prompt_mode": "1" }))
    ).toBe(false);
    expect(
      readChatModeFromStorage(createStorage({ "shortpulse.ai_studio.raw_prompt_mode": "0" }))
    ).toBe(true);
  });

  it("persists chat mode using compact binary values", () => {
    const storage = createStorage();
    writeChatModeToStorage(true, storage);
    writeChatModeToStorage(false, storage);

    expect(storage.values[CHAT_MODE_STORAGE_KEY]).toBe("0");
  });
});
