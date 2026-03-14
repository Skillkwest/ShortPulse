/**
 * Shared media signed-transform policy.
 * Ensures signed URL transform usage is controlled by explicit dual-flag enablement.
 */
import {
  resolveSignedImageTransform,
  type MediaPreviewImageTransform,
  type MediaPreviewTransformProfile,
} from "./mediaPreviewTransformProfile";

const parseBoolean = (value: string | undefined): boolean => value?.trim().toLowerCase() === "true";

/**
 * Returns true only when both server and client transform flags are explicitly enabled.
 */
export const areMediaSignedTransformsEnabled = (overrides?: {
  serverFlag?: string | undefined;
  clientFlag?: string | undefined;
}): boolean => {
  const serverFlag =
    overrides?.serverFlag ?? process.env.SHORTPULSE_MEDIA_SIGNED_TRANSFORMS_ENABLED;
  const clientFlag =
    overrides?.clientFlag ?? process.env.NEXT_PUBLIC_MEDIA_SIGNED_TRANSFORMS_ENABLED;
  return parseBoolean(serverFlag) && parseBoolean(clientFlag);
};

/**
 * Resolves image signed-transform payload when policy allows transforms.
 */
export const resolvePolicySignedImageTransform = (
  profile: MediaPreviewTransformProfile,
  storagePath: string,
  options?: { transformsEnabled?: boolean }
): MediaPreviewImageTransform | null => {
  const transformsEnabled = options?.transformsEnabled ?? areMediaSignedTransformsEnabled();
  if (!transformsEnabled) return null;
  return resolveSignedImageTransform(profile, storagePath);
};
