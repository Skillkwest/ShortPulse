#!/usr/bin/env node
/**
 * Guardrail for retired generation-pipeline fallback and compatibility surfaces.
 * Scans active generation code/docs for exact markers that must not be reintroduced.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const scanTargets = [
  "frontend/features/ai-studio/hooks/taskSubmission",
  "frontend/lib/falClient.ts",
  "frontend/features/ai-studio/hooks/useAiStudioAudioGeneration.ts",
  "frontend/lib/server/api",
  "frontend/lib/server/elevenlabs.ts",
  "frontend/lib/server/falIntegration",
  "frontend/lib/server/providerIntegration",
  "frontend/pages/api/elevenlabs",
  "frontend/pages/api/fal",
  "frontend/pages/api/kie/upload-url.ts",
  "frontend/pages/api/openai",
  "docs/deployment.md",
  "docs/operator-map.md",
  "docs/api/api-internal-routes.md",
  "docs/api/api-kie-kling-3-0.md",
  "docs/api/api-kie-seedance-2.md",
  "docs/api/api-kie-seedance-2-fast.md",
  "docs/api/api-kie-veo-3-1-fast-image-to-video.md",
  "docs/routes.md",
  "docs/sops/sop_billing_credits_operations.md",
  "docs/sops/sop_ai_studio_index.md",
  "docs/sops/sop_image_generation.md",
  "docs/sops/sop_provider_incident_response.md",
  "docs/sops/sop_video_generation.md",
];

const bannedPatterns = [
  {
    pattern: "SHORTPULSE_FAL_DIRECT_DEBIT_FALLBACK_ENABLED",
    reason:
      "reservation-mode generation billing must fail closed instead of direct-debit fallback",
  },
  {
    pattern: "/api/upload-image",
    reason:
      "retired upload-image route must not return to active generation code/docs",
  },
  {
    pattern: "/api/upload-video",
    reason:
      "retired upload-video route must not return to active generation code/docs",
  },
  {
    pattern: "/api/upload-audio",
    reason:
      "retired upload-audio route must not return to active generation code/docs",
  },
  {
    pattern: "directDebitFallbackEnabled",
    reason: "runtime direct-debit fallback flag is retired",
  },
  {
    pattern: "SHORTPULSE_FAL_ADMISSION_ATOMIC_ENABLED",
    reason: "atomic admission toggle is retired; admit+reserve is canonical",
  },
  {
    pattern: "admissionAtomicEnabled",
    reason: "atomic admission toggle is retired; admit+reserve is canonical",
  },
  {
    pattern: "direct_debit",
    reason: "generation billing mode must use reservations only",
  },
  {
    pattern: "reserveGenerationCreditsLegacy",
    reason: "legacy reservation RPC fallback is retired",
  },
  {
    pattern: "fal_legacy_alias",
    reason: "provider dispatch must require canonical provider keys",
  },
  {
    pattern: "buildFallbackElevenLabsVoices",
    reason: "ElevenLabs voices must fail closed on provider/catalog errors",
  },
  {
    pattern: '.contains("metadata", { source_ref',
    reason:
      "generation runtime must not recover by scanning legacy metadata source refs",
  },
  {
    pattern: "allowLegacyFallback",
    reason: "settlement repair must use canonical reservation linkage only",
  },
  {
    pattern: "settlement_fallback",
    reason: "settlement repair metadata must not describe fallback behavior",
  },
  {
    pattern: "lookupLegacyCharge",
    reason:
      "provider-request settlement must not scan legacy direct-debit charges",
  },
  {
    pattern: "settleLegacyDirectDebit",
    reason:
      "provider-request settlement must not fall back to direct-debit charge rows",
  },
  {
    pattern: /\bSHORTPULSE_FAL_INTEGRATION_MODE\b/,
    label: "SHORTPULSE_FAL_INTEGRATION_MODE",
    reason: "Fal runtime no longer supports legacy integration mode switching",
  },
  {
    pattern: "SHORTPULSE_VIDEO_SUBMIT_CANONICAL_MODE",
    reason: "video submit canonical contract is always enforced",
  },
  {
    pattern: "SHORTPULSE_VIDEO_QUEUE_COMPAT_NORMALIZATION_ENABLED",
    reason: "queued video dispatch must receive canonical v2 envelopes",
  },
  {
    pattern: "SHORTPULSE_FAL_WEBHOOK_SECRET",
    reason: "Fal webhooks must verify with JWKS/Ed25519 only",
  },
  {
    pattern: "FAL_WEBHOOK_SECRET",
    reason: "Fal webhooks must verify with JWKS/Ed25519 only",
  },
  {
    pattern: /(^|[^a-zA-Z0-9_])files\.file([^a-zA-Z0-9_]|$)/,
    label: "files.file",
    reason:
      "ElevenLabs speech-to-speech final generation must not accept direct local uploads",
  },
  {
    pattern: "sourceFileInput",
    reason:
      "ElevenLabs speech-to-speech final generation must not accept direct local uploads",
  },
  {
    pattern: "compatibility local upload",
    reason:
      "Voice Changer final generation must require staged storage or trusted URL input",
  },
  {
    pattern: "Compatibility local upload",
    reason:
      "Voice Changer final generation must require staged storage or trusted URL input",
  },
  {
    pattern: "Legacy Fal compatibility wrapper",
    reason:
      "Fal status/runtime policy must use canonical providerIntegration helpers directly",
  },
  {
    pattern: "defaulting to Fal",
    reason:
      "provider resolution must fail closed instead of silently defaulting to Fal",
  },
  {
    pattern: /resolveProviderFrom(ModelId|GenerationContext)\(\{[^}]*fallback/,
    label: "resolveProviderFrom* fallback",
    reason:
      "provider resolution must use catalog/provider context without fallback defaults",
  },
  {
    pattern: "submitEndpointRegistry",
    reason:
      "Fal browser client must derive submit routes from canonical model catalog metadata",
  },
  {
    pattern: "statusEndpointRegistry",
    reason:
      "Fal browser client must derive status routes from canonical model catalog metadata",
  },
  {
    pattern: "endpointModelIdRegistry",
    reason:
      "Fal browser client must derive model routes directly from canonical model catalog metadata",
  },
  {
    pattern: "submitFalEndpoint",
    reason: "per-model browser submit compatibility helpers are retired",
  },
  {
    pattern: "fetchFalStatusEndpoint",
    reason: "per-model browser status compatibility helpers are retired",
  },
  {
    pattern: "Generic Fal submit",
    reason: "dead generic Fal submit compatibility exports are retired",
  },
  {
    pattern: "Generic Fal status",
    reason: "dead generic Fal status compatibility exports are retired",
  },
  {
    pattern: "export const submitFalFlux =",
    reason: "generic Fal submit export must not be reintroduced",
  },
  {
    pattern: "export const fetchFalStatus =",
    reason: "generic Fal status export must not be reintroduced",
  },
  {
    pattern: /\bexport const submit(Fal|Kie)[A-Z]/,
    label: "export const submitFal*/submitKie*",
    reason:
      "queued generation submits must use submitQueuedGenerationByModelId",
  },
  {
    pattern: /\bexport const fetch(Fal|Kie)[A-Z][A-Za-z0-9]+Status\b/,
    label: "export const fetchFal*/fetchKie*Status",
    reason:
      "queued generation status polling must use fetchQueuedGenerationStatusByModelId",
  },
  {
    pattern: "falls back to legacy `/{requestId}/status` probing",
    reason:
      "Kie status/result polling must use canonical record-info templates only",
  },
  {
    pattern:
      "Status polling is observational only; it does not capture or release reservations.",
    reason:
      "provider status polling can now settle terminal outcomes through canonical direct settlement",
  },
];

