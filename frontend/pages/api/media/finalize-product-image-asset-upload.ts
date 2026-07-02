/**
 * Finalize a browser-direct product image asset upload after storage staging.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { enforceApiRateLimit } from "../../../lib/server/api/rateLimit";
import {
  finalizePreparedProductImageAssetUploadForUser,
  ProductImageAssetAdmissionError,
  type ProductImageAssetAdmissionResponse,
} from "../../../lib/server/productImageAssetAdmission";

type FinalizeProductImageAssetUploadRequestBody = {
  characterId?: unknown;
  characterSheetId?: unknown;
  elementId?: unknown;
  intent?: unknown;
  slotKey?: unknown;
  sourceMimeType?: unknown;
  sourceName?: unknown;
  sourceStoragePath?: unknown;
};

type FinalizeProductImageAssetUploadSuccessResponse = {
  asset: ProductImageAssetAdmissionResponse;
};

type FinalizeProductImageAssetUploadErrorResponse = {
  error: string;
  details?: string;
  code?: string;
};

const FINALIZE_PRODUCT_IMAGE_ASSET_UPLOAD_RATE_LIMIT = {
  keyPrefix: "product-image-asset-finalize-upload",
  maxRequests: 20,
  windowMs: 10 * 60 * 1000,
} as const;

const normalizeOptionalString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    FinalizeProductImageAssetUploadSuccessResponse | FinalizeProductImageAssetUploadErrorResponse
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
      routeLabel: "media-finalize-product-image-asset-upload.auth",
      scope: "app",
    });
    return res.status(500).json({ error: "Unable to finalize image asset upload" });
  }
  if (!user) return;
  if (
    !enforceApiRateLimit(req, res, {
      ...FINALIZE_PRODUCT_IMAGE_ASSET_UPLOAD_RATE_LIMIT,
      keyPrefix: `${FINALIZE_PRODUCT_IMAGE_ASSET_UPLOAD_RATE_LIMIT.keyPrefix}:${user.id}`,
    })
  ) {
    return;
  }

  try {
    const body = (req.body ?? {}) as FinalizeProductImageAssetUploadRequestBody;
    const asset = await finalizePreparedProductImageAssetUploadForUser({
      userId: user.id,
      sourceStoragePath: normalizeOptionalString(body.sourceStoragePath),
      intent: normalizeOptionalString(body.intent),
      characterId: normalizeOptionalString(body.characterId),
      characterSheetId: normalizeOptionalString(body.characterSheetId),
      slotKey: normalizeOptionalString(body.slotKey),
      elementId: normalizeOptionalString(body.elementId),
      filename: normalizeOptionalString(body.sourceName),
      declaredMimeType: normalizeOptionalString(body.sourceMimeType).toLowerCase(),
    });

    return res.status(200).json({ asset });
  } catch (error) {
    if (error instanceof ProductImageAssetAdmissionError) {
      if (error.status >= 500) {
        await logApiRouteException({
          req,
          error,
          routeLabel: "media-finalize-product-image-asset-upload",
          user,
        });
        return res.status(500).json({ error: "Unable to finalize image asset upload" });
      }
      return res.status(error.status).json({
        error: error.message,
        ...(error.details ? { details: error.details } : {}),
        ...(error.code ? { code: error.code } : {}),
      });
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "media-finalize-product-image-asset-upload",
      user,
    });
    return res.status(500).json({ error: "Unable to finalize image asset upload" });
  }
}
