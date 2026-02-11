/**
 * Uploads local reference images into user-scoped private storage.
 * Returns a short-lived signed URL so providers can fetch the image.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import { requireApiUser } from "./_utils/auth";
import { logApiRouteException } from "./_utils/appErrorLogs";
import { getSupabaseAdmin } from "./_utils/supabaseAdmin";

type UploadImageResponse = {
  url: string;
  path: string;
  size: number;
};

type ErrorResponse = {
  error: string;
  details?: string;
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

const parseForm = async (req: NextApiRequest): Promise<formidable.File> => {
  const form = formidable({
    maxFileSize: 25 * 1024 * 1024,
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

  let parsedFile: formidable.File | null = null;
  try {
    parsedFile = await parseForm(req);
    const mimeType = parsedFile.mimetype ?? "";
    if (!ALLOWED_TYPES.has(mimeType)) {
      return res.status(400).json({
        error: "Invalid file type",
        details: "Only JPEG, PNG, WEBP, GIF, HEIC, HEIF, and AVIF images are supported.",
      });
    }

    const fileBuffer = fs.readFileSync(parsedFile.filepath);
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
      size: parsedFile.size ?? 0,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "upload-image",
      user,
      metadata: {
        has_parsed_file: Boolean(parsedFile),
      },
    });
    return res.status(500).json({
      error: "Upload failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    if (parsedFile?.filepath) {
      try {
        fs.unlinkSync(parsedFile.filepath);
      } catch {
        // best-effort temp file cleanup
      }
    }
  }
}
