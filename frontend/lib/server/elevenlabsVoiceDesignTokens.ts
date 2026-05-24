/**
 * Signs and verifies short-lived voice-design preview claims so preview ids
 * cannot be replayed across users or browser sessions.
 */
import crypto from "crypto";

const VOICE_DESIGN_TOKEN_TTL_MS = 30 * 60 * 1000;

type VoiceDesignPreviewTokenPayload = {
  generatedVoiceId: string;
  issuedAt: number;
  userId: string;
};

const base64UrlEncode = (value: string): string => Buffer.from(value, "utf8").toString("base64url");

const base64UrlDecode = (value: string): string => Buffer.from(value, "base64url").toString("utf8");

const resolveVoiceDesignTokenSecret = (): string => {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) {
    throw new Error("Supabase admin environment is not configured.");
  }
  return secret;
};

const signPayload = (payload: string): string =>
  crypto.createHmac("sha256", resolveVoiceDesignTokenSecret()).update(payload).digest("base64url");

const parsePayload = (token: string): VoiceDesignPreviewTokenPayload | null => {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signPayload(encodedPayload);
  const left = Buffer.from(expectedSignature, "utf8");
  const right = Buffer.from(signature, "utf8");
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      base64UrlDecode(encodedPayload)
    ) as Partial<VoiceDesignPreviewTokenPayload>;
    if (
      typeof payload?.generatedVoiceId !== "string" ||
      typeof payload?.userId !== "string" ||
      typeof payload?.issuedAt !== "number" ||
      !Number.isFinite(payload.issuedAt)
    ) {
      return null;
    }
    return {
      generatedVoiceId: payload.generatedVoiceId,
      issuedAt: payload.issuedAt,
      userId: payload.userId,
    };
  } catch {
    return null;
  }
};

/**
 * Issues a signed preview token for one generated voice-design candidate.
 */
export const issueVoiceDesignPreviewToken = ({
  generatedVoiceId,
  userId,
}: {
  generatedVoiceId: string;
  userId: string;
}): string => {
  const encodedPayload = base64UrlEncode(
    JSON.stringify({
      generatedVoiceId,
      issuedAt: Date.now(),
      userId,
    } satisfies VoiceDesignPreviewTokenPayload)
  );
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
};

/**
 * Validates that a voice-design preview token was issued for the current user
 * and still falls within the short-lived preview window.
 */
export const verifyVoiceDesignPreviewToken = ({
  generatedVoiceId,
  token,
  userId,
}: {
  generatedVoiceId: string;
  token: string;
  userId: string;
}): boolean => {
  const payload = parsePayload(token);
  if (!payload) return false;
  if (payload.userId !== userId) return false;
  if (payload.generatedVoiceId !== generatedVoiceId) return false;
  if (Date.now() - payload.issuedAt > VOICE_DESIGN_TOKEN_TTL_MS) return false;
  return true;
};
