/**
 * Defines deterministic runtime-scope keys for prompt-compiler cache segregation.
 * The scope key invalidates cached behavior when prompt templates, policy schema,
 * or control-plane policy versions change.
 */
import { createHash } from "node:crypto";

export type PromptCompilerRoute = "studio-agent" | "generate-prompt" | "describe-image";

const normalizePromptSegment = (value: string): string =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

const normalizeVersionToken = (value: number | null | undefined): string =>
  typeof value === "number" && Number.isFinite(value) ? String(Math.trunc(value)) : "none";

const normalizePromptTemplateVersion = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_")
    .slice(0, 64);
  return normalized.length ? normalized : "none";
};

/**
 * Computes a stable prompt-template version fingerprint for one route from
 * the active prompt text payloads used to execute that route.
 */
export const resolvePromptTemplateVersion = ({
  route,
  prompts,
}: {
  route: PromptCompilerRoute;
  prompts: string[];
}): string => {
  const hash = createHash("sha256");
  hash.update(route);
  for (const prompt of prompts) {
    hash.update("\n");
    hash.update(normalizePromptSegment(prompt));
  }
  return `ptv_${hash.digest("hex").slice(0, 16)}`;
};

/**
 * Builds a deterministic runtime cache-scope key used by telemetry/contracts.
 * Any change to prompt, schema, or control-plane version changes this key.
 */
export const buildPromptCompilerCacheScopeKey = ({
  route,
  promptTemplateVersion,
  policySchemaVersion,
  controlPlanePolicyVersion,
}: {
  route: PromptCompilerRoute;
  promptTemplateVersion: string;
  policySchemaVersion: number | null | undefined;
  controlPlanePolicyVersion: number | null | undefined;
}): string =>
  [
    `route:${route}`,
    `prompt:${normalizePromptTemplateVersion(promptTemplateVersion)}`,
    `schema:${normalizeVersionToken(policySchemaVersion)}`,
    `policy:${normalizeVersionToken(controlPlanePolicyVersion)}`,
  ].join("|");
