import type { NextApiRequest, NextApiResponse } from "next";
import {
  normalizeBuiltInStyleDefinitions,
  normalizeBuiltInStyleId,
} from "../../../../lib/model-runtime/builtInStyles";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import {
  BuiltInStyleCatalogVersionMismatchError,
  resolveBuiltInStyleCatalogForAdmin,
  saveBuiltInStyleCatalog,
} from "../../../../lib/server/api/builtInStyleControlPlane";

const validateStyleDefinitionsPayload = (
  value: unknown
):
  | {
      ok: true;
      styleDefinitions: ReturnType<typeof normalizeBuiltInStyleDefinitions>;
    }
  | { ok: false; message: string } => {
  if (!Array.isArray(value)) {
    return { ok: false, message: "styleDefinitions must be an array." };
  }
  const normalized = normalizeBuiltInStyleDefinitions(value);
  if (normalized.length !== value.length) {
    return {
      ok: false,
      message:
        "Each built-in style must have a unique style id, title, style prompt, and preview image URL.",
    };
  }
  const hasNonCanonicalStyleId = normalized.some(
    (definition) => normalizeBuiltInStyleId(definition.styleId) !== definition.styleId
  );
  if (hasNonCanonicalStyleId) {
    return {
      ok: false,
      message:
        "Each built-in style id must be lowercase, hyphenated, unique, and within the style id length limit.",
    };
  }
  return { ok: true, styleDefinitions: normalized };
};

const validateExpectedUpdatedAt = (
  value: unknown
): { ok: true; expectedUpdatedAt: string | null } | { ok: false; message: string } => {
  if (value === undefined) {
    return {
      ok: false,
      message:
        "expectedUpdatedAt is required so non-live catalog content cannot overwrite live built-in Styles.",
    };
  }
  if (value === null) {
    return { ok: true, expectedUpdatedAt: null };
  }
  if (typeof value !== "string") {
    return { ok: false, message: "expectedUpdatedAt must be a string or null." };
  }
  const normalized = value.trim();
  return { ok: true, expectedUpdatedAt: normalized.length > 0 ? normalized : null };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api/admin/agent-instructions/built-in-styles.auth",
    });
    return res.status(500).json({ error: "Failed to load built-in Styles." });
  }
  if (!adminUser) return;
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method === "GET") {
    try {
      const activeCatalog = await resolveBuiltInStyleCatalogForAdmin();
      return res.status(200).json({
        styleDefinitions: activeCatalog.styleDefinitions,
        updatedAt: activeCatalog.updatedAt,
        updatedByEmail: activeCatalog.updatedByEmail,
        source: activeCatalog.source,
        degraded: activeCatalog.degraded,
      });
    } catch (error) {
      await logApiRouteException({
        req,
        error,
        routeLabel: "api/admin/agent-instructions/built-in-styles",
        user: adminUser,
      });
      return res.status(500).json({ error: "Failed to load built-in Styles." });
    }
  }

  if (req.method === "PUT") {
    const parsed = validateStyleDefinitionsPayload(req.body?.styleDefinitions);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.message });
    }
    const expectedUpdatedAt = validateExpectedUpdatedAt(req.body?.expectedUpdatedAt);
    if (!expectedUpdatedAt.ok) {
      return res.status(400).json({ error: expectedUpdatedAt.message });
    }

    try {
      const savedCatalog = await saveBuiltInStyleCatalog({
        styleDefinitions: parsed.styleDefinitions,
        expectedUpdatedAt: expectedUpdatedAt.expectedUpdatedAt,
        actorUserId: adminUser.id,
        actorEmail: adminUser.email ?? null,
      });
      return res.status(200).json({
        styleDefinitions: savedCatalog.styleDefinitions,
        updatedAt: savedCatalog.updatedAt,
        updatedByEmail: savedCatalog.updatedByEmail,
        source: "control_plane",
        degraded: false,
      });
    } catch (error) {
      if (error instanceof BuiltInStyleCatalogVersionMismatchError) {
        return res.status(409).json({
          error: "The built-in Styles catalog changed since you loaded it. Reload and try again.",
          code: "CATALOG_STALE",
        });
      }
      await logApiRouteException({
        req,
        error,
        routeLabel: "api/admin/agent-instructions/built-in-styles",
        user: adminUser,
      });
      return res.status(500).json({ error: "Failed to save built-in Styles." });
    }
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ error: "Method not allowed" });
}
