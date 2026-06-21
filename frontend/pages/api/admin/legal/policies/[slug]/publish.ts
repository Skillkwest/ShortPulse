/**
 * Admin legal policy publication API.
 * Publishes a new version of one legal document through the service-role control plane.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { isLegalPolicySlug } from "../../../../../../features/legal/data/legalPolicies";
import { logApiRouteException } from "../../../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../../../lib/server/api/auth";
import {
  LegalPolicyVersionMismatchError,
  publishLegalPolicy,
} from "../../../../../../lib/server/api/legalPolicyControlPlane";

const MAX_NOTE_LENGTH = 400;

const normalizeOptionalText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
};

const validateMarkdown = (
  value: unknown
): { ok: true; markdown: string } | { ok: false; message: string } => {
  if (typeof value !== "string") {
    return { ok: false, message: "markdown must be a string." };
  }
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return { ok: false, message: "Legal policy markdown cannot be empty." };
  }
  return { ok: true, markdown: `${normalized}\n` };
};

const validateExpectedUpdatedAt = (
  value: unknown
): { ok: true; expectedUpdatedAt: string | null } | { ok: false; message: string } => {
  if (value === undefined) {
    return {
      ok: false,
      message:
        "expectedUpdatedAt is required so stale legal policy drafts cannot overwrite the active document.",
    };
  }
  if (value === null) return { ok: true, expectedUpdatedAt: null };
  if (typeof value !== "string") {
    return { ok: false, message: "expectedUpdatedAt must be a string or null." };
  }
  const normalized = value.trim();
  return { ok: true, expectedUpdatedAt: normalized || null };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const slug = Array.isArray(req.query.slug) ? req.query.slug[0] : req.query.slug;
  if (!isLegalPolicySlug(slug)) {
    return res.status(400).json({ error: "Invalid legal policy slug." });
  }

  let adminUser;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/legal/policies/[slug]/publish.auth",
    });
    return res.status(500).json({ error: "Unable to publish legal policy." });
  }
  if (!adminUser) return;
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const markdown = validateMarkdown(req.body?.markdown);
  if (!markdown.ok) {
    return res.status(400).json({ error: markdown.message });
  }
  const expectedUpdatedAt = validateExpectedUpdatedAt(req.body?.expectedUpdatedAt);
  if (!expectedUpdatedAt.ok) {
    return res.status(400).json({ error: expectedUpdatedAt.message });
  }

  try {
    const policy = await publishLegalPolicy({
      slug,
      markdown: markdown.markdown,
      expectedUpdatedAt: expectedUpdatedAt.expectedUpdatedAt,
      note: normalizeOptionalText(req.body?.note, MAX_NOTE_LENGTH),
      actorUserId: adminUser.id,
      actorEmail: adminUser.email ?? null,
    });
    return res.status(200).json({ ok: true, policy });
  } catch (error) {
    if (
      error instanceof LegalPolicyVersionMismatchError ||
      (error instanceof Error && error.name === "LegalPolicyVersionMismatchError")
    ) {
      return res.status(409).json({
        code: "LEGAL_POLICY_STALE",
        error: "This legal policy changed since you loaded it. Refresh and try again.",
      });
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/legal/policies/[slug]/publish",
      user: adminUser,
    });
    return res.status(500).json({ error: "Unable to publish legal policy." });
  }
}
