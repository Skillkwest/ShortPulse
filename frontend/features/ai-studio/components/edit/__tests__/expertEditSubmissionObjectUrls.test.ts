import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  cleanupExpertEditSubmissionObjectUrls,
  createExpertEditSubmissionObjectUrls,
  revokeExpertEditSubmissionObjectUrls,
} from "../expertEditSubmissionObjectUrls";

describe("expertEditSubmissionObjectUrls", () => {
  const createObjectUrlSpy = vi.spyOn(URL, "createObjectURL");

  beforeEach(() => {
    vi.clearAllMocks();
    createObjectUrlSpy
      .mockReturnValueOnce("blob:flatten-1")
      .mockReturnValueOnce("blob:markup-1")
      .mockReturnValueOnce("blob:mask-1");
  });

  it("creates object urls for available export blobs", () => {
    expect(
      createExpertEditSubmissionObjectUrls({
        flattenedBlob: new Blob(["flattened"], { type: "image/png" }),
        flattenedMarkupReferenceBlob: new Blob(["markup"], { type: "image/png" }),
        inpaintMaskBlob: new Blob(["mask"], { type: "image/png" }),
      })
    ).toEqual({
      flattenedUrl: "blob:flatten-1",
      flattenedMarkupReferenceUrl: "blob:markup-1",
      inpaintMaskUrl: "blob:mask-1",
    });
  });

  it("revokes urls immediately on failure and nulls them out", () => {
    const revokeObjectUrlSafe = vi.fn();
    const objectUrls = {
      flattenedUrl: "blob:flatten-1",
      flattenedMarkupReferenceUrl: "blob:markup-1",
      inpaintMaskUrl: "blob:mask-1",
    };

    revokeExpertEditSubmissionObjectUrls({
      objectUrls,
      revokeObjectUrlSafe,
    });

    expect(revokeObjectUrlSafe).toHaveBeenNthCalledWith(1, "blob:flatten-1");
    expect(revokeObjectUrlSafe).toHaveBeenNthCalledWith(2, "blob:mask-1");
    expect(revokeObjectUrlSafe).toHaveBeenNthCalledWith(3, "blob:markup-1");
    expect(objectUrls).toEqual({
      flattenedUrl: null,
      flattenedMarkupReferenceUrl: null,
      inpaintMaskUrl: null,
    });
  });

  it("schedules or revokes urls based on whether submission owns them", () => {
    const revokeObjectUrlSafe = vi.fn();
    const scheduleTransientObjectUrlRevoke = vi.fn();
    const objectUrls = {
      flattenedUrl: "blob:flatten-1",
      flattenedMarkupReferenceUrl: "blob:markup-1",
      inpaintMaskUrl: "blob:mask-1",
    };

    cleanupExpertEditSubmissionObjectUrls({
      objectUrls,
      hasSubmissionHandler: true,
      revokeObjectUrlSafe,
      scheduleTransientObjectUrlRevoke,
    });

    expect(scheduleTransientObjectUrlRevoke).toHaveBeenCalledTimes(3);
    expect(revokeObjectUrlSafe).not.toHaveBeenCalled();
  });
});
