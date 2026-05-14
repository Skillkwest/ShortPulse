/**
 * Server-side media-compliance acceptance helpers.
 * Reads and writes versioned user acceptance records through the Supabase admin client.
 */
import type { NextApiRequest } from "next";
import { MEDIA_COMPLIANCE_AGREEMENT } from "../../compliance/mediaAgreement";
import { getSupabaseAdmin } from "./supabaseAdmin";

const MEDIA_COMPLIANCE_TABLE = "user_media_compliance_acceptances";
const MAX_IP_ADDRESS_LENGTH = 255;
const MAX_USER_AGENT_LENGTH = 1000;

export type MediaComplianceAcceptanceStatus = {
  accepted: boolean;
  acceptedAt: string | null;
};

export const MEDIA_COMPLIANCE_UNAVAILABLE_CODE = "MEDIA_COMPLIANCE_UNAVAILABLE" as const;

type MediaComplianceUnavailableError = Error & {
  code: typeof MEDIA_COMPLIANCE_UNAVAILABLE_CODE;
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

const isDuplicateAcceptanceError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: unknown; message?: unknown };
  if (maybeError.code === "23505") {
    return true;
  }
  return (
    typeof maybeError.message === "string" &&
    maybeError.message.toLowerCase().includes("duplicate key")
  );
};

const createMediaComplianceUnavailableError = (
  message = "Media agreement service is temporarily unavailable."
): MediaComplianceUnavailableError => {
  const error = new Error(message) as MediaComplianceUnavailableError;
  error.code = MEDIA_COMPLIANCE_UNAVAILABLE_CODE;
  return error;
};

export const isMediaComplianceUnavailableError = (
  error: unknown
): error is MediaComplianceUnavailableError => {
  if (!error || typeof error !== "object") return false;
  return (error as { code?: unknown }).code === MEDIA_COMPLIANCE_UNAVAILABLE_CODE;
};

const isMediaCompliancePersistenceUnavailableError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: unknown; message?: unknown; details?: unknown };
  if (
    maybeError.code === "PGRST205" ||
    maybeError.code === "PGRST204" ||
    maybeError.code === "42P01" ||
    maybeError.code === "42703"
  ) {
    return true;
  }
  const message = typeof maybeError.message === "string" ? maybeError.message : "";
  const details = typeof maybeError.details === "string" ? maybeError.details : "";
  const combined = `${message} ${details}`.toLowerCase();
  return (
    combined.includes(MEDIA_COMPLIANCE_TABLE) ||
    combined.includes("supabase admin environment is not configured")
  );
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
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMediaCompliancePersistenceUnavailableError(error)) {
      throw createMediaComplianceUnavailableError();
    }
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
  const insertPayload = {
    user_id: userId,
    agreement_key: MEDIA_COMPLIANCE_AGREEMENT.key,
    agreement_version: MEDIA_COMPLIANCE_AGREEMENT.version,
    accepted_at: acceptedAt,
    ip_address: ipAddress,
    user_agent: userAgent,
  };

  const { data, error } = await supabaseAdmin
    .from(MEDIA_COMPLIANCE_TABLE)
    .insert(insertPayload)
    .select("accepted_at")
    .maybeSingle();

  if (error) {
    if (isDuplicateAcceptanceError(error)) {
      const existingStatus = await getMediaComplianceAcceptanceStatusForUser(userId);
      return {
        accepted: true,
        acceptedAt: existingStatus.acceptedAt ?? acceptedAt,
      };
    }
    if (isMediaCompliancePersistenceUnavailableError(error)) {
      throw createMediaComplianceUnavailableError();
    }
    throw error;
  }

  return {
    accepted: true,
    acceptedAt: readAcceptedAt(data?.accepted_at) ?? acceptedAt,
  };
};
