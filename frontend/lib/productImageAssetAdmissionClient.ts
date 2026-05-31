/**
 * Browser client for server-owned product image asset admission.
 */
import { fetchWithAuth } from "./authenticatedFetch";
import type { ImageAdmissionMetadata } from "./imageAdmissionPolicy";

export type ProductImageAssetIntent =
  | "character_profile"
  | "character_sheet_preset"
  | "character_slot"
  | "element_profile";

export type AdmittedProductImageAsset = {
  bucket: "media_library";
  url: string;
  signedUrl: string;
  storagePath: string;
  previewStoragePath: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  admissionMetadata: ImageAdmissionMetadata;
};

export type AdmitProductImageAssetFileInput = {
  file: File;
  intent: ProductImageAssetIntent;
  characterId?: string;
  characterSheetId?: string;
  slotKey?: string;
  elementId?: string;
};

type AdmitProductImageAssetResponse = {
  asset?: Partial<AdmittedProductImageAsset>;
  error?: string;
  details?: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const readResponsePayload = async (response: Response): Promise<AdmitProductImageAssetResponse> => {
  try {
    return (await response.clone().json()) as AdmitProductImageAssetResponse;
  } catch {
    return {};
  }
};

const resolveErrorMessage = async (response: Response): Promise<string> => {
  const payload = await readResponsePayload(response);
  const details = asString(payload.details);
  if (details) return details;
  const error = asString(payload.error);
  if (error) return error;
  return "Unable to upload image.";
};

const toNullableNumber = (value: unknown): number | null => {
  if (value == null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const parseAdmittedAsset = (value: unknown): AdmittedProductImageAsset => {
  const asset = asRecord(value);
  const signedUrl = asString(asset.signedUrl) || asString(asset.url);
  const storagePath = asString(asset.storagePath);
  const filename = asString(asset.filename);
  const mimeType = asString(asset.mimeType);
  const size = Number(asset.size);
  if (!signedUrl || !storagePath || !filename || !mimeType || !Number.isFinite(size)) {
    throw new Error("Image uploaded, but the server response was incomplete.");
  }
  return {
    bucket: "media_library",
    url: signedUrl,
    signedUrl,
    storagePath,
    previewStoragePath: asString(asset.previewStoragePath) || storagePath,
    filename,
    mimeType,
    size,
    width: toNullableNumber(asset.width),
    height: toNullableNumber(asset.height),
    admissionMetadata: asRecord(asset.admissionMetadata) as ImageAdmissionMetadata,
  };
};

export const admitProductImageAssetFile = async ({
  file,
  intent,
  characterId,
  characterSheetId,
  slotKey,
  elementId,
}: AdmitProductImageAssetFileInput): Promise<AdmittedProductImageAsset> => {
  const formData = new FormData();
  formData.set("intent", intent);
  if (characterId) formData.set("characterId", characterId);
  if (characterSheetId) formData.set("characterSheetId", characterSheetId);
  if (slotKey) formData.set("slotKey", slotKey);
  if (elementId) formData.set("elementId", elementId);
  formData.set("file", file);

  const response = await fetchWithAuth("/api/media/admit-image-asset", {
    method: "POST",
    body: formData,
    shortpulseSkipErrorLogging: true,
  });
  if (!response.ok) {
    throw new Error(await resolveErrorMessage(response));
  }
  const payload = await readResponsePayload(response);
  return parseAdmittedAsset(payload.asset);
};
