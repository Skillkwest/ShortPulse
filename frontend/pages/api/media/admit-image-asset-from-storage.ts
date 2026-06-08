/**
 * Admit a product image asset by copying bytes from an owned storage path.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { enforceApiRateLimit } from "../../../lib/server/api/rateLimit";
import {
  admitProductImageAssetFromStorageForUser,
  ProductImageAssetAdmissionError,
  type ProductImageAssetAdmissionResponse,
} from "../../../lib/server/productImageAssetAdmission";

type AdmitImageAssetFromStorageRequestBody = {
  characterId?: unknown;
  characterSheetId?: unknown;
  elementId?: unknown;
  intent?: unknown;
  slotKey?: unknown;
  sourceMimeType?: unknown;
  sourceName?: unknown;
  sourceStoragePath?: unknown;
};

type AdmitImageAssetFromStorageSuccessResponse = {
  asset: ProductImageAssetAdmissionResponse;
};

type AdmitImageAssetFromStorageErrorResponse = {
  error: string;
  details?: string;
};

const ADMIT_IMAGE_ASSET_FROM_STORAGE_RATE_LIMIT = {
  keyPrefix: "product-image-asset-from-storage",
  maxRequests: 20,
  windowMs: 10 * 60 * 1000,
} as const;

const normalizeOptionalString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    AdmitImageAssetFromStorageSuccessResponse | AdmitImageAssetFromStorageErrorResponse
  >
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;
  if (
    !enforceApiRateLimit(req, res, {
      ...ADMIT_IMAGE_ASSET_FROM_STORAGE_RATE_LIMIT,
      keyPrefix: `${ADMIT_IMAGE_ASSET_FROM_STORAGE_RATE_LIMIT.keyPrefix}:${user.id}`,
    })
  ) {
    return;
  }

  try {
    const body = (req.body ?? {}) as AdmitImageAssetFromStorageRequestBody;
    const asset = await admitProductImageAssetFromStorageForUser({
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
          routeLabel: "media-admit-image-asset-from-storage",
          user,
        });
        return res.status(500).json({ error: "Unable to admit image asset" });
      }
      return res.status(error.status).json({
        error: error.message,
        details: error.details,
      });
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "media-admit-image-asset-from-storage",
      user,
    });
    return res.status(500).json({ error: "Unable to admit image asset" });
  }
}
