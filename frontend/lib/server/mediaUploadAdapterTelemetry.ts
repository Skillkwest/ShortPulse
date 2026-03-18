import type { NextApiRequest } from "next";
import { writeAppErrorLog } from "./api/appErrorLogs";

type LegacyUploadAdapterRoute = "upload-image" | "upload-video";

type LegacyUploadAdapterUsageParams = {
  req: NextApiRequest;
  routeLabel: LegacyUploadAdapterRoute;
  userId: string;
  userEmail?: string | null;
  fileSize: number;
  storagePath: string;
};

const TELEMETRY_SOURCE_BY_ROUTE: Record<LegacyUploadAdapterRoute, string> = {
  "upload-image": "telemetry.media.upload_adapter.upload_image_used",
  "upload-video": "telemetry.media.upload_adapter.upload_video_used",
};

export const logLegacyUploadAdapterUsage = async ({
  req,
  routeLabel,
  userId,
  userEmail = null,
  fileSize,
  storagePath,
}: LegacyUploadAdapterUsageParams): Promise<void> => {
  await writeAppErrorLog({
    source: TELEMETRY_SOURCE_BY_ROUTE[routeLabel],
    scope: "app",
    severity: "low",
    message: "Legacy media upload adapter used",
    route: routeLabel,
    endpoint: req.url ?? null,
    userId,
    userEmail,
    metadata: {
      method: req.method ?? null,
      route_label: routeLabel,
      file_size: fileSize,
      storage_path: storagePath,
    },
  });
};
