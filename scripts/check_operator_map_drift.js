// Operator map drift check.
// Purpose: enforce a canonical, machine-checkable operator map contract in docs.
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.cwd();
const DEFAULT_OPERATOR_MAP_PATH = path.join(
  REPO_ROOT,
  "docs",
  "operator-map.md",
);
const DEFAULT_DOCS_INDEX_PATH = path.join(REPO_ROOT, "docs", "README.md");

const REQUIRED_COLUMNS = [
  "system_id",
  "surface",
  "entrypoints",
  "scheduler",
  "data stores",
  "primary signals",
  "primary runbook",
  "kill switches/flags",
  "primary owner",
  "backup owner",
  "last validated",
];

const REQUIRED_SYSTEM_IDS = [
  "generation_submit_queue_recovery",
  "fal_webhook_shared_recovery_execution",
  "credits_reservation_settlement",
  "stripe_webhook_billing_adjustments",
  "media_upload_list_sign_resolve",
  "media_derivative_worker",
  "adaptive_media_reference_grid_rendering",
  "ai_agent_safety_control_plane",
  "admin_incident_ingestion_triage",
  "admin_user_health_fleet",
  "deployment_route_parity_scheduler_controls",
  "security_boundary_auth_rls_storage",
];

const REQUIRED_OPERATIONAL_ROUTES = [
  "/api/internal/generation-recovery/run",
  "/api/internal/media-derivatives/run",
  "/api/internal/admin-user-health-fleet/run",
  "/api/internal/billing-contract-renewals/run",
  "/api/internal/credit-expirations/run",
];

const OWNER_PLACEHOLDER_PATTERN =
  /^(tbd|todo|unknown|unassigned|n\/a|na|-|none|null|<.*>)$/i;

function resolveInputPath(rawPath, fallbackAbsolutePath) {
  if (!rawPath || !rawPath.trim()) {
    return fallbackAbsolutePath;
  }
  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }
  return path.join(REPO_ROOT, rawPath);
}

function readTextOrFail(filePath, errors, label) {
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing ${label}: ${path.relative(REPO_ROOT, filePath)}`);
    return "";
  }
  return fs.readFileSync(filePath, "utf8");
}

function parseTableRow(rowLine) {
  return rowLine
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((value) => value.trim());
}

function normalizeHeader(value) {
  return value.trim().toLowerCase();
}

function stripBackticks(value) {
  return value.replace(/`/g, "").trim();
}

function extractSystemRegistryRows(operatorMapText, errors) {
  const heading = "## System Registry";
  const headingIndex = operatorMapText.indexOf(heading);
  if (headingIndex < 0) {
    errors.push('Missing "## System Registry" section in docs/operator-map.md');
    return [];
  }

  const sectionLines = operatorMapText.slice(headingIndex).split(/\r?\n/);
  const tableLines = [];

  for (let i = 1; i < sectionLines.length; i += 1) {
    const trimmed = sectionLines[i].trim();
    if (trimmed.startsWith("|")) {
      tableLines.push(sectionLines[i]);
      continue;
    }
    if (tableLines.length > 0) {
      break;
    }
  }

  if (tableLines.length < 3) {
    errors.push("System Registry table is missing or incomplete.");
    return [];
  }

  const headerCells = parseTableRow(tableLines[0]).map(normalizeHeader);
  const requiredHeaders = REQUIRED_COLUMNS.map((column) =>
    normalizeHeader(column),
  );
  if (headerCells.length !== requiredHeaders.length) {
    errors.push(
      `System Registry header column count mismatch: expected ${requiredHeaders.length}, got ${headerCells.length}.`,
    );
    return [];
  }

  for (let i = 0; i < requiredHeaders.length; i += 1) {
    if (headerCells[i] !== requiredHeaders[i]) {
      errors.push(
        `System Registry header mismatch at column ${i + 1}: expected "${requiredHeaders[i]}", got "${headerCells[i]}".`,
      );
    }
  }

  const rows = [];
  for (const dataLine of tableLines.slice(2)) {
    const cells = parseTableRow(dataLine);
    if (!cells.length) {
      continue;
    }
    if (cells.length !== requiredHeaders.length) {
      errors.push(
        `System Registry row has ${cells.length} columns; expected ${requiredHeaders.length}. Row: ${dataLine.trim()}`,
      );
      continue;
    }

    const row = {};
    for (let i = 0; i < requiredHeaders.length; i += 1) {
      row[requiredHeaders[i]] = cells[i];
    }
    rows.push(row);
  }

  if (rows.length === 0) {
    errors.push("System Registry contains no data rows.");
  }

  return rows;
}

function fileExistsWithMarkdownFallback(targetPath) {
  if (fs.existsSync(targetPath)) {
    return true;
  }
  if (!path.extname(targetPath)) {
    if (fs.existsSync(`${targetPath}.md`)) {
      return true;
    }
    if (fs.existsSync(path.join(targetPath, "README.md"))) {
      return true;
    }
    if (fs.existsSync(path.join(targetPath, "index.md"))) {
      return true;
    }
  }
  return false;
}

