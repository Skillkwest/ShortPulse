/**
 * Prepare a browser-direct upload target for allowlisted product image assets.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { enforceApiRateLimit } from "../../../lib/server/api/rateLimit";
import {
  prepareProductImageAssetUploadForUser,
  ProductImageAssetAdmissionError,
} from "../../../lib/server/productImageAssetAdmission";

type PrepareProductImageAssetUploadRequestBody = {
  characterId?: unknown;
  characterSheetId?: unknown;
  elementId?: unknown;
  intent?: unknown;
  slotKey?: unknown;
  sourceMimeType?: unknown;
  sourceName?: unknown;
};

type PrepareProductImageAssetUploadSuccessResponse = {
  target: {
    storagePath: string;
    uploadToken: string;
    mimeType: string;
    name: string;
  };
};

type PrepareProductImageAssetUploadErrorResponse = {
  error: string;
  details?: string;
};

const PREPARE_PRODUCT_IMAGE_ASSET_UPLOAD_RATE_LIMIT = {
  keyPrefix: "product-image-asset-prepare-upload",
  maxRequests: 20,
  windowMs: 10 * 60 * 1000,
} as const;

const normalizeOptionalString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    PrepareProductImageAssetUploadSuccessResponse | PrepareProductImageAssetUploadErrorResponse
  >
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "media-prepare-product-image-asset-upload.auth",
      scope: "app",
    });
    return res.status(500).json({ error: "Unable to prepare image asset upload" });
  }
  if (!user) return;
  if (
    !enforceApiRateLimit(req, res, {
      ...PREPARE_PRODUCT_IMAGE_ASSET_UPLOAD_RATE_LIMIT,
      keyPrefix: `${PREPARE_PRODUCT_IMAGE_ASSET_UPLOAD_RATE_LIMIT.keyPrefix}:${user.id}`,
    })
  ) {
    return;
  }

  try {
    const body = (req.body ?? {}) as PrepareProductImageAssetUploadRequestBody;
    const prepared = await prepareProductImageAssetUploadForUser({
      userId: user.id,
      intent: normalizeOptionalString(body.intent),
      characterId: normalizeOptionalString(body.characterId),
      characterSheetId: normalizeOptionalString(body.characterSheetId),
      slotKey: normalizeOptionalString(body.slotKey),
      elementId: normalizeOptionalString(body.elementId),
      filename: normalizeOptionalString(body.sourceName),
      declaredMimeType: normalizeOptionalString(body.sourceMimeType).toLowerCase(),
    });

    return res.status(200).json({
      target: {
        storagePath: prepared.path,
        uploadToken: prepared.token,
        mimeType: prepared.mimeType,
        name: prepared.name,
      },
    });
  } catch (error) {
    if (error instanceof ProductImageAssetAdmissionError) {
      if (error.status >= 500) {
        await logApiRouteException({
          req,
          error,
          routeLabel: "media-prepare-product-image-asset-upload",
          user,
        });
        return res.status(500).json({ error: "Unable to prepare image asset upload" });
      }
      return res.status(error.status).json({
        error: error.message,
        details: error.details,
      });
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "media-prepare-product-image-asset-upload",
      user,
    });
    return res.status(500).json({ error: "Unable to prepare image asset upload" });
  }
}
