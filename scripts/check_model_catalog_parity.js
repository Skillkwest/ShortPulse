// Model catalog parity checks for API docs and runtime governance.
// Run with: node scripts/check_model_catalog_parity.js
// Optional env:
// - SHORTPULSE_MODEL_CATALOG_MAX_STALE_DAYS=45
// - SHORTPULSE_MODEL_CATALOG_STALE_MODE=warn|enforce
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const REPO_ROOT = process.cwd();
const FRONTEND_ROOT = path.join(REPO_ROOT, "frontend");
const MODEL_CATALOG_PATH = path.join(
  FRONTEND_ROOT,
  "lib",
  "model-runtime",
  "modelCatalog.ts",
);
const FAL_ROUTES_DIR = path.join(FRONTEND_ROOT, "pages", "api", "fal");
const DOCS_API_DIR = path.join(REPO_ROOT, "docs", "api");
const DOCS_API_INDEX = path.join(DOCS_API_DIR, "README.md");
const DOCS_ROOT_INDEX = path.join(REPO_ROOT, "docs", "README.md");
const MAX_STALE_DAYS = Number(process.env.SHORTPULSE_MODEL_CATALOG_MAX_STALE_DAYS || 45);
const STALE_MODE_RAW = String(process.env.SHORTPULSE_MODEL_CATALOG_STALE_MODE || "warn")
  .trim()
  .toLowerCase();
const STALE_MODE = STALE_MODE_RAW === "enforce" ? "enforce" : "warn";

const MODEL_DOC_MAP = {
  "fal-ai/flux-2/klein/9b": "api-fal-flux-2-klein-9b.md",
  "fal/flux-2": "api-fal-flux-2.md",
  "fal/flux-2/edit": "api-fal-flux-2-edit.md",
  "fal/flux-2-pro": "api-fal-flux-2-pro.md",
  "fal/flux-2-pro/edit": "api-fal-flux-2-pro-edit.md",
  "fal-ai/nano-banana": "api-fal-nano-banana.md",
  "fal-ai/nano-banana/edit": "api-fal-nano-banana-edit.md",
  "fal-ai/nano-banana-pro": "api-fal-nano-banana-pro.md",
  "fal-ai/nano-banana-pro/edit": "api-fal-nano-banana-pro-edit.md",
  "fal-ai/bytedance/seedream/v4.5/text-to-image": "api-fal-seedream-4-5.md",
  "fal-ai/bytedance/seedream/v4.5/edit": "api-fal-seedream-4-5-edit.md",
  "fal-ai/kling-video/v3/pro/text-to-video": "api-fal-kling-3-pro-text-to-video.md",
  "fal-ai/kling-video/v3/pro/image-to-video": "api-fal-kling-3-pro-image-to-video.md",
  "fal-ai/veo3.1": "api-fal-veo3.md",
  "fal-ai/veo3.1/image-to-video": "api-fal-veo3-image-to-video.md",
  "fal-ai/veo3.1/first-last-frame-to-video": "api-fal-veo3-first-last-frame.md",
  "fal-ai/sora-2/text-to-video/pro": "api-fal-sora-2-pro.md",
  "fal-ai/bytedance/seedance/v1.5/pro/text-to-video": "api-fal-seedance-1-5-pro.md",
  "fal-ai/bytedance/seedance/v1.5/pro/image-to-video": "api-fal-seedance-1-5-pro-i2v.md",
  "kie-ai/veo-3.1-fast-i2v": "api-kie-veo-3-1-fast-image-to-video.md",
  "kie-ai/kling-3.0": "api-kie-kling-3-0.md",
  "gpt-5-nano": "api-responses.md",
};

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

const tsModuleCache = new Map();

