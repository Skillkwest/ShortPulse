/**
 * Browser client for server-owned product image asset admission.
 */
import { fetchWithAuth } from "./authenticatedFetch";
import type { ImageAdmissionMetadata } from "./imageAdmissionPolicy";
import { ensureSupabaseQueryClient } from "./supabaseClient";

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

export type AdmitProductImageAssetStorageInput = {
  sourceStoragePath: string;
  intent: ProductImageAssetIntent;
  sourceName?: string;
  sourceMimeType?: string;
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

type PrepareProductImageAssetUploadResponse = {
  target?: {
    storagePath?: unknown;
    uploadToken?: unknown;
    mimeType?: unknown;
    name?: unknown;
  };
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

const resolveFileMimeType = (file: File): string => {
  const explicitType = file.type.trim().toLowerCase();
  if (explicitType) return explicitType;
  const extension = file.name.split(".").pop()?.trim().toLowerCase() ?? "";
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "avif":
      return "image/avif";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    default:
      return "application/octet-stream";
  }
};

const buildProductImageAssetBody = ({
  intent,
  characterId,
  characterSheetId,
  slotKey,
  elementId,
  sourceName,
  sourceMimeType,
  sourceStoragePath,
}: {
  intent: ProductImageAssetIntent;
  characterId?: string;
  characterSheetId?: string;
  slotKey?: string;
  elementId?: string;
  sourceName?: string;
  sourceMimeType?: string;
  sourceStoragePath?: string;
}) =>
  JSON.stringify({
    intent,
    characterId,
    characterSheetId,
    slotKey,
    elementId,
    sourceName,
    sourceMimeType,
    sourceStoragePath,
  });

export const admitProductImageAssetFile = async ({
  file,
  intent,
  characterId,
  characterSheetId,
  slotKey,
  elementId,
}: AdmitProductImageAssetFileInput): Promise<AdmittedProductImageAsset> => {
  const sourceMimeType = resolveFileMimeType(file);
  const prepareResponse = await fetchWithAuth("/api/media/prepare-product-image-asset-upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: buildProductImageAssetBody({
      intent,
      characterId,
      characterSheetId,
      slotKey,
      elementId,
      sourceName: file.name,
      sourceMimeType,
    }),
    shortpulseRetryNetworkOnce: true,
  });
  const preparePayload = (await readResponsePayload(
    prepareResponse
  )) as PrepareProductImageAssetUploadResponse;
  const storagePath = asString(preparePayload.target?.storagePath);
  const uploadToken = asString(preparePayload.target?.uploadToken);
  const preparedMimeType = asString(preparePayload.target?.mimeType) || sourceMimeType;
  const preparedName = asString(preparePayload.target?.name) || file.name;
  if (!prepareResponse.ok || !storagePath || !uploadToken) {
    throw new Error(await resolveErrorMessage(prepareResponse));
  }

  const supabase = ensureSupabaseQueryClient();
  const uploadResult = await supabase.storage
    .from("media_library")
    .uploadToSignedUrl(storagePath, uploadToken, file, {
      contentType: preparedMimeType,
      upsert: false,
    });
  if (uploadResult.error) {
    throw new Error(uploadResult.error.message || "Unable to upload image.");
  }

  const finalizeResponse = await fetchWithAuth("/api/media/finalize-product-image-asset-upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: buildProductImageAssetBody({
      intent,
      characterId,
      characterSheetId,
      slotKey,
      elementId,
      sourceName: preparedName,
      sourceMimeType: preparedMimeType,
      sourceStoragePath: storagePath,
    }),
    shortpulseRetryNetworkOnce: true,
  });
  if (!finalizeResponse.ok) {
    throw new Error(await resolveErrorMessage(finalizeResponse));
  }
  const payload = await readResponsePayload(finalizeResponse);
  return parseAdmittedAsset(payload.asset);
};

export const admitProductImageAssetFromStorage = async ({
  sourceStoragePath,
  intent,
  sourceName,
  sourceMimeType,
  characterId,
  characterSheetId,
  slotKey,
  elementId,
}: AdmitProductImageAssetStorageInput): Promise<AdmittedProductImageAsset> => {
  const response = await fetchWithAuth("/api/media/admit-image-asset-from-storage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: buildProductImageAssetBody({
      intent,
      characterId,
      characterSheetId,
      slotKey,
      elementId,
      sourceName,
      sourceMimeType,
      sourceStoragePath,
    }),
    shortpulseRetryNetworkOnce: true,
  });
  if (!response.ok) {
    throw new Error(await resolveErrorMessage(response));
  }
  const payload = await readResponsePayload(response);
  return parseAdmittedAsset(payload.asset);
};
