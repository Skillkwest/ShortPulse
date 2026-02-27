/**
 * Shared API raw-body readers with explicit size guardrails.
 * Prevents unbounded webhook payload reads and standardizes 413 handling.
 */
import type { NextApiRequest } from "next";

/**
 * Error raised when a request body exceeds an explicit byte limit.
 */
export class RequestBodyTooLargeError extends Error {
  readonly maxBytes: number;

  constructor(maxBytes: number) {
    super(`Request body exceeds ${maxBytes} bytes.`);
    this.name = "RequestBodyTooLargeError";
    this.maxBytes = maxBytes;
  }
}

type ReadRawBodyOptions = {
  maxBytes: number;
  encoding?: BufferEncoding;
};

/**
 * Read a raw request body as text with a hard size cap.
 */
export const readRawRequestBody = async (
  req: NextApiRequest,
  { maxBytes, encoding = "utf8" }: ReadRawBodyOptions
): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let done = false;

    const fail = (error: unknown) => {
      if (done) return;
      done = true;
      reject(error);
    };

    req.on("data", (chunk) => {
      if (done) return;
      const asBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += asBuffer.byteLength;
      if (totalBytes > maxBytes) {
        if (typeof req.destroy === "function") {
          req.destroy();
        }
        fail(new RequestBodyTooLargeError(maxBytes));
        return;
      }
      chunks.push(asBuffer);
    });

    req.on("end", () => {
      if (done) return;
      done = true;
      resolve(Buffer.concat(chunks).toString(encoding));
    });

    req.on("error", (error) => fail(error));
  });
