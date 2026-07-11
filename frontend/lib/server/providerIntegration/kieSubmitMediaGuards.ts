/**
 * Kie submit media guard helpers.
 * Provides deterministic preflight checks and redacted diagnostics for media inputs.
 */

import { isCharacterScopedMediaUrl } from "../../mediaStoragePath";

const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png"]);
const ALLOWED_VIDEO_EXTENSIONS = new Set(["mp4", "mov"]);
const MIN_SIGNED_URL_TTL_SECONDS = 120;

type MediaKind = "image" | "video";

type MediaDiagnostic = {
  kind: MediaKind;
  host: string | null;
  extension: string | null;
  has_token: boolean;
  token_ttl_seconds: number | null;
  path_contains_characters: boolean;
};

export type KieSubmitMediaDiagnostics = {
  model: string | null;
  motion_control: boolean;
  media: MediaDiagnostic[];
};

export type KieSubmitMediaValidationResult =
  | {
      ok: true;
      diagnostics: KieSubmitMediaDiagnostics;
    }
  | {
      ok: false;
      error: string;
      code: "KIE_MEDIA_INPUT_INVALID";
      detail: {
        reason:
          | "invalid_url"
          | "invalid_protocol"
          | "unsupported_extension"
          | "expiring_signed_url";
        expected_kind: MediaKind;
        media_index: number;
        diagnostics: KieSubmitMediaDiagnostics;
      };
    };

type ParsedMediaInput = {
  model: string | null;
  motionControl: boolean;
  imageUrls: string[];
  videoUrls: string[];
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const readStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asNonEmptyString(item))
    .filter((item): item is string => Boolean(item));
};

const unique = (values: string[]): string[] => Array.from(new Set(values));

const readTopLevelMediaInput = (payload: Record<string, unknown>): ParsedMediaInput => {
  const input = asRecord(payload.input);
  const source = Object.keys(input).length ? input : payload;
  const model = asNonEmptyString(payload.model) ?? asNonEmptyString(source.model);
  const imageUrls = unique([
    ...readStringList(source.image_urls),
    ...readStringList(source.imageUrls),
    ...readStringList(source.input_urls),
    ...readStringList(source.inputUrls),
    ...(asNonEmptyString(source.image_url) ? [asNonEmptyString(source.image_url)!] : []),
    ...(asNonEmptyString(source.imageUrl) ? [asNonEmptyString(source.imageUrl)!] : []),
    ...(asNonEmptyString(source.input_url) ? [asNonEmptyString(source.input_url)!] : []),
    ...(asNonEmptyString(source.inputUrl) ? [asNonEmptyString(source.inputUrl)!] : []),
  ]);
  const videoUrls = unique([
    ...readStringList(source.video_urls),
    ...readStringList(source.videoUrls),
    ...(asNonEmptyString(source.video_url) ? [asNonEmptyString(source.video_url)!] : []),
    ...(asNonEmptyString(source.videoUrl) ? [asNonEmptyString(source.videoUrl)!] : []),
  ]);
  const motionControl =
    (model?.toLowerCase().includes("motion-control") ?? false) ||
    videoUrls.length > 0 ||
    source.input_urls !== undefined ||
    source.inputUrls !== undefined ||
    source.video_urls !== undefined ||
    source.videoUrls !== undefined;
  return { model: model ?? null, motionControl, imageUrls, videoUrls };
};

const readKlingElementMediaInput = (
  payload: Record<string, unknown>
): { imageUrls: string[]; videoUrls: string[] } => {
  const input = asRecord(payload.input);
  const source = Object.keys(input).length ? input : payload;
  const elements = Array.isArray(source.kling_elements) ? source.kling_elements : [];
  return elements.reduce<{ imageUrls: string[]; videoUrls: string[] }>(
    (accumulator, element) => {
      const record = asRecord(element);
      accumulator.imageUrls.push(...readStringList(record.element_input_urls));
      accumulator.videoUrls.push(...readStringList(record.element_input_video_urls));
      return accumulator;
    },
    { imageUrls: [], videoUrls: [] }
  );
};

const readPathExtension = (url: URL): string | null => {
  const lastSegment = url.pathname.split("/").filter(Boolean).pop() ?? "";
  if (!lastSegment.includes(".")) return null;
  const extension = lastSegment.split(".").pop()?.trim().toLowerCase() ?? "";
  return extension.length ? extension : null;
};

const decodeBase64Url = (value: string): string | null => {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return null;
  }
};

const readSignedTokenTtlSeconds = (url: URL): number | null => {
  const token = url.searchParams.get("token");
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payloadJson = decodeBase64Url(parts[1]);
  if (!payloadJson) return null;
  try {
    const decoded = JSON.parse(payloadJson) as { exp?: unknown };
    if (typeof decoded.exp !== "number" || !Number.isFinite(decoded.exp)) return null;
    return Math.trunc(decoded.exp - Date.now() / 1000);
  } catch {
    return null;
  }
};

