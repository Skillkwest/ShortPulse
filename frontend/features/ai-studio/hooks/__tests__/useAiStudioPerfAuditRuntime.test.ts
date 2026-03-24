import { describe, expect, it } from "vitest";
import {
  createPerfAuditReferenceImageFile,
  getPerfAuditReferenceImageBytes,
} from "../useAiStudioPerfAuditRuntime";

describe("createPerfAuditReferenceImageFile", () => {
  it("builds a valid PNG file for shell audit drop sampling", async () => {
    const file = createPerfAuditReferenceImageFile();
    const bytes = getPerfAuditReferenceImageBytes();

    expect(file.name).toBe("audit-reference.png");
    expect(file.type).toBe("image/png");
    expect(file.size).toBe(bytes.length);
    expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });
});
