/**
 * Object URL blob registry tests.
 * Verifies retained blob references stay bounded while preserving active blob URL reads.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  forgetObjectUrlBlob,
  readRememberedObjectUrlBlob,
  rememberObjectUrlBlob,
  REMEMBERED_OBJECT_URL_BLOB_ENTRY_LIMIT,
} from "../objectUrlBlobRegistry";

const rememberedUrls = new Set<string>();

const rememberTestBlob = (url: string, blob: Blob): void => {
  rememberedUrls.add(url);
  rememberObjectUrlBlob(url, blob);
};

describe("objectUrlBlobRegistry", () => {
  afterEach(() => {
    rememberedUrls.forEach((url) => forgetObjectUrlBlob(url));
    rememberedUrls.clear();
  });

  it("remembers, reads, and forgets blob URL source bytes", () => {
    const blob = new Blob(["image-data"], { type: "image/png" });
    const url = "blob:test-reference";

    rememberTestBlob(url, blob);

    expect(readRememberedObjectUrlBlob(url)).toBe(blob);
    forgetObjectUrlBlob(url);
    expect(readRememberedObjectUrlBlob(url)).toBeNull();
  });

  it("ignores non-blob URLs", () => {
    const blob = new Blob(["image-data"], { type: "image/png" });

    rememberObjectUrlBlob("https://cdn.example.com/reference.png", blob);

    expect(readRememberedObjectUrlBlob("https://cdn.example.com/reference.png")).toBeNull();
  });

  it("evicts the oldest remembered blob when the entry limit is exceeded", () => {
    const firstUrl = "blob:reference-0";
    const lastUrl = `blob:reference-${REMEMBERED_OBJECT_URL_BLOB_ENTRY_LIMIT}`;
    const lastBlob = new Blob(["last"], { type: "image/png" });

    for (let index = 0; index < REMEMBERED_OBJECT_URL_BLOB_ENTRY_LIMIT; index += 1) {
      rememberTestBlob(`blob:reference-${index}`, new Blob([String(index)]));
    }
    rememberTestBlob(lastUrl, lastBlob);

    expect(readRememberedObjectUrlBlob(firstUrl)).toBeNull();
    expect(readRememberedObjectUrlBlob(lastUrl)).toBe(lastBlob);
  });

  it("keeps recently read blobs ahead of older entries during pruning", () => {
    const activeUrl = "blob:active-reference";
    const staleUrl = "blob:stale-reference-0";
    const activeBlob = new Blob(["active"], { type: "image/png" });

    rememberTestBlob(activeUrl, activeBlob);
    for (let index = 0; index < REMEMBERED_OBJECT_URL_BLOB_ENTRY_LIMIT - 1; index += 1) {
      rememberTestBlob(`blob:stale-reference-${index}`, new Blob([String(index)]));
    }

    expect(readRememberedObjectUrlBlob(activeUrl)).toBe(activeBlob);
    rememberTestBlob("blob:new-reference", new Blob(["new"], { type: "image/png" }));

    expect(readRememberedObjectUrlBlob(activeUrl)).toBe(activeBlob);
    expect(readRememberedObjectUrlBlob(staleUrl)).toBeNull();
  });
});