const validateOneMediaUrl = async ({
  url,
  expectedKind,
  mediaIndex,
  diagnostics,
}: {
  url: string;
  expectedKind: MediaKind;
  mediaIndex: number;
  diagnostics: KieSubmitMediaDiagnostics;
}): Promise<KieSubmitMediaValidationResult | null> => {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return {
      ok: false,
      error: "Kie Kling submit media URL must be a valid URL.",
      code: "KIE_MEDIA_INPUT_INVALID",
      detail: {
        reason: "invalid_url",
        expected_kind: expectedKind,
        media_index: mediaIndex,
        diagnostics,
      },
    };
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return {
      ok: false,
      error: "Kie Kling submit media URL must use http(s).",
      code: "KIE_MEDIA_INPUT_INVALID",
      detail: {
        reason: "invalid_protocol",
        expected_kind: expectedKind,
        media_index: mediaIndex,
        diagnostics,
      },
    };
  }

  const extension = readPathExtension(parsedUrl);
  if (
    !extension ||
    (expectedKind === "image" && !ALLOWED_IMAGE_EXTENSIONS.has(extension)) ||
    (expectedKind === "video" && !ALLOWED_VIDEO_EXTENSIONS.has(extension))
  ) {
    return {
      ok: false,
      error: `Kie Kling submit media URL has unsupported ${expectedKind} extension.`,
      code: "KIE_MEDIA_INPUT_INVALID",
      detail: {
        reason: "unsupported_extension",
        expected_kind: expectedKind,
        media_index: mediaIndex,
        diagnostics,
      },
    };
  }

  const ttlSeconds = readSignedTokenTtlSeconds(parsedUrl);
  if (ttlSeconds !== null && ttlSeconds <= MIN_SIGNED_URL_TTL_SECONDS) {
    return {
      ok: false,
      error: "Kie Kling submit media URL token expires too soon for reliable provider fetch.",
      code: "KIE_MEDIA_INPUT_INVALID",
      detail: {
        reason: "expiring_signed_url",
        expected_kind: expectedKind,
        media_index: mediaIndex,
        diagnostics,
      },
    };
  }

  return null;
};

/**
 * Builds redacted diagnostics for Kie media payloads.
 */
export const buildKieSubmitMediaDiagnostics = (
  payload: Record<string, unknown>
): KieSubmitMediaDiagnostics => {
  const parsed = readTopLevelMediaInput(payload);
  const elementMedia = readKlingElementMediaInput(payload);
  const media: MediaDiagnostic[] = [];
  unique([...parsed.imageUrls, ...elementMedia.imageUrls]).forEach((url) => {
    try {
      const parsedUrl = new URL(url);
      media.push({
        kind: "image",
        host: parsedUrl.host,
        extension: readPathExtension(parsedUrl),
        has_token: Boolean(parsedUrl.searchParams.get("token")),
        token_ttl_seconds: readSignedTokenTtlSeconds(parsedUrl),
        path_contains_characters: isCharacterScopedMediaUrl(parsedUrl.toString()),
      });
    } catch {
      media.push({
        kind: "image",
        host: null,
        extension: null,
        has_token: false,
        token_ttl_seconds: null,
        path_contains_characters: false,
      });
    }
  });
  unique([...parsed.videoUrls, ...elementMedia.videoUrls]).forEach((url) => {
    try {
      const parsedUrl = new URL(url);
      media.push({
        kind: "video",
        host: parsedUrl.host,
        extension: readPathExtension(parsedUrl),
        has_token: Boolean(parsedUrl.searchParams.get("token")),
        token_ttl_seconds: readSignedTokenTtlSeconds(parsedUrl),
        path_contains_characters: isCharacterScopedMediaUrl(parsedUrl.toString()),
      });
    } catch {
      media.push({
        kind: "video",
        host: null,
        extension: null,
        has_token: false,
        token_ttl_seconds: null,
        path_contains_characters: false,
      });
    }
  });
  return {
    model: parsed.model,
    motion_control: parsed.motionControl,
    media,
  };
};

/**
 * Validates Kie Kling media URLs before provider submit.
 */
export const validateKieKlingSubmitMediaInputs = async (options: {
  payload: Record<string, unknown>;
  signal: AbortSignal;
}): Promise<KieSubmitMediaValidationResult> => {
  const { payload } = options;
  const parsed = readTopLevelMediaInput(payload);
  const elementMedia = readKlingElementMediaInput(payload);
  const diagnostics = buildKieSubmitMediaDiagnostics(payload);
  const mediaToValidate: Array<{ url: string; kind: MediaKind }> = [
    ...unique([...parsed.imageUrls, ...elementMedia.imageUrls]).map((url) => ({
      url,
      kind: "image" as const,
    })),
    ...unique([...parsed.videoUrls, ...elementMedia.videoUrls]).map((url) => ({
      url,
      kind: "video" as const,
    })),
  ];
  for (const [index, media] of mediaToValidate.entries()) {
    const failure = await validateOneMediaUrl({
      url: media.url,
      expectedKind: media.kind,
      mediaIndex: index,
      diagnostics,
    });
    if (failure) return failure;
  }
  return {
    ok: true,
    diagnostics,
  };
};
