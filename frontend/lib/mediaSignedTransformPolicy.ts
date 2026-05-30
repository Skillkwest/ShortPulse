/**
 * Deny-only media signed-transform compatibility policy.
 * Supabase signed transforms are permanently disabled for media delivery.
 */
import type { MediaPreviewTransformProfile } from "./mediaPreviewTransformProfile";

/**
 * Supabase signed transforms stay disabled even if legacy flags are present.
 */
export const areMediaSignedTransformsEnabled = (overrides?: {
  serverFlag?: string | undefined;
  clientFlag?: string | undefined;
}): boolean => {
  void overrides;
  return false;
};

/**
 * Legacy resolver kept so old call sites fail closed instead of creating transforms.
 */
export const resolvePolicySignedImageTransform = (
  profile: MediaPreviewTransformProfile,
  storagePath: string,
  options?: { transformsEnabled?: boolean }
): null => {
  void profile;
  void storagePath;
  void options;
  return null;
};
