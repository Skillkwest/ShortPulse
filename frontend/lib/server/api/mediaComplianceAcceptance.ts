/**
 * Server-side media-compliance acceptance helpers.
 * Reads and writes versioned user acceptance records through the Supabase admin client.
 */
import type { NextApiRequest } from "next";
import { MEDIA_COMPLIANCE_AGREEMENT } from "../../compliance/mediaAgreement";
import { getSupabaseAdmin } from "./supabaseAdmin";

const MEDIA_COMPLIANCE_TABLE = "user_media_compliance_acceptances";
const MEDIA_COMPLIANCE_UPSERT_CONFLICT = "user_id,agreement_key,agreement_version";
const MAX_IP_ADDRESS_LENGTH = 255;
const MAX_USER_AGENT_LENGTH = 1000;

export type MediaComplianceAcceptanceStatus = {
  accepted: boolean;
  acceptedAt: string | null;
};

const normalizeOptionalString = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

const readHeaderValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return normalizeOptionalString(value[0], MAX_IP_ADDRESS_LENGTH);
  }
  if (typeof value !== "string") {
    return null;
  }
  const firstValue = value.split(",")[0]?.trim() ?? value;
  return normalizeOptionalString(firstValue, MAX_IP_ADDRESS_LENGTH);
};

const readAcceptedAt = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

/**
 * Reads whether the authenticated user already accepted the current media agreement version.
 */
export const getMediaComplianceAcceptanceStatusForUser = async (
  userId: string
): Promise<MediaComplianceAcceptanceStatus> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from(MEDIA_COMPLIANCE_TABLE)
    .select("accepted_at")
    .eq("user_id", userId)
    .eq("agreement_key", MEDIA_COMPLIANCE_AGREEMENT.key)
    .eq("agreement_version", MEDIA_COMPLIANCE_AGREEMENT.version)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const acceptedAt = readAcceptedAt(data?.accepted_at);
  return {
    accepted: Boolean(acceptedAt),
    acceptedAt,
  };
};

/**
 * Records acceptance for the current media agreement version and returns the stored timestamp.
 */
export const saveMediaComplianceAcceptanceForUser = async ({
  req,
  userId,
}: {
  req: NextApiRequest;
  userId: string;
}): Promise<MediaComplianceAcceptanceStatus> => {
  const supabaseAdmin = getSupabaseAdmin();
  const acceptedAt = new Date().toISOString();
  const ipAddress =
    readHeaderValue(req.headers["x-forwarded-for"]) ??
    readHeaderValue(req.headers["x-real-ip"]) ??
    null;
  const userAgent = normalizeOptionalString(req.headers["user-agent"], MAX_USER_AGENT_LENGTH);

  const { data, error } = await supabaseAdmin
    .from(MEDIA_COMPLIANCE_TABLE)
    .upsert(
      {
        user_id: userId,
        agreement_key: MEDIA_COMPLIANCE_AGREEMENT.key,
        agreement_version: MEDIA_COMPLIANCE_AGREEMENT.version,
        accepted_at: acceptedAt,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
      {
        onConflict: MEDIA_COMPLIANCE_UPSERT_CONFLICT,
      }
    )
    .select("accepted_at")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    accepted: true,
    acceptedAt: readAcceptedAt(data?.accepted_at) ?? acceptedAt,
  };
};
