import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInternalMediaRef } from "../../../../../lib/media/internalMediaRefs";
import {
  registerInternalMediaRefForUrl,
  resolveInternalMediaRefForUrl,
} from "../../../logic/referenceInputInternalMediaRegistry";
import { prepareSubmissionReferenceInputs } from "../preflightPreparation";

const prepareImageUrlForSubmissionMock = vi.hoisted(() => vi.fn());

vi.mock("../../../utils/imageUpload", () => ({
  prepareImageUrlForSubmission: prepareImageUrlForSubmissionMock,
}));

describe("prepareSubmissionReferenceInputs", () => {
  beforeEach(() => {
    prepareImageUrlForSubmissionMock.mockReset();
  });

  it("carries internal media refs forward when image preparation refreshes the URL", async () => {
    const originalUrl = "https://signed.example.com/original-drop-url.png";
    const preparedUrl = "https://signed.example.com/refreshed-drop-url.png";
    const internalRef = createInternalMediaRef({
      storagePath: "user-1/generations/images/reference-grid-drop.png",
      mediaFileId: "media-reference-grid-drop",
    });
    registerInternalMediaRefForUrl(originalUrl, internalRef);
    prepareImageUrlForSubmissionMock.mockResolvedValue(preparedUrl);

    const result = await prepareSubmissionReferenceInputs({
      outputId: "out-preflight-ref",
      modelId: "fal-ai/bytedance/omnihuman/v1.5",
      tool: "video",
      imageInputs: [originalUrl],
      timeoutMessage: "preflight timed out",
    });

    expect(result.preparedImageInputs).toEqual([preparedUrl]);
    expect(resolveInternalMediaRefForUrl(preparedUrl)).toEqual(internalRef);
  });
});
