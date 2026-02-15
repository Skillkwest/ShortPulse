/**
 * Uploads motion-control source videos into user-scoped private storage.
 * Requires an authenticated Supabase bearer token and keeps paths under `<user_id>/`.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import { requireApiUser } from "../../lib/server/api/auth";
import { logApiRouteException } from "../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../lib/server/api/supabaseAdmin";
import { areCompatibleMimeTypes, detectVideoMimeType } from "../../lib/server/uploadSignature";
import { assertUserScopedMediaStoragePath } from "../../lib/mediaStoragePath";

type UploadResponse = {
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

const ALLOWED_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"]);
const EXTENSION_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
};

const parseForm = async (req: NextApiRequest): Promise<formidable.File> => {
  const form = formidable({
    maxFileSize: 100 * 1024 * 1024,
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
  const file = Array.isArray(fileInput) ? fileInput[0] : fileInput;
  return file;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse | ErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) {
    return;
  }

  let parsedFile: formidable.File | null = null;
  try {
    parsedFile = await parseForm(req);
    const declaredMimeType = parsedFile.mimetype?.toLowerCase() ?? "";
    const fileBuffer = fs.readFileSync(parsedFile.filepath);
    const detectedMimeType = detectVideoMimeType(fileBuffer);
    if (!detectedMimeType || !ALLOWED_TYPES.has(detectedMimeType)) {
      return res.status(400).json({
        error: "Invalid file type",
        details: "File content is not a supported video format.",
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

    const mimeType = detectedMimeType;
    const extension = EXTENSION_BY_MIME[mimeType] ?? "mp4";
    const storagePath = assertUserScopedMediaStoragePath({
      path: `${user.id}/videos/motion-control/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`,
      userId: user.id,
      label: "Motion control upload storage path",
    });

    const supabaseAdmin = getSupabaseAdmin();
    const { error: uploadError } = await supabaseAdmin.storage
      .from("media_library")
      .upload(storagePath, fileBuffer, {
        contentType: mimeType || "video/mp4",
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
      routeLabel: "upload-video",
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
