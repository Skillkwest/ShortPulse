const fs = require("fs");
const path = require("path");
const { REPO_ROOT, resolveFrontendPath } = require("./lib/repo_paths");

const FAL_ROUTES_DIR = resolveFrontendPath("pages", "api", "fal");
const {
  FAL_ROUTE_INVENTORY,
  listExpectedFalRouteFiles,
} = require("./lib/fal_route_inventory");

function parseArgs(argv) {
  return {
    check: argv.includes("--check"),
    write: argv.includes("--write"),
  };
}

function providerRouteConfigImport(provider, kind) {
  if (provider === "kie") {
    return kind === "submit"
      ? {
          urlFn: "getKieSubmitUrlRequired",
          timeoutFn: "getKieTimeoutMsOrDefault",
        }
      : {
          urlFn: "getKieStatusBaseUrlsRequired",
          timeoutFn: "getKieTimeoutMsOrDefault",
        };
  }
  return kind === "submit"
    ? {
        urlFn: "getFalSubmitUrlRequired",
        timeoutFn: "getFalTimeoutMsOrDefault",
      }
    : {
        urlFn: "getFalStatusBaseUrlsRequired",
        timeoutFn: "getFalTimeoutMsOrDefault",
      };
}

function renderGeneratedOwnershipHeader(entry, kind) {
  return [
    "// Generated compatibility wrapper. Do not hand edit.",
    `// Source of truth: scripts/lib/fal_route_inventory.js (${entry.fileBase} ${kind}).`,
    "// Regenerate with: npm -C frontend run fal:routes:sync",
    "",
  ];
}

function renderSubmitSource(entry) {
  const routeConfig = providerRouteConfigImport(entry.provider, "submit");
  const lines = [
    ...renderGeneratedOwnershipHeader(entry, "submit"),
    'import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";',
  ];

  if (entry.validator === "generic") {
    lines.push(
      'import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";',
    );
  } else if (entry.validator === "seedream-image") {
    lines.push(
      'import { validateSeedreamImageSizePayload } from "../../../lib/server/api/seedreamPayloadValidation";',
    );
  } else if (entry.validator === "seedream-edit") {
    lines.push(
      'import { validateSeedreamEditPayload } from "../../../lib/server/api/seedreamPayloadValidation";',
    );
  }

  lines.push(
    "import {",
    `  ${routeConfig.urlFn},`,
    `  ${routeConfig.timeoutFn},`,
    '} from "../../../lib/server/api/falRouteConfig";',
  );

  if (entry.reExportValidator) {
    lines.push("", "export { validateSeedreamEditPayload };");
  }

  const validatePayloadExpression =
    entry.validator === "generic"
      ? `validateFalPayloadForModel(${JSON.stringify(entry.modelId)})`
      : entry.validator === "seedream-image"
        ? "validateSeedreamImageSizePayload"
        : "validateSeedreamEditPayload";

  lines.push(
    "",
    "export default createFalSubmitHandler({",
    `  modelId: ${JSON.stringify(entry.modelId)},`,
  );
  if (entry.provider === "kie") {
    lines.push(`  provider: ${JSON.stringify(entry.provider)},`);
  }
  lines.push(
    `  submitUrl: ${routeConfig.urlFn}(${JSON.stringify(entry.modelId)}),`,
    `  routeLabel: ${JSON.stringify(entry.routeLabel)},`,
    `  timeoutMs: ${routeConfig.timeoutFn}(${JSON.stringify(entry.modelId)}, ${entry.submitTimeoutMs}),`,
    `  validatePayload: ${validatePayloadExpression},`,
    "});",
    "",
  );

  return `${lines.join("\n")}`;
}

function renderStatusSource(entry) {
  const routeConfig = providerRouteConfigImport(entry.provider, "status");
  const routeLabel = entry.statusRouteLabel || entry.routeLabel;
  const lines = [
    ...renderGeneratedOwnershipHeader(entry, "status"),
    'import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";',
    "import {",
    `  ${routeConfig.urlFn},`,
    `  ${routeConfig.timeoutFn},`,
    '} from "../../../lib/server/api/falRouteConfig";',
    "",
    "export default createFalStatusHandler({",
    `  modelId: ${JSON.stringify(entry.modelId)},`,
  ];

  if (entry.provider === "kie") {
    lines.push(`  provider: ${JSON.stringify(entry.provider)},`);
  }

  lines.push(
    `  queueBaseUrl: ${routeConfig.urlFn}(${JSON.stringify(entry.modelId)}),`,
    `  routeLabel: ${JSON.stringify(routeLabel)},`,
    `  timeoutMs: ${routeConfig.timeoutFn}(${JSON.stringify(entry.modelId)}, ${entry.statusTimeoutMs}),`,
    "});",
    "",
  );

  return lines.join("\n");
}

function syncExpectedRouteFiles() {
  const expectedFiles = new Set(listExpectedFalRouteFiles());
  const actualFiles = fs
    .readdirSync(FAL_ROUTES_DIR)
    .filter((file) => file.endsWith(".ts"));
  const unexpectedFiles = actualFiles.filter((file) => !expectedFiles.has(file));
  return { expectedFiles, unexpectedFiles };
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const shouldWrite = args.write || !args.check;
  const drift = [];

  for (const entry of FAL_ROUTE_INVENTORY) {
    const submitPath = path.join(FAL_ROUTES_DIR, `${entry.fileBase}-submit.ts`);
    const statusPath = path.join(FAL_ROUTES_DIR, `${entry.fileBase}-status.ts`);
    const expectedSubmitSource = renderSubmitSource(entry);
    const expectedStatusSource = renderStatusSource(entry);

    for (const [filePath, expectedSource] of [
      [submitPath, expectedSubmitSource],
      [statusPath, expectedStatusSource],
    ]) {
      const currentSource = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
      if (currentSource !== expectedSource) {
        drift.push(path.relative(REPO_ROOT, filePath));
        if (shouldWrite) {
          fs.writeFileSync(filePath, expectedSource, "utf8");
        }
      }
    }
  }

  const { unexpectedFiles } = syncExpectedRouteFiles();
  if (unexpectedFiles.length) {
    drift.push(
      ...unexpectedFiles.map((file) =>
        path.relative(REPO_ROOT, path.join(FAL_ROUTES_DIR, file)),
      ),
    );
    if (shouldWrite) {
      for (const file of unexpectedFiles) {
        fs.unlinkSync(path.join(FAL_ROUTES_DIR, file));
      }
    }
  }

  if (args.check) {
    if (drift.length) {
      console.error("[fal-routes] Drift detected:");
      for (const file of drift) {
        console.error(`- ${file}`);
      }
      process.exit(1);
    }
    console.log(`[fal-routes] OK (${FAL_ROUTE_INVENTORY.length} route families checked)`);
    return;
  }

  console.log(
    `[fal-routes] ${drift.length ? `Updated ${drift.length} file(s)` : `No changes (${FAL_ROUTE_INVENTORY.length} route families checked)`}`,
  );
}

run();
