/**
 * Shared test utilities for the MediaLibraryPanel suite.
 */
import { readFileSync } from "node:fs";
import { expect } from "vitest";

export const TEST_FOLDER_ID = "11111111-1111-4111-8111-111111111111";

export const mediaLibraryPanelStylesheet = readFileSync(
  "styles/ai-studio-media-library-panel.css",
  "utf8"
);

export const readCssZIndex = (pattern: RegExp): number => {
  const match = mediaLibraryPanelStylesheet.match(pattern);
  expect(match?.[1]).toBeTruthy();
  return Number(match?.[1]);
};

export const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

export const createTransferStore = () => {
  const values = new Map<string, string>();
  const transfer = {
    files: { length: 0, item: () => null } as unknown as FileList,
    types: [] as string[],
    setData(type: string, value: string) {
      values.set(type, value);
      this.types = Array.from(values.keys());
    },
    getData(type: string) {
      return values.get(type) ?? "";
    },
    dropEffect: "none",
    effectAllowed: "none",
  };
  return transfer as unknown as DataTransfer;
};

export const createUnreadableTransfer = () =>
  ({
    files: { length: 0, item: () => null } as unknown as FileList,
    types: [] as string[],
    getData: () => "",
    dropEffect: "none",
    effectAllowed: "none",
  }) as unknown as DataTransfer;