function resolveLocalModule(fromFilePath, requestPath) {
  const base = path.resolve(path.dirname(fromFilePath), requestPath);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.js`,
    path.join(base, "index.ts"),
    path.join(base, "index.js"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function loadTsModule(filePath) {
  const normalizedPath = path.resolve(filePath);
  if (tsModuleCache.has(normalizedPath)) {
    return tsModuleCache.get(normalizedPath);
  }

  const ts = require(path.join(FRONTEND_ROOT, "node_modules", "typescript"));
  const source = readText(normalizedPath);
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: normalizedPath,
  }).outputText;

  const moduleRecord = { exports: {} };
  tsModuleCache.set(normalizedPath, moduleRecord.exports);

  const localRequire = (requestPath) => {
    if (typeof requestPath === "string" && requestPath.startsWith(".")) {
      const resolved = resolveLocalModule(normalizedPath, requestPath);
      if (!resolved) {
        throw new Error(`Cannot resolve module '${requestPath}' from '${normalizedPath}'`);
      }
      if (resolved.endsWith(".ts")) {
        return loadTsModule(resolved);
      }
      return require(resolved);
    }
    return require(requestPath);
  };

  const sandbox = {
    module: moduleRecord,
    exports: moduleRecord.exports,
    require: localRequire,
    __dirname: path.dirname(normalizedPath),
    __filename: normalizedPath,
    process,
    console,
  };

  new vm.Script(transpiled, { filename: normalizedPath }).runInNewContext(sandbox);
  tsModuleCache.set(normalizedPath, sandbox.module.exports);
  return sandbox.module.exports;
}

function daysBetween(startIso, endIso) {
  const ms = endIso.getTime() - startIso.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function listFalSubmitRouteModelIds() {
  const files = fs
    .readdirSync(FAL_ROUTES_DIR)
    .filter((name) => name.endsWith("-submit.ts") || name === "submit.ts");

  const modelIds = new Set();
  for (const fileName of files) {
    const content = readText(path.join(FAL_ROUTES_DIR, fileName));
    const match = content.match(/modelId:\s*"([^"]+)"/);
    if (!match) continue;
    modelIds.add(match[1]);
  }
  return modelIds;
}

function listFalSubmitRouteDefinitions() {
  const files = fs
    .readdirSync(FAL_ROUTES_DIR)
    .filter((name) => name.endsWith("-submit.ts") || name === "submit.ts");

  return files.map((fileName) => {
    const content = readText(path.join(FAL_ROUTES_DIR, fileName));
    const modelIdMatch = content.match(/modelId:\s*"([^"]+)"/);
    const validatePayloadMatch = content.match(/validatePayload\s*:\s*([A-Za-z0-9_()."'\s-]+)/);
    const helperValidatorMatch = content.match(
      /validatePayload\s*:\s*validateFalPayloadForModel\("([^"]+)"\)/
    );

    return {
      fileName,
      modelId: modelIdMatch ? modelIdMatch[1] : null,
      hasValidatePayload: Boolean(validatePayloadMatch),
      helperValidatorModelId: helperValidatorMatch ? helperValidatorMatch[1] : null,
    };
  });
}

function run() {
  const errors = [];
  const warnings = [];
  const today = new Date();

  if (STALE_MODE_RAW && STALE_MODE_RAW !== "warn" && STALE_MODE_RAW !== "enforce") {
    warnings.push(
      `Unknown SHORTPULSE_MODEL_CATALOG_STALE_MODE='${STALE_MODE_RAW}', defaulting to 'warn'.`,
    );
  }

  const modelCatalogModule = loadTsModule(MODEL_CATALOG_PATH);
  const listModelCatalogEntries = modelCatalogModule.listModelCatalogEntries;
  if (typeof listModelCatalogEntries !== "function") {
    throw new Error("listModelCatalogEntries export missing from modelCatalog.ts");
  }

  const entries = listModelCatalogEntries();
  if (!Array.isArray(entries) || !entries.length) {
    errors.push("Model catalog is empty.");
  }

  const seenIds = new Set();
  for (const entry of entries) {
    const modelId = String(entry.modelId || "").trim();
    if (!modelId) {
      errors.push("Encountered catalog entry without modelId.");
      continue;
    }
    if (seenIds.has(modelId)) {
      errors.push(`Duplicate modelId in catalog: ${modelId}`);
    }
    seenIds.add(modelId);

    const sourceUrl = String(entry.sourceUrl || "").trim();
    if (!/^https?:\/\//i.test(sourceUrl)) {
      errors.push(`Catalog sourceUrl missing/invalid for ${modelId}`);
    }

    const verifiedAt = String(entry.verifiedAt || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt)) {
      errors.push(`verifiedAt must be YYYY-MM-DD for ${modelId}`);
    } else {
      const parsed = new Date(`${verifiedAt}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) {
        errors.push(`verifiedAt is not a valid date for ${modelId}: ${verifiedAt}`);
      } else {
        const ageDays = daysBetween(parsed, today);
        if (ageDays > MAX_STALE_DAYS) {
          const staleMessage = `Catalog verification is stale for ${modelId}: ${verifiedAt} (${ageDays} days old; max ${MAX_STALE_DAYS}).`;
          if (STALE_MODE === "enforce") {
            errors.push(staleMessage);
          } else {
            warnings.push(staleMessage);
          }
        }
      }
    }

    if (entry.provider === "fal") {
      if (!String(entry.falSubmitUrl || "").trim()) {
        errors.push(`falSubmitUrl missing for Fal model ${modelId}`);
      }
      if (!Array.isArray(entry.falStatusBaseUrls) || entry.falStatusBaseUrls.length === 0) {
        errors.push(`falStatusBaseUrls missing for Fal model ${modelId}`);
      }
      if (!entry.payloadValidation) {
        errors.push(`payloadValidation missing for Fal model ${modelId}`);
      }
    }

    const mappedDoc = MODEL_DOC_MAP[modelId];
    if (!mappedDoc) {
      errors.push(`Missing MODEL_DOC_MAP entry for ${modelId}`);
      continue;
    }

    const docPath = path.join(DOCS_API_DIR, mappedDoc);
    if (!fs.existsSync(docPath)) {
      errors.push(`Missing mapped API doc for ${modelId}: docs/api/${mappedDoc}`);
      continue;
    }

    const docText = readText(docPath);
    if (!docText.includes(modelId) && !docText.includes(sourceUrl)) {
      errors.push(
        `Mapped doc docs/api/${mappedDoc} does not reference model id or source URL for ${modelId}`,
      );
    }
  }

  const falSubmitModelIds = listFalSubmitRouteModelIds();
  const falSubmitRouteDefinitions = listFalSubmitRouteDefinitions();
  for (const modelId of falSubmitModelIds) {
    if (!seenIds.has(modelId)) {
      errors.push(`Fal submit route references unknown catalog model id: ${modelId}`);
    }
  }

  const falCatalogModelIds = entries
    .filter((entry) => entry.provider === "fal" && String(entry.falSubmitUrl || "").trim().length > 0)
    .map((entry) => entry.modelId);

  for (const modelId of falCatalogModelIds) {
    if (!falSubmitModelIds.has(modelId)) {
      errors.push(`Catalog Fal model missing submit route coverage: ${modelId}`);
    }
  }

  for (const route of falSubmitRouteDefinitions) {
    const routeLabel = `frontend/pages/api/fal/${route.fileName}`;
    if (!route.modelId) {
      errors.push(`${routeLabel} missing modelId in createFalSubmitHandler config.`);
      continue;
    }
    if (!route.hasValidatePayload) {
      errors.push(`${routeLabel} missing validatePayload in createFalSubmitHandler config.`);
      continue;
    }
    if (route.helperValidatorModelId && route.helperValidatorModelId !== route.modelId) {
      errors.push(
        `${routeLabel} validateFalPayloadForModel id mismatch: modelId='${route.modelId}' validate='${route.helperValidatorModelId}'.`,
      );
    }
  }

  const apiIndexText = readText(DOCS_API_INDEX);
  const docsRootText = readText(DOCS_ROOT_INDEX);
  const mappedDocs = new Set(Object.values(MODEL_DOC_MAP));

  for (const fileName of mappedDocs) {
    if (!apiIndexText.includes(`docs/api/${fileName}`)) {
      errors.push(`docs/api/README.md missing entry for docs/api/${fileName}`);
    }
    if (!docsRootText.includes(`docs/api/${fileName}`)) {
      errors.push(`docs/README.md missing entry for docs/api/${fileName}`);
    }
  }

  if (warnings.length) {
    console.warn("Model catalog parity warnings:");
    warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  if (errors.length) {
    console.error("Model catalog parity checks failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log("Model catalog parity checks passed.");
}

run();
