// Prints a starter scaffold for onboarding a new model into the ShortPulse model platform.
// Non-destructive: this script only prints snippets and a checklist.
//
// Example:
//   node scripts/scaffold_model.js \
//     --model-id fal-ai/example/model \
//     --label "Example Model" \
//     --provider fal \
//     --media-type image \
//     --execution-mode queued \
//     --submit-handler default \
//     --generation-lanes text-to-image \
//     --display-family Image \
//     --display-order 999 \
//     --pricing-strategy example-per-image \
//     --api-route-slug example-model
//
// Direct runtime example:
//   node scripts/scaffold_model.js \
//     --model-id example-openai-direct \
//     --label "Example Direct Model" \
//     --provider openai \
//     --media-type image \
//     --execution-mode direct \
//     --submit-handler default \
//     --generation-lanes text-to-image \
//     --display-family Image \
//     --display-order 999 \
//     --pricing-strategy example-per-image \
//     --direct-route-path frontend/pages/api/provider/example.ts \
//     --direct-route-kind create \
//     --direct-route-authority server-constant \
//     --direct-route-requires-billing true

const path = require("path");

const ALLOWED_PROVIDERS = new Set(["fal", "kie", "openai", "elevenlabs"]);
const ALLOWED_MEDIA_TYPES = new Set([
  "image",
  "video",
  "image-to-video",
  "multi",
  "text",
  "audio",
]);
const ALLOWED_EXECUTION_MODES = new Set(["queued", "direct", "none"]);
const ALLOWED_SUBMIT_HANDLERS = new Set([
  "default",
  "image",
  "video",
  "audio",
  "unsupported",
]);
const ALLOWED_GENERATION_LANES = new Set([
  "text-to-image",
  "image-to-image",
  "text-to-video",
  "image-to-video",
  "text-to-speech",
  "speech-to-speech",
  "music",
  "sfx",
  "voice-design",
  "text",
]);
const ALLOWED_ROUTE_VALIDATORS = new Set([
  "generic",
  "seedream-image",
  "seedream-edit",
]);
const ALLOWED_DIRECT_ROUTE_KINDS = new Set([
  "create",
  "edit",
  "audio-generate",
  "metadata-preview",
]);
const ALLOWED_DIRECT_ROUTE_AUTHORITIES = new Set([
  "server-constant",
  "catalog-default-role-allowlist",
  "catalog-default-role-server-default",
]);

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function requireArg(args, key) {
  const value = String(args[key] || "").trim();
  if (!value) {
    throw new Error(`Missing required argument --${key}`);
  }
  return value;
}

function ensureAllowed(value, allowed, label) {
  if (!allowed.has(value)) {
    throw new Error(
      `${label} must be one of: ${Array.from(allowed).join(", ")} (received '${value}')`,
    );
  }
}

