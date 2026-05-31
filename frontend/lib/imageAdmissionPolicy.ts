/**
 * Client-safe policy constants and metadata types for product image admission.
 * Shared by browser upload prep and server-side admission without importing server-only code.
 */

export const IMAGE_ADMISSION_POLICY_ID = "shortpulse_image_admission_25mb";
export const IMAGE_ADMISSION_POLICY_VERSION = 1;
export const IMAGE_ADMISSION_MAX_BYTES = 25 * 1024 * 1024;
export const IMAGE_ADMISSION_TARGET_BYTES = 23 * 1024 * 1024;
export const IMAGE_ADMISSION_VARIANT_KIND = "admitted_reference_25mb";

export type ImageAdmissionStatus = "not_required" | "admitted" | "rejected";

export type ImageAdmissionStrategy =
  | "passthrough"
  | "server_sharp"
  | "browser_canvas"
  | "rejected_animated_over_cap"
  | "rejected_unfit";

export type ImageAdmissionMetadata = {
  version: number;
  status: ImageAdmissionStatus;
  policy: typeof IMAGE_ADMISSION_POLICY_ID;
  max_bytes: number;
  target_bytes: number;
  original_bytes: number;
  admitted_bytes: number | null;
  original_mime_type: string;
  admitted_mime_type: string | null;
  original_width: number | null;
  original_height: number | null;
  admitted_width: number | null;
  admitted_height: number | null;
  strategy: ImageAdmissionStrategy;
  original_preserved: boolean;
  original_storage_path: string | null;
  admitted_storage_path: string | null;
  supabase_transform_used: false;
};
