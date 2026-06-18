/**
 * Server-side allowlisted product-image asset admission.
 * Used by domain surfaces that need storage-backed image assets without trusting client paths.
 */
import crypto from "crypto";
import type { ImageAdmissionMetadata } from "../imageAdmissionPolicy";
import { assertUserScopedMediaStoragePath } from "../mediaStoragePath";
import { extractImageDimensionsFromBuffer } from "./imageDimensions";
import {
  areCompatibleMimeTypes,
  detectImageMimeType,
  normalizeSupportedMimeType,
} from "./uploadSignature";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  createSignedMediaUrl,
  MAX_IMAGE_MEDIA_BYTES,
  MAX_VIDEO_MEDIA_BYTES,
  MEDIA_BUCKET,
  resolveMediaStorageExtension,
  uploadMediaBufferToStoragePath,
} from "./mediaIngest";
import { admitImageBufferForProductUse } from "./imageAdmission";
import { getSupabaseAdmin } from "./api/supabaseAdmin";

export type ProductImageAssetIntent =
  | "character_profile"
  | "character_sheet_preset"
  | "character_slot"
  | "element_profile";

type ProductImageAssetUploadInput = {
  buffer: Buffer;
  declaredMimeType: string;
  filename: string;
  intent: ProductImageAssetIntent;
  characterId: string;
  characterSheetId: string;
  slotKey: string;
  elementId: string;
};

export type ProductImageAssetAdmissionResponse = {
  bucket: typeof MEDIA_BUCKET;
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

const CHARACTER_SLOT_KEYS = new Set([
  "front_full",
  "back_full",
  "side_profile",
  "top_down",
  "front_left_34",
  "front_right_34",
  "back_left_34",
  "back_right_34",
  "portrait_close",
  "fullbody_wide",
]);

const PRODUCT_IMAGE_ASSET_TRANSPORT_MAX_BYTES = MAX_VIDEO_MEDIA_BYTES;
const PRODUCT_IMAGE_ASSET_STAGING_FOLDER = "upload-staging/product-image-assets";
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,96}$/;

export class ProductImageAssetAdmissionError extends Error {
  readonly status: number;
  readonly details?: string;

