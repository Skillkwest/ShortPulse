import { STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE } from "./studioAgentRouteOutcomes";

type StudioAgentSafetyClassification = "safe" | "needs_rewrite" | "refuse";

export type StudioAgentSafetyPostProcessOutcome = "pass" | "rewritten" | "refusal";
export type StudioAgentSafetyPostProcessSource = "model_output" | "describe_output";

export type StudioAgentSafetyPostProcessResult = {
  outcome: StudioAgentSafetyPostProcessOutcome;
  text: string;
  fallbackUsed: boolean;
  debugReason?: string;
};

const MAX_TEXT_LENGTH = 4000;
const DEFAULT_REWRITE_TIMEOUT_MS = 1200;

const EXPLICIT_REFUSAL_PATTERNS: RegExp[] = [
  /\b(?:porn|pornographic)\b/i,
  /\b(?:sexual\s+(?:intercourse|act|acts|activity|activities))\b/i,
  /\b(?:graphic\s+sexual)\b/i,
  /\b(?:explicit\s+sexual)\b/i,
  /\b(?:genitals?|penis|vagina)\b/i,
  /\b(?:ejaculat(?:e|ed|ing)|orgasm|masturbat(?:e|ed|ing))\b/i,
  /\b(?:child\s+sexual|minor\s+sexual)\b/i,
];

const EXPLICIT_REWRITE_PATTERNS: RegExp[] = [
  /\b(?:nsfw)\b/i,
  /\b(?:nude|naked|topless)\b/i,
  /\b(?:lingerie|cleavage)\b/i,
  /\b(?:sexy|sexualized|sensual|seductive|provocative|erotic)\b/i,
  /\b(?:scantily\s+clad|revealing\s+outfit)\b/i,
];

const SFW_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bnsfw\b/gi, "safe-for-work"],
  [/\b(?:nude|naked|topless)\b/gi, "fully clothed"],
  [/\blingerie\b/gi, "outfit"],
  [/\bcleavage\b/gi, "neckline"],
  [/\b(?:sexy|sexualized|sensual|seductive|provocative|erotic)\b/gi, "stylized"],
  [/\bscantily clad\b/gi, "fully dressed"],
  [/\brevealing outfit\b/gi, "outfit"],
];

const collapseWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);

const classifyStudioAgentSafetyText = (value: string): StudioAgentSafetyClassification => {
  const normalized = value.trim();
  if (!normalized.length) return "safe";
  if (normalized === STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE) return "safe";
  if (EXPLICIT_REFUSAL_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "refuse";
  }
  if (EXPLICIT_REWRITE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "needs_rewrite";
  }
  return "safe";
};

const deterministicRewrite = (value: string): string => {
  let rewritten = value;
  for (const [pattern, replacement] of SFW_REPLACEMENTS) {
    rewritten = rewritten.replace(pattern, replacement);
  }
  return collapseWhitespace(rewritten);
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  await new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error("rewrite_timeout")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });

const maybeExternalRewrite = async ({
  text,
  route,
  flow,
  source,
  traceId,
  rewrite,
  timeoutMs,
}: {
  text: string;
  route: "studio-agent" | "describe-image";
  flow: string;
  source: StudioAgentSafetyPostProcessSource;
  traceId?: string;
  rewrite?: (args: {
    text: string;
    route: "studio-agent" | "describe-image";
    flow: string;
    source: StudioAgentSafetyPostProcessSource;
    traceId?: string;
  }) => Promise<string | null>;
  timeoutMs?: number;
}): Promise<string | null> => {
  if (!rewrite) return null;
  try {
    const rewritten = await withTimeout(
      rewrite({ text, route, flow, source, traceId }),
      timeoutMs ?? DEFAULT_REWRITE_TIMEOUT_MS
    );
    if (typeof rewritten !== "string") return null;
    const normalized = collapseWhitespace(rewritten);
    return normalized.length ? normalized : null;
  } catch {
    return null;
  }
};

export const postProcessStudioAgentSafetyText = async ({
  text,
  route,
  flow = "unknown",
  source,
  enabled,
  debug = false,
  traceId,
  rewrite,
  rewriteTimeoutMs,
}: {
  text: string | null | undefined;
  route: "studio-agent" | "describe-image";
  flow?: string;
  source: StudioAgentSafetyPostProcessSource;
  enabled: boolean;
  debug?: boolean;
  traceId?: string;
  rewrite?: (args: {
    text: string;
    route: "studio-agent" | "describe-image";
    flow: string;
    source: StudioAgentSafetyPostProcessSource;
    traceId?: string;
  }) => Promise<string | null>;
  rewriteTimeoutMs?: number;
}): Promise<StudioAgentSafetyPostProcessResult> => {
  const normalized = collapseWhitespace(typeof text === "string" ? text : "");
  if (!enabled || !normalized.length) {
    return { outcome: "pass", text: normalized, fallbackUsed: false };
  }

  const initialClassification = classifyStudioAgentSafetyText(normalized);
  if (initialClassification === "safe") {
    return { outcome: "pass", text: normalized, fallbackUsed: false };
  }
  if (initialClassification === "refuse") {
    return {
      outcome: "refusal",
      text: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
      fallbackUsed: false,
      debugReason: debug ? "classification_refusal" : undefined,
    };
  }

  const externalRewrite = await maybeExternalRewrite({
    text: normalized,
    route,
    flow,
    source,
    traceId,
    rewrite,
    timeoutMs: rewriteTimeoutMs,
  });
  let fallbackUsed = false;
  let rewritten = externalRewrite;
  if (!rewritten) {
    rewritten = deterministicRewrite(normalized);
    fallbackUsed = true;
  }

  const rewrittenClassification = classifyStudioAgentSafetyText(rewritten);
  if (rewrittenClassification === "safe") {
    return {
      outcome: "rewritten",
      text: rewritten,
      fallbackUsed,
      debugReason: debug ? "rewritten_safe" : undefined,
    };
  }

  if (rewrittenClassification === "needs_rewrite") {
    const secondPass = deterministicRewrite(rewritten);
    fallbackUsed = true;
    const secondClassification = classifyStudioAgentSafetyText(secondPass);
    if (secondClassification === "safe") {
      return {
        outcome: "rewritten",
        text: secondPass,
        fallbackUsed,
        debugReason: debug ? "rewritten_safe_second_pass" : undefined,
      };
    }
  }

  return {
    outcome: "refusal",
    text: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
    fallbackUsed: true,
    debugReason: debug ? "rewrite_refusal_fallback" : undefined,
  };
};
