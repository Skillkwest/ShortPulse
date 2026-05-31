/**
 * Allowlisted product-image asset admission API.
 * Authenticates the user and stores admitted image assets in server-owned paths.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { enforceApiRateLimit } from "../../../lib/server/api/rateLimit";
import {
  admitProductImageAssetUploadForUser,
  ProductImageAssetAdmissionError,
  type ProductImageAssetAdmissionResponse,
} from "../../../lib/server/productImageAssetAdmission";

type AdmitImageAssetSuccessResponse = {
  asset: ProductImageAssetAdmissionResponse;
};

type AdmitImageAssetErrorResponse = {
  error: string;
  details?: string;
};

export const config = {
  api: {
    bodyParser: false,
  },
};

const PRODUCT_IMAGE_ASSET_RATE_LIMIT = {
  keyPrefix: "product-image-asset-admission",
  maxRequests: 12,
  windowMs: 10 * 60 * 1000,
} as const;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdmitImageAssetSuccessResponse | AdmitImageAssetErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;
  if (
    !enforceApiRateLimit(req, res, {
      ...PRODUCT_IMAGE_ASSET_RATE_LIMIT,
      keyPrefix: `${PRODUCT_IMAGE_ASSET_RATE_LIMIT.keyPrefix}:${user.id}`,
    })
  ) {
    return;
  }

  try {
    const asset = await admitProductImageAssetUploadForUser({
      req,
      userId: user.id,
    });
    return res.status(200).json({ asset });
  } catch (error) {
    if (error instanceof ProductImageAssetAdmissionError) {
      if (error.status >= 500) {
        await logApiRouteException({
          req,
          error,
          routeLabel: "media-admit-image-asset",
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
      routeLabel: "media-admit-image-asset",
      user,
    });

    return res.status(500).json({
      error: "Unable to admit image asset",
    });
  }
}
