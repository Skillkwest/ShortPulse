/**
 * Uploads local reference images into user-scoped private storage.
 * Returns a short-lived signed URL so providers can fetch the image.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import { requireApiUser } from "../../lib/server/api/auth";
import { logApiRouteException } from "../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../lib/server/api/supabaseAdmin";
import { areCompatibleMimeTypes, detectImageMimeType } from "../../lib/server/uploadSignature";

type UploadImageResponse = {
  url: string;
  path: string;
  size: number;
};

type ErrorResponse = {
  error: string;
  details?: string;
};

type ParsedUpload = {
  buffer: Buffer;
  mimeType: string;
  size: number;
  tempFilePath?: string;
};

export const config = {
  api: {
    bodyParser: false,
  },
};

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/avif",
]);

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
};

const MAX_IMAGE_UPLOAD_BYTES = 25 * 1024 * 1024;

const parseForm = async (req: NextApiRequest): Promise<formidable.File> => {
  const form = formidable({
    maxFileSize: MAX_IMAGE_UPLOAD_BYTES,
    keepExtensions: true,
  });
  const [, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
    form.parse(req, (err, fields, parsedFiles) => {
      if (err) {
        reject(err);
        return;
      }
      resolve([fields, parsedFiles]);
    });
  });

  const fileInput = files.file;
  if (!fileInput) {
    throw new Error("No file uploaded.");
  }
  return Array.isArray(fileInput) ? fileInput[0] : fileInput;
};

const readRawBody = async (req: NextApiRequest): Promise<Buffer> =>
  await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;

    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
      req.off("aborted", onAborted);
      callback();
    };

    const onData = (chunk: Buffer | string) => {
      const chunkBuffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      totalBytes += chunkBuffer.length;
      if (totalBytes > MAX_IMAGE_UPLOAD_BYTES) {
        settle(() => reject(new Error("File exceeds 25MB limit.")));
        req.destroy();
        return;
      }
      chunks.push(chunkBuffer);
    };

    const onEnd = () => {
      settle(() => resolve(Buffer.concat(chunks)));
    };

    const onError = (error: Error) => {
      settle(() => reject(error));
    };

    const onAborted = () => {
      settle(() => reject(new Error("Upload stream was aborted before completion.")));
    };

    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
    req.on("aborted", onAborted);
  });

const normalizeContentType = (value: string | string[] | undefined): string => {
  const header = Array.isArray(value) ? value[0] : value;
  return header?.split(";")[0]?.trim().toLowerCase() ?? "";
};

const parseUpload = async (req: NextApiRequest): Promise<ParsedUpload> => {
  const contentType = normalizeContentType(req.headers["content-type"]);
  if (contentType.includes("multipart/form-data")) {
    const parsedFile = await parseForm(req);
    return {
      buffer: fs.readFileSync(parsedFile.filepath),
      mimeType: parsedFile.mimetype?.toLowerCase() ?? "",
      size: parsedFile.size ?? 0,
      tempFilePath: parsedFile.filepath,
    };
  }

  if (!contentType) {
    throw new Error("Missing content type.");
  }

  const buffer = await readRawBody(req);
  if (!buffer.length) {
    throw new Error("No file uploaded.");
  }

  return {
    buffer,
    mimeType: contentType,
    size: buffer.length,
  };
};

/**
 * Handles image uploads for generation references.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadImageResponse | ErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  let parsedUpload: ParsedUpload | null = null;
  try {
    parsedUpload = await parseUpload(req);
    const declaredMimeType = parsedUpload.mimeType;
    const detectedMimeType = detectImageMimeType(parsedUpload.buffer);
    if (!detectedMimeType || !ALLOWED_TYPES.has(detectedMimeType)) {
      return res.status(400).json({
        error: "Invalid file type",
        details: "File content is not a supported image format.",
      });
    }
    if (
      declaredMimeType &&
      (!ALLOWED_TYPES.has(declaredMimeType) ||
        !areCompatibleMimeTypes(declaredMimeType, detectedMimeType))
    ) {
      return res.status(400).json({
        error: "Invalid file type",
        details: "Content type does not match file content.",
      });
    }

    const fileBuffer = parsedUpload.buffer;
    const mimeType = detectedMimeType;
    const extension = EXTENSION_BY_MIME[mimeType] ?? "jpg";
    const storagePath = `${user.id}/images/reference/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    const supabaseAdmin = getSupabaseAdmin();
    const { error: uploadError } = await supabaseAdmin.storage
      .from("media_library")
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      return res.status(500).json({ error: "Upload failed", details: uploadError.message });
    }

    const { data: signedUrl, error: signedUrlError } = await supabaseAdmin.storage
      .from("media_library")
      .createSignedUrl(storagePath, 3600);

    if (signedUrlError || !signedUrl?.signedUrl) {
      return res.status(500).json({
        error: "Failed to generate signed URL",
        details: signedUrlError?.message ?? "Unknown error",
      });
    }

    return res.status(200).json({
      url: signedUrl.signedUrl,
      path: storagePath,
      size: parsedUpload.size,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    const normalizedDetails = details.toLowerCase();
    const isPayloadTooLarge =
      details.includes("25MB") ||
      normalizedDetails.includes("maxfilesize") ||
      normalizedDetails.includes("maxtotalfilesize") ||
      normalizedDetails.includes("max file size") ||
      normalizedDetails.includes("file too large");

    await logApiRouteException({
      req,
      error,
      routeLabel: "upload-image",
      user,
      metadata: {
        has_parsed_upload: Boolean(parsedUpload),
      },
    });
    return res.status(isPayloadTooLarge ? 413 : 500).json({
      error: isPayloadTooLarge ? "Upload failed: file too large" : "Upload failed",
      details,
    });
  } finally {
    if (parsedUpload?.tempFilePath) {
      try {
        fs.unlinkSync(parsedUpload.tempFilePath);
      } catch {
        // best-effort temp file cleanup
      }
    }
  }
}