function parseList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function suggestDocFileName(modelId) {
  const normalized = modelId
    .toLowerCase()
    .replace(/^fal-ai\//, "fal-")
    .replace(/^kie-ai\//, "kie-")
    .replace(/^gpt-/, "openai-gpt-")
    .replace(/^eleven_/, "elevenlabs-")
    .replace(/[/.]+/g, "-");
  return `api-${normalized}.md`;
}

function toJsonArray(values) {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}

function suggestRouteFileBase(modelId, apiRouteSlug) {
  const explicitSlug = String(apiRouteSlug || "").trim();
  if (explicitSlug) return explicitSlug;
  return modelId
    .toLowerCase()
    .replace(/^fal-ai\//, "")
    .replace(/^kie-ai\//, "kie-")
    .replace(/^openai\//, "openai-")
    .replace(/[/.]+/g, "-");
}

function parseBooleanFlag(args, key) {
  return String(args[key] || "").trim() === "true";
}

function resolveDirectRouteRequiredSymbols({
  provider,
  directRouteAuthority,
  directRouteRequiresBilling,
}) {
  const requiredSymbols = ["requireApiUser"];

  if (directRouteRequiresBilling) {
    requiredSymbols.push("chargeGenerationRequest");
  }

  if (directRouteAuthority === "server-constant") {
    requiredSymbols.push("DEFAULT_MODEL_ID_CONSTANT");
  } else if (directRouteAuthority === "catalog-default-role-allowlist") {
    requiredSymbols.push(
      "resolveRequiredCatalogRoleModelId",
      "ALLOWED_MODEL_IDS",
      "ALLOWED_MODEL_IDS.has(modelId)",
    );
  } else if (directRouteAuthority === "catalog-default-role-server-default") {
    requiredSymbols.push(
      "resolveRequiredCatalogRoleModelId",
      "DEFAULT_MODEL_ID_CONSTANT",
    );
  }

  return requiredSymbols;
}

function resolveDirectRouteChecklistLines({
  directRouteAuthority,
  directRouteRequiresBilling,
}) {
  const lines = [
    "- Add the direct route inventory entry in `scripts/lib/direct_provider_route_inventory.js`.",
    "- Make sure the route uses `requireApiUser` and the correct explicit model authority boundary.",
  ];

  if (directRouteAuthority === "server-constant") {
    lines.push(
      "- Keep model authority server-owned through a route-local constant import instead of reading model ids from the request.",
    );
  } else if (directRouteAuthority === "catalog-default-role-allowlist") {
    lines.push(
      "- Resolve the approved model id from the catalog, enforce a route-local allowlist, and reject unsupported client model ids before billing/provider execution.",
    );
  } else if (directRouteAuthority === "catalog-default-role-server-default") {
    lines.push(
      "- Resolve the default model id from the catalog server-side and do not expose arbitrary model-id selection on the request contract.",
    );
  }

  if (directRouteRequiresBilling) {
    lines.push(
      "- Wire `chargeGenerationRequest` because the route is user-billable.",
    );
  } else {
    lines.push(
      "- Do not wire `chargeGenerationRequest` unless the route becomes user-billable.",
    );
  }

  return lines;
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const modelId = requireArg(args, "model-id");
  const label = requireArg(args, "label");
  const provider = requireArg(args, "provider");
  const mediaType = requireArg(args, "media-type");
  const executionMode = requireArg(args, "execution-mode");
  const submitHandler = requireArg(args, "submit-handler");
  const displayFamily = requireArg(args, "display-family");
  const displayOrder = requireArg(args, "display-order");

  ensureAllowed(provider, ALLOWED_PROVIDERS, "provider");
  ensureAllowed(mediaType, ALLOWED_MEDIA_TYPES, "mediaType");
  ensureAllowed(executionMode, ALLOWED_EXECUTION_MODES, "executionMode");
  ensureAllowed(submitHandler, ALLOWED_SUBMIT_HANDLERS, "submitHandler");

  const generationLanes = parseList(args["generation-lanes"]);
  for (const lane of generationLanes) {
    ensureAllowed(lane, ALLOWED_GENERATION_LANES, "generationLane");
  }

  const pricingStrategy = String(args["pricing-strategy"] || "").trim();
  const apiRouteSlug = String(args["api-route-slug"] || "").trim();
  const sourceUrl =
    String(args["source-url"] || "").trim() ||
    "https://example.com/provider-docs";
  const verifiedAt = String(args["verified-at"] || "").trim() || "YYYY-MM-DD";
  const surfaces = parseList(args.surfaces || "picker,pricing,runtime");
  const defaultAspect = String(args["default-aspect"] || "").trim() || "1:1";
  const allowedAspects = parseList(
    args["allowed-aspects"] || defaultAspect || "1:1",
  );
  const defaultResolution = String(args["default-resolution"] || "").trim();
  const allowedResolutions = parseList(args["allowed-resolutions"] || "");
  const logoKey = String(args["logo-key"] || "").trim();
  const providerModelId = String(args["provider-model-id"] || "").trim();
  const pairedModelId = String(args["paired-model-id"] || "").trim();
  const promptPolicy = String(args["prompt-policy"] || "").trim();
  const admissionTier = String(args["admission-tier"] || "").trim();
  const createCharacterModeOrder = String(
    args["create-character-mode-order"] || "",
  ).trim();
  const routeFileBase = String(args["route-file-base"] || "").trim();
  const routeValidator = String(args["route-validator"] || "").trim();
  const statusRouteLabel = String(args["status-route-label"] || "").trim();
  const reExportValidator = parseBooleanFlag(args, "re-export-validator");
  const directRoutePath = String(args["direct-route-path"] || "").trim();
  const directRouteKind = String(args["direct-route-kind"] || "").trim();
  const directRouteAuthority = String(
    args["direct-route-authority"] || "",
  ).trim();
  const directRouteRequiresBilling = parseBooleanFlag(
    args,
    "direct-route-requires-billing",
  );
  const docFileName = suggestDocFileName(modelId);

  const rootDocPath = path.join("docs", "api", docFileName);
  const isQueuedProviderModel =
    executionMode === "queued" && (provider === "fal" || provider === "kie");
  const isDirectProviderRuntimeModel =
    executionMode === "direct" &&
    (provider === "openai" || provider === "elevenlabs") &&
    surfaces.includes("runtime");

  if (routeValidator) {
    ensureAllowed(routeValidator, ALLOWED_ROUTE_VALIDATORS, "routeValidator");
  }
  if (directRouteKind) {
    ensureAllowed(
      directRouteKind,
      ALLOWED_DIRECT_ROUTE_KINDS,
      "directRouteKind",
    );
  }
  if (directRouteAuthority) {
    ensureAllowed(
      directRouteAuthority,
      ALLOWED_DIRECT_ROUTE_AUTHORITIES,
      "directRouteAuthority",
    );
  }

  if (isQueuedProviderModel && !apiRouteSlug) {
    throw new Error(
      "Queued fal/kie models must provide --api-route-slug so route inventory and runtime config stay aligned.",
    );
  }
  if (isDirectProviderRuntimeModel) {
    if (!directRoutePath) {
      throw new Error(
        "Direct openai/elevenlabs runtime models must provide --direct-route-path so direct route inventory stays aligned.",
      );
    }
    if (!directRouteKind) {
      throw new Error(
        "Direct openai/elevenlabs runtime models must provide --direct-route-kind for direct route inventory.",
      );
    }
    if (!directRouteAuthority) {
      throw new Error(
        "Direct openai/elevenlabs runtime models must provide --direct-route-authority for direct route inventory.",
      );
    }
  }

  console.log("Catalog base snippet:\n");
  console.log(`"${modelId}": {`);
  console.log(`  modelId: ${JSON.stringify(modelId)},`);
  console.log(`  provider: ${JSON.stringify(provider)},`);
  console.log(`  sourceUrl: ${JSON.stringify(sourceUrl)},`);
  console.log(`  verifiedAt: ${JSON.stringify(verifiedAt)},`);
  console.log(`  submitAspectField: "TODO",`);
  console.log(`  defaultAspect: ${JSON.stringify(defaultAspect)},`);
  console.log(`  allowedAspects: ${toJsonArray(allowedAspects)},`);
  if (defaultResolution) {
    console.log(`  defaultResolution: ${JSON.stringify(defaultResolution)},`);
  }
  if (allowedResolutions.length > 0) {
    console.log(`  allowedResolutions: ${toJsonArray(allowedResolutions)},`);
  }
  if (provider === "fal") {
    console.log(`  falSubmitUrl: "TODO",`);
    console.log(`  falStatusBaseUrls: ["TODO"],`);
    console.log(`  falTimeoutMs: 60000,`);
  }
  if (provider === "kie") {
    console.log(`  kieSubmitUrl: "TODO",`);
    console.log(`  kieStatusBaseUrls: ["TODO"],`);
    console.log(`  kieTimeoutMs: 60000,`);
  }
  console.log(`  payloadValidation: {`);
  console.log(`    // TODO: add provider payload contract`);
  console.log(`  },`);
  console.log(`},\n`);

  console.log("Runtime metadata snippet:\n");
  console.log(`"${modelId}": {`);
  console.log(`  label: ${JSON.stringify(label)},`);
  console.log(`  mediaType: ${JSON.stringify(mediaType)},`);
  if (pricingStrategy) {
    console.log(`  pricingStrategy: ${JSON.stringify(pricingStrategy)},`);
  }
  console.log(`  lifecycle: "active",`);
  console.log(`  surfaces: ${toJsonArray(surfaces)},`);
  console.log(`  billable: ${String(surfaces.includes("pricing"))},`);
  console.log(`  displayFamily: ${JSON.stringify(displayFamily)},`);
  console.log(`  displayOrder: ${displayOrder},`);
  console.log(`  pricingFamily: ${JSON.stringify(displayFamily)},`);
  if (logoKey) {
    console.log(`  logoKey: ${JSON.stringify(logoKey)},`);
  }
  if (providerModelId) {
    console.log(`  providerModelId: ${JSON.stringify(providerModelId)},`);
  }
  if (pairedModelId) {
    console.log(`  pairedModelId: ${JSON.stringify(pairedModelId)},`);
  }
  if (promptPolicy) {
    console.log(`  promptPolicy: ${JSON.stringify(promptPolicy)},`);
  }
  if (admissionTier) {
    console.log(`  admissionTier: ${JSON.stringify(admissionTier)},`);
  }
  if (createCharacterModeOrder) {
    console.log(`  createCharacterModeOrder: ${createCharacterModeOrder},`);
  }
  console.log(`  generationLanes: ${toJsonArray(generationLanes)},`);
  console.log(`  executionMode: ${JSON.stringify(executionMode)},`);
  console.log(`  submitHandler: ${JSON.stringify(submitHandler)},`);
  console.log(`  gridEligible: true,`);
  if (apiRouteSlug) {
    console.log(`  apiRouteSlug: ${JSON.stringify(apiRouteSlug)},`);
  }
  console.log(`},\n`);

  console.log("Suggested API doc:");
  console.log(`- ${rootDocPath}\n`);

  if (isQueuedProviderModel) {
    const derivedRouteFileBase = suggestRouteFileBase(
      modelId,
      routeFileBase || apiRouteSlug,
    );
    const resolvedRouteValidator = routeValidator || "generic";

    console.log("Fal/Kie route inventory snippet:\n");
    console.log("{");
    console.log(`  fileBase: ${JSON.stringify(derivedRouteFileBase)},`);
    console.log(`  modelId: ${JSON.stringify(modelId)},`);
    console.log(`  provider: ${JSON.stringify(provider)},`);
    console.log(`  routeLabel: ${JSON.stringify(label)},`);
    if (statusRouteLabel) {
      console.log(`  statusRouteLabel: ${JSON.stringify(statusRouteLabel)},`);
    }
    console.log("  submitTimeoutMs: 20000,");
    console.log("  statusTimeoutMs: 60000,");
    console.log(`  validator: ${JSON.stringify(resolvedRouteValidator)},`);
    if (reExportValidator) {
      console.log("  reExportValidator: true,");
    }
    console.log("},\n");
  }

  if (isDirectProviderRuntimeModel) {
    const directRouteRequiredSymbols = resolveDirectRouteRequiredSymbols({
      provider,
      directRouteAuthority,
      directRouteRequiresBilling,
    });

    console.log("Direct provider route inventory snippet:\n");
    console.log("{");
    console.log(`  routePath: ${JSON.stringify(directRoutePath)},`);
    console.log(`  modelId: ${JSON.stringify(modelId)},`);
    console.log(`  provider: ${JSON.stringify(provider)},`);
    console.log(`  directRouteKind: ${JSON.stringify(directRouteKind)},`);
    console.log(`  authority: ${JSON.stringify(directRouteAuthority)},`);
    console.log("  requiredSymbols: [");
    for (const symbol of directRouteRequiredSymbols) {
      console.log(`    ${JSON.stringify(symbol)},`);
    }
    console.log("  ],");
    console.log("},\n");
  }

  console.log("Checklist:");
  console.log("- Verify provider docs and replace TODO values.");
  console.log("- Add catalog base entry and runtime metadata entry.");
  console.log(
    "- Reuse an existing adapter family if possible; only add new handler code for a new family.",
  );
  if (isQueuedProviderModel) {
    console.log(
      "- Add the route inventory entry in `scripts/lib/fal_route_inventory.js`.",
    );
    console.log(
      "- Run `npm -C frontend run fal:routes:sync` and review the generated wrappers.",
    );
    console.log("- Run `npm -C frontend run fal:routes:check`.");
  } else if (isDirectProviderRuntimeModel) {
    for (const line of resolveDirectRouteChecklistLines({
      directRouteAuthority,
      directRouteRequiresBilling,
    })) {
      console.log(line);
    }
  } else {
    console.log(
      "- Add or confirm route coverage if this is a queued provider model.",
    );
  }
  console.log("- Add the API doc and update parity expectations if needed.");
  console.log("- Run `npm -C frontend run model:doctor`.");
}

try {
  run();
} catch (error) {
  console.error(
    `[scaffold-model] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
