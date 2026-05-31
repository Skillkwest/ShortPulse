/**
 * Server-side allowlisted product-image asset admission.
 * Used by domain surfaces that need storage-backed image assets without trusting client paths.
 */
import crypto from "crypto";
import fs from "fs";
import formidable from "formidable";
import type { NextApiRequest } from "next";
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

type ParsedProductImageAssetUpload = {
  buffer: Buffer;
  declaredMimeType: string;
  filename: string;
  intent: ProductImageAssetIntent;
  characterId: string;
  characterSheetId: string;
  slotKey: string;
  elementId: string;
  tempFilePath?: string;
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

const readFieldString = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
};

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
  upload: ParsedProductImageAssetUpload;
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
  upload: ParsedProductImageAssetUpload;
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

export const parseProductImageAssetUpload = async (
  req: NextApiRequest
): Promise<ParsedProductImageAssetUpload> => {
  const form = formidable({
    maxFileSize: PRODUCT_IMAGE_ASSET_TRANSPORT_MAX_BYTES,
    keepExtensions: true,
  });

  let fields: formidable.Fields;
  let files: formidable.Files;
  try {
    [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>(
      (resolve, reject) => {
        form.parse(req, (error, parsedFields, parsedFiles) => {
          if (error) {
            reject(error);
            return;
          }
          resolve([parsedFields, parsedFiles]);
        });
      }
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "httpCode" in error &&
      (error as { httpCode?: number }).httpCode === 413
    ) {
      throw new ProductImageAssetAdmissionError(413, "Upload failed: file too large");
    }
    throw error;
  }

  const fileInput = files.file;
  if (!fileInput) {
    throw new ProductImageAssetAdmissionError(400, "Upload failed", "No file uploaded");
  }
  const parsedFile = Array.isArray(fileInput) ? fileInput[0] : fileInput;

  return {
    buffer: fs.readFileSync(parsedFile.filepath),
    declaredMimeType: normalizeContentType(parsedFile.mimetype ?? ""),
    filename: parsedFile.originalFilename?.trim() || "upload",
    intent: resolveIntent(
      readFieldString(fields.intent as string | string[] | undefined) ||
        readFieldString(fields.surface as string | string[] | undefined)
    ),
    characterId: readFieldString(fields.characterId as string | string[] | undefined),
    characterSheetId: readFieldString(fields.characterSheetId as string | string[] | undefined),
    slotKey: readFieldString(fields.slotKey as string | string[] | undefined),
    elementId: readFieldString(fields.elementId as string | string[] | undefined),
    tempFilePath: parsedFile.filepath,
  };
};

export const admitProductImageAssetUploadForUser = async ({
  req,
  userId,
}: {
  req: NextApiRequest;
  userId: string;
}): Promise<ProductImageAssetAdmissionResponse> => {
  const parsedUpload = await parseProductImageAssetUpload(req);
  try {
    await assertOwnedDomainTarget({ userId, upload: parsedUpload });
    const detectedMimeType = validateImageMimeType({
      declaredMimeType: parsedUpload.declaredMimeType,
      buffer: parsedUpload.buffer,
    });

    const admittedImage = await admitImageBufferForProductUse({
      buffer: parsedUpload.buffer,
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
      upload: parsedUpload,
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
      filename: parsedUpload.filename,
      mimeType: admittedImage.mimeType,
      size: admittedImage.buffer.length,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      admissionMetadata,
    };
  } finally {
    if (parsedUpload.tempFilePath) {
      try {
        fs.unlinkSync(parsedUpload.tempFilePath);
      } catch {
        // best-effort temp file cleanup
      }
    }
  }
};