function validateRunbookLinks(value, errors, systemId, operatorMapPath) {
  const linkMatches = [...value.matchAll(/\[[^\]]+]\(([^)]+)\)/g)];
  if (linkMatches.length === 0) {
    errors.push(
      `system_id "${systemId}" must include at least one markdown link in "primary runbook".`,
    );
    return;
  }

  let hasResolvableLocalLink = false;
  for (const match of linkMatches) {
    const target = (match[1] || "").trim();
    if (!target || /^https?:\/\//i.test(target) || target.startsWith("#")) {
      continue;
    }
    const normalized = target.split("#")[0].split("?")[0];
    const resolved = normalized.startsWith("/")
      ? path.join(REPO_ROOT, normalized.slice(1))
      : normalized.startsWith("docs/")
        ? path.join(REPO_ROOT, normalized)
        : path.resolve(path.dirname(operatorMapPath), normalized);
    if (fileExistsWithMarkdownFallback(resolved)) {
      hasResolvableLocalLink = true;
      break;
    }
  }

  if (!hasResolvableLocalLink) {
    errors.push(
      `system_id "${systemId}" has no valid local doc/runbook link in "primary runbook".`,
    );
  }
}

function validateDateNotFuture(rawDate, errors, systemId) {
  const value = stripBackticks(rawDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    errors.push(
      `system_id "${systemId}" has invalid "last validated" date format: "${rawDate}"`,
    );
    return;
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    errors.push(
      `system_id "${systemId}" has unparsable "last validated" date: "${rawDate}"`,
    );
    return;
  }
  const now = new Date();
  const todayIso = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(
    now.getUTCDate(),
  ).padStart(2, "0")}`;
  if (value > todayIso) {
    errors.push(
      `system_id "${systemId}" has future "last validated" date ${value} (today UTC ${todayIso}).`,
    );
  }
}

function validateOwnerField(rawOwner, ownerField, errors, systemId) {
  const value = stripBackticks(rawOwner);
  if (!value) {
    errors.push(`system_id "${systemId}" has empty "${ownerField}" value.`);
    return;
  }
  if (OWNER_PLACEHOLDER_PATTERN.test(value)) {
    errors.push(
      `system_id "${systemId}" has placeholder "${ownerField}" value "${rawOwner}".`,
    );
  }
}

function run() {
  const errors = [];
  const operatorMapPath = resolveInputPath(
    process.env.SHORTPULSE_OPERATOR_MAP_PATH,
    DEFAULT_OPERATOR_MAP_PATH,
  );
  const docsIndexPath = resolveInputPath(
    process.env.SHORTPULSE_DOCS_INDEX_PATH,
    DEFAULT_DOCS_INDEX_PATH,
  );

  const operatorMapText = readTextOrFail(
    operatorMapPath,
    errors,
    "operator map doc",
  );
  const docsIndexText = readTextOrFail(docsIndexPath, errors, "docs index");

  if (docsIndexText && !docsIndexText.includes("docs/operator-map.md")) {
    errors.push(
      `${path.relative(REPO_ROOT, docsIndexPath)} must index docs/operator-map.md.`,
    );
  }

  const rows = operatorMapText
    ? extractSystemRegistryRows(operatorMapText, errors)
    : [];
  const bySystemId = new Map();
  const entrypointValues = [];

  for (const row of rows) {
    const systemId = stripBackticks(row["system_id"] || "");
    if (!systemId) {
      errors.push("Found System Registry row with empty system_id.");
      continue;
    }
    if (bySystemId.has(systemId)) {
      errors.push(`Duplicate system_id found: "${systemId}".`);
      continue;
    }
    bySystemId.set(systemId, row);

    entrypointValues.push(row["entrypoints"] || "");
    validateOwnerField(
      row["primary owner"] || "",
      "primary owner",
      errors,
      systemId,
    );
    validateOwnerField(
      row["backup owner"] || "",
      "backup owner",
      errors,
      systemId,
    );
    validateRunbookLinks(
      row["primary runbook"] || "",
      errors,
      systemId,
      operatorMapPath,
    );
    validateDateNotFuture(row["last validated"] || "", errors, systemId);
  }

  for (const requiredSystemId of REQUIRED_SYSTEM_IDS) {
    if (!bySystemId.has(requiredSystemId)) {
      errors.push(`Missing required system_id row: "${requiredSystemId}".`);
    }
  }

  const entrypointsJoined = entrypointValues.join(" ");
  for (const requiredRoute of REQUIRED_OPERATIONAL_ROUTES) {
    if (!entrypointsJoined.includes(requiredRoute)) {
      errors.push(
        `Required operational route missing from entrypoints: ${requiredRoute}`,
      );
    }
  }

  if (errors.length > 0) {
    console.error("Operator map drift check failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `Operator map drift check passed (${path.relative(REPO_ROOT, operatorMapPath)}; ${rows.length} system rows).`,
  );
}

run();