const sourceExtensions = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
  ".md",
]);

const listFiles = (targetPath) => {
  const absolutePath = path.join(repoRoot, targetPath);
  if (!existsSync(absolutePath)) return [];
  const stats = statSync(absolutePath);
  if (stats.isFile()) return [absolutePath];
  if (!stats.isDirectory()) return [];

  const files = [];
  const stack = [absolutePath];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__tests__") continue;
        stack.push(entryPath);
        continue;
      }
      if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
        files.push(entryPath);
      }
    }
  }
  return files;
};

const failures = [];
const scannedFiles = new Set(scanTargets.flatMap(listFiles));

for (const filePath of scannedFiles) {
  const content = readFileSync(filePath, "utf8");
  const relativePath = path.relative(repoRoot, filePath);
  for (const { pattern, label, reason } of bannedPatterns) {
    const found =
      typeof pattern === "string"
        ? content.includes(pattern)
        : pattern.test(content);
    if (!found) continue;
    failures.push({
      relativePath,
      pattern: typeof pattern === "string" ? pattern : label,
      reason,
    });
  }
}

if (failures.length > 0) {
  console.error("Retired generation pipeline markers were found:");
  for (const failure of failures) {
    console.error(
      `- ${failure.relativePath}: ${failure.pattern} (${failure.reason})`,
    );
  }
  process.exit(1);
}

console.log(
  `Generation pipeline legacy-path guard passed (${scannedFiles.size} files scanned).`,
);
