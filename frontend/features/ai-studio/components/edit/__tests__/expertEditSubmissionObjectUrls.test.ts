import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  forgetObjectUrlBlob,
  readRememberedObjectUrlBlob,
} from "../../../utils/objectUrlBlobRegistry";
import {
  cleanupExpertEditSubmissionObjectUrls,
  createExpertEditSubmissionObjectUrls,
  revokeExpertEditSubmissionObjectUrls,
} from "../expertEditSubmissionObjectUrls";

describe("expertEditSubmissionObjectUrls", () => {
  const createObjectUrlSpy = vi.spyOn(URL, "createObjectURL");

  beforeEach(() => {
    vi.clearAllMocks();
    forgetObjectUrlBlob("blob:flatten-1");
    forgetObjectUrlBlob("blob:markup-1");
    forgetObjectUrlBlob("blob:mask-1");
    createObjectUrlSpy
      .mockReturnValueOnce("blob:flatten-1")
      .mockReturnValueOnce("blob:markup-1")
      .mockReturnValueOnce("blob:mask-1");
  });

  it("creates object urls for available export blobs", () => {
    const flattenedBlob = new Blob(["flattened"], { type: "image/png" });
    const markupBlob = new Blob(["markup"], { type: "image/png" });
    const maskBlob = new Blob(["mask"], { type: "image/png" });

    expect(
      createExpertEditSubmissionObjectUrls({
        flattenedBlob,
        flattenedMarkupReferenceBlob: markupBlob,
        inpaintMaskBlob: maskBlob,
      })
    ).toEqual({
      flattenedUrl: "blob:flatten-1",
      flattenedMarkupReferenceUrl: "blob:markup-1",
      inpaintMaskUrl: "blob:mask-1",
    });
    expect(readRememberedObjectUrlBlob("blob:flatten-1")).toBe(flattenedBlob);
    expect(readRememberedObjectUrlBlob("blob:markup-1")).toBe(markupBlob);
    expect(readRememberedObjectUrlBlob("blob:mask-1")).toBe(maskBlob);
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
    expect(readRememberedObjectUrlBlob("blob:flatten-1")).toBeNull();
    expect(readRememberedObjectUrlBlob("blob:markup-1")).toBeNull();
    expect(readRememberedObjectUrlBlob("blob:mask-1")).toBeNull();
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
