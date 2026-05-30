import {
  maybePreprocessLocalImageFileForUpload,
  maybeTranscodeLocalImageBlobForUpload,
} from "../../../lib/adaptive-media";

type PreparedIngressImage = {
  url: string;
  blob: Blob;
};

/**
 * Prepares a local file for Edit ingress using the canonical still-image preprocessing policy.
 */
export const prepareLocalImageFileForEditIngress = async (
  file: File
): Promise<PreparedIngressImage> => {
  const preparedFile = await maybePreprocessLocalImageFileForUpload(file);
  return {
    url: URL.createObjectURL(preparedFile),
    blob: preparedFile,
  };
};

/**
 * Prepares an arbitrary local image blob for Edit ingress using the canonical still-image preprocessing policy.
 */
export const prepareLocalImageBlobForEditIngress = async (
  blob: Blob
): Promise<PreparedIngressImage> => {
  const preparedBlob = await maybeTranscodeLocalImageBlobForUpload(blob);
  return {
    url: URL.createObjectURL(preparedBlob),
    blob: preparedBlob,
  };
};
