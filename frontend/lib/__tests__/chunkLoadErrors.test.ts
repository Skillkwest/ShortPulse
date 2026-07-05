/**
 * Regression coverage for client-side Next.js chunk-load error parsing.
 */
import { describe, expect, it } from "vitest";
import {
  extractFailedNextChunk,
  hasNextChunkLoadFailureText,
  toChunkLoadErrorMessage,
} from "../chunkLoadErrors";

describe("chunk load error helpers", () => {
  it("detects and extracts production dynamic import chunk failures", () => {
    const message =
      "Loading chunk 7202 failed.\n(error: https://www.shortpulse.ai/_next/static/chunks/7202.455977c2fa5ae111.js?dpl=dpl_FQaNtWdyN8eNEcqytDdpQFva2p2Q)";

    expect(hasNextChunkLoadFailureText(message)).toBe(true);
    expect(extractFailedNextChunk(message)).toBe("/_next/static/chunks/7202.455977c2fa5ae111.js");
  });

  it("detects route script load failures with a relative chunk path", () => {
    const message = "Failed to load script: /_next/static/chunks/a019415c343aa550.js";

    expect(hasNextChunkLoadFailureText(message)).toBe(true);
    expect(extractFailedNextChunk(message)).toBe("/_next/static/chunks/a019415c343aa550.js");
  });

  it("normalizes unknown error payloads without matching unrelated failures", () => {
    expect(toChunkLoadErrorMessage({ message: "network failed" })).toBe("network failed");
    expect(hasNextChunkLoadFailureText("network failed")).toBe(false);
    expect(extractFailedNextChunk("network failed")).toBeNull();
  });
});
