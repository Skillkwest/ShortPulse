import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  isAuthoritativeCreatePulseBuiltInCatalogResolution,
  resolveRuntimeCreatePulseBuiltInCatalog,
} from "../../../lib/server/api/createPulseBuiltInControlPlane";

type RuntimeCreatePulseBuiltInCatalog = Awaited<
  ReturnType<typeof resolveRuntimeCreatePulseBuiltInCatalog>
>;
type RuntimeCreatePulseBuiltInDefinition =
  RuntimeCreatePulseBuiltInCatalog["builtInDefinitions"][number];

const toPublicCreatePulseBuiltInDefinition = (definition: RuntimeCreatePulseBuiltInDefinition) => ({
  presetId: definition.presetId,
  label: definition.label,
  description: definition.description,
  systemInstructions: definition.systemInstructions,
  pulseKind: definition.pulseKind,
  runtimeMode: definition.runtimeMode,
  activationMode: definition.activationMode,
  outputMode: definition.outputMode,
  artifactTarget: definition.artifactTarget,
  memoryPolicy: definition.memoryPolicy,
  schemaVersion: definition.schemaVersion,
  publicationStatus: definition.publicationStatus,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api/ai/create-pulse-builtins.auth",
      scope: "app",
    });
    return res.status(500).json({ error: "Failed to load Create Pulse built-ins." });
  }
  if (!user) return;

  try {
    const builtInCatalog = await resolveRuntimeCreatePulseBuiltInCatalog({ bypassCache: true });
    if (!isAuthoritativeCreatePulseBuiltInCatalogResolution(builtInCatalog)) {
      return res.status(503).json({
        error: "Create Pulse built-ins are temporarily unavailable. Reload and try again.",
        source: builtInCatalog.source,
        degraded: builtInCatalog.degraded,
      });
    }
    const publishedBuiltInDefinitions = builtInCatalog.builtInDefinitions
      .filter((definition) => definition.publicationStatus !== "draft")
      .map(toPublicCreatePulseBuiltInDefinition);
    return res.status(200).json({
      builtInDefinitions: publishedBuiltInDefinitions,
      source: builtInCatalog.source,
      updatedAt: builtInCatalog.updatedAt,
      updatedByEmail: builtInCatalog.updatedByEmail,
      degraded: builtInCatalog.degraded,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api/ai/create-pulse-builtins",
      user,
    });
    return res.status(500).json({ error: "Failed to load Create Pulse built-ins." });
  }
}
