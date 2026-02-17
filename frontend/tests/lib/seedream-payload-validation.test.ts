import { describe, expect, it } from "vitest";
import { validateSeedreamImageSizePayload } from "../../lib/server/api/seedreamPayloadValidation";

describe("validateSeedreamImageSizePayload", () => {
  it("accepts known image_size enums", () => {
    expect(validateSeedreamImageSizePayload({ image_size: "landscape_16_9" })).toBeNull();
    expect(validateSeedreamImageSizePayload({ image_size: "auto_4K" })).toBeNull();
  });

  it("accepts custom width/height objects", () => {
    expect(
      validateSeedreamImageSizePayload({ image_size: { width: 2400, height: 1920 } })
    ).toBeNull();
  });

  it("rejects malformed custom size objects", () => {
    const result = validateSeedreamImageSizePayload({ image_size: { width: 2400 } });
    expect(result).not.toBeNull();
    expect(result?.detail).toEqual(expect.objectContaining({ field: "image_size" }));
  });

  it("rejects unsupported image_size strings", () => {
    const result = validateSeedreamImageSizePayload({ image_size: "portrait_5_4" });
    expect(result).not.toBeNull();
    expect(result?.detail).toEqual(expect.objectContaining({ field: "image_size" }));
  });
});