  constructor(status: number, message: string, details?: string) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const normalizeContentType = (value: string | null | undefined): string =>
  normalizeSupportedMimeType(value?.split(";")[0] ?? "");

const sanitizeFileStem = (filename: string): string => {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  const sanitized = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return sanitized || "reference";
};

const resolveSafeId = (value: string, label: string): string => {
  const normalized = value.trim();
  if (!SAFE_ID_PATTERN.test(normalized)) {
    throw new ProductImageAssetAdmissionError(400, "Invalid request", `${label} is invalid.`);
  }
  return normalized;
};

const resolveIntent = (value: string): ProductImageAssetIntent => {
  if (
    value === "character_profile" ||
    value === "character_sheet_preset" ||
    value === "character_slot" ||
    value === "element_profile"
  ) {
    return value;
  }
  throw new ProductImageAssetAdmissionError(400, "Invalid request", "Unknown image asset intent.");
};

const resolveStoragePath = ({
  userId,
  upload,
  mimeType,
}: {
  userId: string;
  upload: ProductImageAssetUploadInput;
  mimeType: string;
}): string => {
  const extension = resolveMediaStorageExtension(mimeType, "jpg") || "jpg";
  const stem = sanitizeFileStem(upload.filename);
  const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${stem}.${extension}`;

  if (upload.intent === "character_profile") {
    const characterId = resolveSafeId(upload.characterId, "Character ID");
    return assertUserScopedMediaStoragePath({
      path: `${userId}/characters/${characterId}/profile/${uniqueName}`,
      userId,
      label: "Character profile storage path",
    });
  }

  if (upload.intent === "character_sheet_preset") {
    const characterId = resolveSafeId(upload.characterId, "Character ID");
    return assertUserScopedMediaStoragePath({
      path: `${userId}/characters/${characterId}/presets/${uniqueName}`,
      userId,
      label: "Character sheet preset storage path",
    });
  }

  if (upload.intent === "character_slot") {
    const characterId = resolveSafeId(upload.characterId, "Character ID");
    const characterSheetId = resolveSafeId(upload.characterSheetId, "Character sheet ID");
    const slotKey = upload.slotKey.trim();
    if (!CHARACTER_SLOT_KEYS.has(slotKey)) {
      throw new ProductImageAssetAdmissionError(
        400,
        "Invalid request",
        "Character slot is invalid."
      );
    }
    return assertUserScopedMediaStoragePath({
      path: `${userId}/characters/${characterId}/${characterSheetId}/${slotKey}/${uniqueName}`,
      userId,
      label: "Character slot storage path",
    });
  }

  const elementId = resolveSafeId(upload.elementId, "Element ID");
  return assertUserScopedMediaStoragePath({
    path: `${userId}/elements/${elementId}/profile/${uniqueName}`,
    userId,
    label: "Element profile storage path",
  });
};

const assertOwnedDomainTarget = async ({
  userId,
  upload,
}: {
  userId: string;
  upload: ProductImageAssetUploadInput;
}): Promise<void> => {
  const supabaseAdmin = getSupabaseAdmin();

  if (
    upload.intent === "character_profile" ||
    upload.intent === "character_sheet_preset" ||
    upload.intent === "character_slot"
  ) {
    const characterId = resolveSafeId(upload.characterId, "Character ID");
    const characterQuery = await supabaseAdmin
      .from("characters")
      .select("id")
      .eq("user_id", userId)
      .eq("id", characterId)
      .maybeSingle();
    if (characterQuery.error) {
      throw new ProductImageAssetAdmissionError(
        500,
        "Unable to verify image asset target",
        characterQuery.error.message
      );
    }
    if (!characterQuery.data) {
      throw new ProductImageAssetAdmissionError(404, "Image asset target not found");
    }

    if (upload.intent === "character_slot") {
      const characterSheetId = resolveSafeId(upload.characterSheetId, "Character sheet ID");
      const sheetQuery = await supabaseAdmin
        .from("character_reference_packs")
        .select("id")
        .eq("user_id", userId)
        .eq("character_id", characterId)
        .eq("id", characterSheetId)
        .maybeSingle();
      if (sheetQuery.error) {
        throw new ProductImageAssetAdmissionError(
          500,
          "Unable to verify image asset target",
          sheetQuery.error.message
        );
      }
      if (!sheetQuery.data) {
        throw new ProductImageAssetAdmissionError(404, "Image asset target not found");
      }
    }
    return;
  }

  const elementId = resolveSafeId(upload.elementId, "Element ID");
  const elementQuery = await supabaseAdmin
    .from("elements")
    .select("id")
    .eq("user_id", userId)
    .eq("id", elementId)
    .maybeSingle();
  if (elementQuery.error) {
    throw new ProductImageAssetAdmissionError(
      500,
      "Unable to verify image asset target",
      elementQuery.error.message
    );
  }
  if (!elementQuery.data) {
    throw new ProductImageAssetAdmissionError(404, "Image asset target not found");
  }
};

const validateImageMimeType = ({
  declaredMimeType,
  buffer,
}: {
  declaredMimeType: string;
  buffer: Buffer;
}): string => {
  const detectedMimeType = detectImageMimeType(buffer);
  if (!detectedMimeType || !ALLOWED_IMAGE_MIME_TYPES.has(detectedMimeType)) {
    throw new ProductImageAssetAdmissionError(
      400,
      "Invalid file type",
      "File content is not a supported image format."
    );
  }
  if (
    declaredMimeType &&
    declaredMimeType !== "application/octet-stream" &&
    declaredMimeType !== "binary/octet-stream" &&
    (!ALLOWED_IMAGE_MIME_TYPES.has(declaredMimeType) ||
      !areCompatibleMimeTypes(declaredMimeType, detectedMimeType))
  ) {
    throw new ProductImageAssetAdmissionError(
      400,
      "Invalid file type",
      `Content type does not match file content (declared: ${declaredMimeType}, detected: ${detectedMimeType}).`
    );
  }
  return detectedMimeType;
};

const resolvePreparedImageMimeType = (declaredMimeType: string): string => {
  const normalizedMimeType = normalizeContentType(declaredMimeType);
  if (!normalizedMimeType) {
    throw new ProductImageAssetAdmissionError(
      400,
      "Invalid request",
      "Upload file mime type is required."
    );
  }
  if (!ALLOWED_IMAGE_MIME_TYPES.has(normalizedMimeType)) {
    throw new ProductImageAssetAdmissionError(
      400,
      "Invalid file type",
      "Upload file is not a supported image format."
    );
  }
  return normalizedMimeType;
};

const resolvePreparedUploadStoragePath = ({
  userId,
  intent,
  filename,
  mimeType,
}: {
  userId: string;
  intent: ProductImageAssetIntent;
  filename: string;
  mimeType: string;
}): string => {
  const extension = resolveMediaStorageExtension(mimeType, "jpg") || "jpg";
  const stem = sanitizeFileStem(filename);
  const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${stem}.${extension}`;
  return assertUserScopedMediaStoragePath({
    path: `${userId}/${PRODUCT_IMAGE_ASSET_STAGING_FOLDER}/${intent}/${uniqueName}`,
    userId,
    label: "Prepared product image asset storage path",
  });
};

const createSignedUploadTarget = async (
  storagePath: string
): Promise<{ path: string; token: string }> => {
  const { data, error } = await getSupabaseAdmin()
    .storage.from(MEDIA_BUCKET)
    .createSignedUploadUrl(storagePath);
  if (error || !data?.path || !data.token) {
    throw new Error(error?.message || "Unable to create signed upload target.");
  }
  return {
    path: data.path,
    token: data.token,
  };
};

const storageDownloadDataToBuffer = async (data: unknown): Promise<Buffer> => {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  if (
    data &&
    typeof data === "object" &&
    "arrayBuffer" in data &&
    typeof data.arrayBuffer === "function"
  ) {
    const arrayBuffer = await (data as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  throw new ProductImageAssetAdmissionError(
    500,
    "Unable to read image asset source",
    "Storage download returned an unsupported data type."
  );
};

const readStorageBuffer = async ({
  userId,
  storagePath,
  expectedPrefix,
}: {
  userId: string;
  storagePath: string;
  expectedPrefix?: string;
}): Promise<Buffer> => {
  const safeStoragePath = assertUserScopedMediaStoragePath({
    path: storagePath,
    userId,
    label: "Product image asset source storage path",
  });
  if (expectedPrefix && !safeStoragePath.startsWith(expectedPrefix)) {
    throw new ProductImageAssetAdmissionError(
      400,
      "Invalid request",
      "Product image asset source is outside the expected namespace."
    );
  }

  const { data, error } = await getSupabaseAdmin()
    .storage.from(MEDIA_BUCKET)
    .download(safeStoragePath);
  if (error || !data) {
    throw new ProductImageAssetAdmissionError(404, "Image asset source not found", error?.message);
  }
  const buffer = await storageDownloadDataToBuffer(data);
  if (buffer.length <= 0) {
    throw new ProductImageAssetAdmissionError(
      400,
      "Invalid request",
      "Image asset source is empty."
    );
  }
  if (buffer.length > PRODUCT_IMAGE_ASSET_TRANSPORT_MAX_BYTES) {
    throw new ProductImageAssetAdmissionError(413, "Upload failed: file too large");
  }
  return buffer;
};

const admitProductImageAssetBufferForUser = async ({
  upload,
  userId,
}: {
  upload: ProductImageAssetUploadInput;
  userId: string;
}): Promise<ProductImageAssetAdmissionResponse> => {
  await assertOwnedDomainTarget({ userId, upload });
  const detectedMimeType = validateImageMimeType({
    declaredMimeType: upload.declaredMimeType,
    buffer: upload.buffer,
  });

  const admittedImage = await admitImageBufferForProductUse({
    buffer: upload.buffer,
    mimeType: detectedMimeType,
    maxBytes: MAX_IMAGE_MEDIA_BYTES,
  });
  if (admittedImage.status === "rejected") {
    throw new ProductImageAssetAdmissionError(
      413,
      "Upload failed: file too large",
      admittedImage.reason === "animated_over_cap" ? admittedImage.userMessage : undefined
    );
  }

  const storagePath = resolveStoragePath({
    userId,
    upload,
    mimeType: admittedImage.mimeType,
  });
  await uploadMediaBufferToStoragePath({
    storagePath,
    buffer: admittedImage.buffer,
    mimeType: admittedImage.mimeType,
  });
  const signedUrl = await createSignedMediaUrl(storagePath);
  const dimensions =
    admittedImage.dimensions ?? extractImageDimensionsFromBuffer(admittedImage.buffer);
  const admissionMetadata: ImageAdmissionMetadata = {
    ...admittedImage.metadata,
    admitted_storage_path: storagePath,
  };

  return {
    bucket: MEDIA_BUCKET,
    url: signedUrl,
    signedUrl,
    storagePath,
    previewStoragePath: storagePath,
    filename: upload.filename,
    mimeType: admittedImage.mimeType,
    size: admittedImage.buffer.length,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    admissionMetadata,
  };
};

export const prepareProductImageAssetUploadForUser = async ({
  userId,
  intent,
  characterId = "",
  characterSheetId = "",
  slotKey = "",
  elementId = "",
  filename,
  declaredMimeType,
}: {
  userId: string;
  intent: string;
  characterId?: string;
  characterSheetId?: string;
  slotKey?: string;
  elementId?: string;
  filename: string;
  declaredMimeType: string;
}): Promise<{ path: string; token: string; mimeType: string; name: string }> => {
  const resolvedIntent = resolveIntent(intent);
  const normalizedFilename = filename.trim() || "upload";
  const normalizedMimeType = resolvePreparedImageMimeType(declaredMimeType);
  await assertOwnedDomainTarget({
    userId,
    upload: {
      buffer: Buffer.alloc(0),
      declaredMimeType: normalizedMimeType,
      filename: normalizedFilename,
      intent: resolvedIntent,
      characterId,
      characterSheetId,
      slotKey,
      elementId,
    },
  });

  const storagePath = resolvePreparedUploadStoragePath({
    userId,
    intent: resolvedIntent,
    filename: normalizedFilename,
    mimeType: normalizedMimeType,
  });
  const target = await createSignedUploadTarget(storagePath);
  return {
    path: target.path,
    token: target.token,
    mimeType: normalizedMimeType,
    name: normalizedFilename,
  };
};

export const finalizePreparedProductImageAssetUploadForUser = async ({
  userId,
  sourceStoragePath,
  intent,
  characterId = "",
  characterSheetId = "",
  slotKey = "",
  elementId = "",
  filename,
  declaredMimeType,
}: {
  userId: string;
  sourceStoragePath: string;
  intent: string;
  characterId?: string;
  characterSheetId?: string;
  slotKey?: string;
  elementId?: string;
  filename: string;
  declaredMimeType: string;
}): Promise<ProductImageAssetAdmissionResponse> => {
  const resolvedIntent = resolveIntent(intent);
  const normalizedFilename = filename.trim() || "upload";
  const normalizedMimeType = resolvePreparedImageMimeType(declaredMimeType);
  if (!sourceStoragePath.trim()) {
    throw new ProductImageAssetAdmissionError(
      400,
      "Invalid request",
      "Image asset source storage path is required."
    );
  }
  const safeStoragePath = assertUserScopedMediaStoragePath({
    path: sourceStoragePath,
    userId,
    label: "Prepared product image asset storage path",
  });
  const expectedPrefix = `${userId}/${PRODUCT_IMAGE_ASSET_STAGING_FOLDER}/`;
  try {
    const buffer = await readStorageBuffer({
      userId,
      storagePath: safeStoragePath,
      expectedPrefix,
    });
    return await admitProductImageAssetBufferForUser({
      userId,
      upload: {
        buffer,
        declaredMimeType: normalizedMimeType,
        filename: normalizedFilename,
        intent: resolvedIntent,
        characterId,
        characterSheetId,
        slotKey,
        elementId,
      },
    });
  } finally {
    try {
      await getSupabaseAdmin().storage.from(MEDIA_BUCKET).remove([safeStoragePath]);
    } catch {
      // Staging cleanup is best-effort; keep the real admission error visible.
    }
  }
};

export const admitProductImageAssetFromStorageForUser = async ({
  userId,
  sourceStoragePath,
  intent,
  characterId = "",
  characterSheetId = "",
  slotKey = "",
  elementId = "",
  filename,
  declaredMimeType = "",
}: {
  userId: string;
  sourceStoragePath: string;
  intent: string;
  characterId?: string;
  characterSheetId?: string;
  slotKey?: string;
  elementId?: string;
  filename?: string;
  declaredMimeType?: string;
}): Promise<ProductImageAssetAdmissionResponse> => {
  const resolvedIntent = resolveIntent(intent);
  if (!sourceStoragePath.trim()) {
    throw new ProductImageAssetAdmissionError(
      400,
      "Invalid request",
      "Image asset source storage path is required."
    );
  }
  const buffer = await readStorageBuffer({
    userId,
    storagePath: sourceStoragePath,
  });
  const detectedMimeType = validateImageMimeType({
    declaredMimeType: "",
    buffer,
  });
  const normalizedFilename =
    filename?.trim() ||
    sourceStoragePath.split("/").filter(Boolean).pop() ||
    `reference.${resolveMediaStorageExtension(detectedMimeType, "jpg")}`;

  return await admitProductImageAssetBufferForUser({
    userId,
    upload: {
      buffer,
      declaredMimeType: normalizeContentType(declaredMimeType) || detectedMimeType,
      filename: normalizedFilename,
      intent: resolvedIntent,
      characterId,
      characterSheetId,
      slotKey,
      elementId,
    },
  });
};
