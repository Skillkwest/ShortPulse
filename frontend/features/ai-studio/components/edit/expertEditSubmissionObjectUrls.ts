export type ExpertEditSubmissionObjectUrls = {
  flattenedUrl: string | null;
  flattenedMarkupReferenceUrl: string | null;
  inpaintMaskUrl: string | null;
};

export const createExpertEditSubmissionObjectUrls = ({
  flattenedBlob,
  flattenedMarkupReferenceBlob,
  inpaintMaskBlob,
}: {
  flattenedBlob: Blob | null;
  flattenedMarkupReferenceBlob: Blob | null;
  inpaintMaskBlob: Blob | null;
}): ExpertEditSubmissionObjectUrls => ({
  flattenedUrl: flattenedBlob ? URL.createObjectURL(flattenedBlob) : null,
  flattenedMarkupReferenceUrl: flattenedMarkupReferenceBlob
    ? URL.createObjectURL(flattenedMarkupReferenceBlob)
    : null,
  inpaintMaskUrl: inpaintMaskBlob ? URL.createObjectURL(inpaintMaskBlob) : null,
});

export const cleanupExpertEditSubmissionObjectUrls = ({
  objectUrls,
  hasSubmissionHandler,
  revokeObjectUrlSafe,
  scheduleTransientObjectUrlRevoke,
}: {
  objectUrls: ExpertEditSubmissionObjectUrls;
  hasSubmissionHandler: boolean;
  revokeObjectUrlSafe: (url: string) => void;
  scheduleTransientObjectUrlRevoke: (url: string) => void;
}) => {
  const releaseUrl = (url: string | null) => {
    if (!url) return;
    if (hasSubmissionHandler) {
      scheduleTransientObjectUrlRevoke(url);
      return;
    }
    revokeObjectUrlSafe(url);
  };

  releaseUrl(objectUrls.flattenedUrl);
  releaseUrl(objectUrls.inpaintMaskUrl);
  releaseUrl(objectUrls.flattenedMarkupReferenceUrl);
};

export const revokeExpertEditSubmissionObjectUrls = ({
  objectUrls,
  revokeObjectUrlSafe,
}: {
  objectUrls: ExpertEditSubmissionObjectUrls;
  revokeObjectUrlSafe: (url: string) => void;
}) => {
  if (objectUrls.flattenedUrl) {
    revokeObjectUrlSafe(objectUrls.flattenedUrl);
    objectUrls.flattenedUrl = null;
  }
  if (objectUrls.inpaintMaskUrl) {
    revokeObjectUrlSafe(objectUrls.inpaintMaskUrl);
    objectUrls.inpaintMaskUrl = null;
  }
  if (objectUrls.flattenedMarkupReferenceUrl) {
    revokeObjectUrlSafe(objectUrls.flattenedMarkupReferenceUrl);
    objectUrls.flattenedMarkupReferenceUrl = null;
  }
};
