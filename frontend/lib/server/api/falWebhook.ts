import crypto from "crypto";
import type { NextApiRequest } from "next";

const DEFAULT_TOLERANCE_SECONDS = 300;

type ParsedSignatureHeader = {
  timestamp: string | null;
  signatures: string[];
};

const parseSignatureHeader = (signatureHeader: string): ParsedSignatureHeader => {
  const trimmed = signatureHeader.trim();
  if (!trimmed) return { timestamp: null, signatures: [] };
  if (!trimmed.includes(",")) {
    return { timestamp: null, signatures: [trimmed] };
  }

  const tokens = trimmed.split(",").map((token) => token.trim());
  const signatures: string[] = [];
  let timestamp: string | null = null;
  for (const token of tokens) {
    const [key, value] = token.split("=");
    if (!key || !value) continue;
    if (key === "t") timestamp = value;
    if (key === "v1") signatures.push(value);
  }
  return { timestamp, signatures };
};

const secureCompare = (expectedHex: string, candidateHex: string): boolean => {
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedHex, "hex"),
      Buffer.from(candidateHex, "hex")
    );
  } catch {
    return false;
  }
};

export const readRawBody = async (req: NextApiRequest): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

export const getFalWebhookSecret = (): string | null =>
  process.env.SHORTPULSE_FAL_WEBHOOK_SECRET?.trim() ||
  process.env.FAL_WEBHOOK_SECRET?.trim() ||
  null;

const parseTimestampSeconds = (timestamp: string | null): number | null => {
  if (!timestamp) return null;
  const parsed = Number(timestamp);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
};

const isTimestampFresh = (timestampSeconds: number): boolean => {
  const tolerance = Number.parseInt(
    process.env.SHORTPULSE_FAL_WEBHOOK_TOLERANCE_SECONDS ?? String(DEFAULT_TOLERANCE_SECONDS),
    10
  );
  if (!Number.isFinite(tolerance) || tolerance <= 0) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.abs(nowSeconds - timestampSeconds) <= tolerance;
};

export const verifyFalWebhookSignature = ({
  rawBody,
  signatureHeader,
  timestampHeader,
}: {
  rawBody: string;
  signatureHeader: string | null;
  timestampHeader?: string | null;
}): boolean => {
  const secret = getFalWebhookSecret();
  if (!secret || !signatureHeader) return false;

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed.signatures.length) return false;

  const timestamp = parseTimestampSeconds(timestampHeader ?? parsed.timestamp);
  if (timestamp !== null && !isTimestampFresh(timestamp)) {
    return false;
  }

  const signedPayload = timestamp !== null ? `${timestamp}.${rawBody}` : rawBody;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  return parsed.signatures.some((candidate) => secureCompare(expected, candidate));
};
