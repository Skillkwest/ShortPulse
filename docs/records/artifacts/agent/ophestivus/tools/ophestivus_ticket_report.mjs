#!/usr/bin/env node
/* global console */

/**
 * Ophestivus ticket report formatter.
 *
 * Builds compact, board-safe ticket reports with a reserved approval-note
 * budget so Review -> Complete can append approval context without manual
 * shorten/dry-run loops.
 */

import process from "node:process";
import { pathToFileURL } from "node:url";

const DETAILS_MAX_LENGTH = 1000;
const DEFAULT_APPROVAL_RESERVE = 420;
const MIN_FIELD_CAP = 8;
const RISK_CLASSIFICATIONS = new Set(["accepted", "monitor", "follow-up", "human-review"]);
const VERIFICATION_CLASSES = new Set([
  "live-route-verified",
  "tests-and-data-verified",
  "telemetry-filter-verified",
  "blocked-live-verification",
]);
const RESOLUTION_TYPES = new Map([
  ["new-code", "New code fix"],
  ["verified-existing-fix", "Verified existing fix"],
  ["no-code", "No-code verification"],
  ["config", "Config/operational fix"],
  ["data", "Data correction"],
]);
const STALE_LOCAL_BUNDLE_NOTE =
  "refresh browser and restart dev server if the old chunk is still loaded.";

const usage = () => {
  console.log(
    [
      "Usage:",
      "  npm run ophestivus:compact-ticket-report -- --incident <id> --issue <text> --resolution-type <type> --repo-changes <text> --validation <text> --recurrence <text> --risk-class <class> --risk <text>",
      "",
      "Options:",
      "  --incident <id>              Incident or task id.",
      "  --issue <text>               Short issue summary.",
      "  --resolution-type <type>     new-code | verified-existing-fix | no-code | config | data.",
      "  --repo-changes <text>        Code/data/doc change summary.",
      "  --validation <text>          Test/check summary.",
      "  --verification-class <class> live-route-verified | tests-and-data-verified | telemetry-filter-verified | blocked-live-verification.",
      "  --recurrence <text>          Incident recurrence summary.",
      "  --risk-class <class>         accepted | monitor | follow-up | human-review.",
      "  --risk <text>                Residual risk text.",
      "  --report-path <path>         Repo-relative path to the full local Ophestivus report.",
      "  --local-dev-note             Add stale local bundle/dev server note.",
      "  --approval-reserve <number>  Characters reserved for Review approval note. Defaults to 420.",
      "  --max-length <number>        Board details max length. Defaults to 1000.",
      "  --json                       Print JSON only.",
      "  --help                       Show this help.",
    ].join("\n")
  );
};

const hasFlag = (flag) => process.argv.includes(flag);

const readOption = (name) => {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
};

const normalizeText = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const normalizePositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  return normalized > 0 ? normalized : fallback;
};

const formatRiskClass = (value) => {
  const normalized = normalizeText(value || "accepted").toLowerCase();
  if (!RISK_CLASSIFICATIONS.has(normalized)) {
    throw new Error(`--risk-class must be one of: ${Array.from(RISK_CLASSIFICATIONS).join(", ")}.`);
  }
  return normalized;
};

const formatResolutionType = (value) => {
  const normalized = normalizeText(value || "new-code").toLowerCase();
  const label = RESOLUTION_TYPES.get(normalized);
  if (!label) {
    throw new Error(
      `--resolution-type must be one of: ${Array.from(RESOLUTION_TYPES.keys()).join(", ")}.`
    );
  }
  return label;
};

const formatVerificationClass = (value) => {
  const normalized = normalizeText(value || "tests-and-data-verified").toLowerCase();
  if (!VERIFICATION_CLASSES.has(normalized)) {
    throw new Error(
      `--verification-class must be one of: ${Array.from(VERIFICATION_CLASSES).join(", ")}.`
    );
  }
  return normalized;
};

const truncate = (value, maxLength) => {
  const text = normalizeText(value);
  if (text.length <= maxLength) return text;
  if (maxLength <= 3) return text.slice(0, maxLength);
  return `${text.slice(0, maxLength - 3)}...`;
};

const buildReportText = (entries) =>
  entries
    .filter((entry) => entry.value)
    .map((entry) => {
      const renderedValue = truncate(entry.value, entry.cap);
      if (!renderedValue) return null;
      return `${entry.label}: ${renderedValue}`;
    })
    .filter(Boolean)
    .join("\n");

const compactEntriesToLimit = (initialEntries, targetLength) => {
  const entries = initialEntries.map((entry) => ({ ...entry }));
  let report = buildReportText(entries);

  while (report.length > targetLength) {
    const candidates = entries
      .filter(
        (entry) =>
          !entry.preserveFull &&
          entry.cap > (entry.minCap ?? MIN_FIELD_CAP) &&
          entry.value
      )
      .sort((left, right) => right.cap - left.cap);
    const candidate = candidates[0];
    if (!candidate) {
      const dropCandidate = entries.find((entry) => entry.dropWhenTight && entry.value);
      if (!dropCandidate) break;
      dropCandidate.value = "";
      report = buildReportText(entries);
      continue;
    }

    const excess = report.length - targetLength;
    candidate.cap = Math.max(
      candidate.minCap ?? MIN_FIELD_CAP,
      candidate.cap - Math.max(8, excess)
    );
    report = buildReportText(entries);
  }

  if (report.length > targetLength) {
    return truncate(report, targetLength);
  }

  return report;
};

/**
 * Builds a compact Ophestivus review report that leaves approval-note room.
 */
const buildCompactTicketReport = ({
  incidentId,
  issue,
  resolutionType,
  repoChanges,
  validation,
  verificationClass,
  recurrence,
  riskClass,
  residualRisk,
  reportPath,
  includeLocalDevNote = false,
  maxLength = DETAILS_MAX_LENGTH,
  approvalReserve = DEFAULT_APPROVAL_RESERVE,
}) => {
  const normalizedRiskClass = formatRiskClass(riskClass);
  const normalizedResolutionType = formatResolutionType(resolutionType);
  const normalizedVerificationClass = formatVerificationClass(verificationClass);
  const normalizedReportPath = normalizeText(reportPath);
  const targetLength = Math.max(120, maxLength - approvalReserve);
  const riskText = [normalizedRiskClass, normalizeText(residualRisk)].filter(Boolean).join(" - ");
  const entries = [
    { label: "Incident", value: incidentId, cap: 90, minCap: 8 },
    { label: "Issue", value: issue, cap: 120, minCap: 12 },
    { label: "Resolution", value: normalizedResolutionType, cap: 80, minCap: 8 },
    { label: "Repo changes", value: repoChanges, cap: 135, minCap: 10 },
    { label: "Validation", value: validation, cap: 135, minCap: 10 },
    { label: "Verification class", value: normalizedVerificationClass, cap: 90, minCap: 8 },
    { label: "Recurrence", value: recurrence, cap: 115, minCap: 10 },
    { label: "Residual risk", value: riskText, cap: 135, minCap: 10 },
    {
      label: "Report",
      value: normalizedReportPath,
      cap: Math.max(170, normalizedReportPath.length),
      minCap: normalizedReportPath.length,
      preserveFull: true,
    },
    {
      label: "Local dev note",
      value: includeLocalDevNote ? STALE_LOCAL_BUNDLE_NOTE : "",
      cap: 110,
      minCap: 16,
      dropWhenTight: true,
    },
  ];
  const details = compactEntriesToLimit(entries, targetLength);

  return {
    details,
    detailsLength: details.length,
    maxLength,
    approvalReserve,
    remainingForApproval: maxLength - details.length,
    riskClass: normalizedRiskClass,
    resolutionType: normalizedResolutionType,
    verificationClass: normalizedVerificationClass,
    localDevNote: includeLocalDevNote ? STALE_LOCAL_BUNDLE_NOTE : null,
  };
};

/**
 * Validates the compact ticket summary before a ticket can enter Review.
 */
const validateCompactTicketReportEvidence = (
  report,
  { requiredReportPath = "", approvalReserve = DEFAULT_APPROVAL_RESERVE } = {}
) => {
  const errors = [];
  const details = normalizeText(report?.details);
  const reportPath = normalizeText(requiredReportPath);
  const remainingForApproval = Number(report?.remainingForApproval ?? 0);
  const detailsLength = Number(report?.detailsLength ?? details.length);
  const maxLength = Number(report?.maxLength ?? DETAILS_MAX_LENGTH);

  if (!details) {
    errors.push("Compact ticket summary is empty.");
  }
  if (detailsLength > maxLength) {
    errors.push(`Compact ticket summary exceeds board limit: ${detailsLength}/${maxLength}.`);
  }
  if (remainingForApproval < approvalReserve) {
    errors.push(
      `Compact ticket summary leaves ${remainingForApproval} approval characters; expected at least ${approvalReserve}.`
    );
  }
  if (reportPath && !details.includes(`Report: ${reportPath}`)) {
    errors.push("Compact ticket summary does not include the full local report path.");
  }
  if (/Report: [^\n]*\.\.\./.test(details)) {
    errors.push("Compact ticket summary contains a truncated Report path.");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
};

const emit = (payload, { jsonOnly }) => {
  if (jsonOnly) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (!payload.ok) {
    console.error(`[ophestivus:compact-ticket-report] ${payload.error}`);
    return;
  }

  console.log(payload.report.details);
  console.log("");
  console.log(
    `[ophestivus:compact-ticket-report] details ${payload.report.detailsLength}/${payload.report.maxLength}; approval reserve ${payload.report.approvalReserve}`
  );
};

const run = () => {
  const jsonOnly = hasFlag("--json");
  if (hasFlag("--help") || hasFlag("-h")) {
    usage();
    return;
  }

  const report = buildCompactTicketReport({
    incidentId: readOption("--incident"),
    issue: readOption("--issue"),
    resolutionType: readOption("--resolution-type"),
    repoChanges: readOption("--repo-changes"),
    validation: readOption("--validation"),
    verificationClass: readOption("--verification-class"),
    recurrence: readOption("--recurrence"),
    riskClass: readOption("--risk-class"),
    residualRisk: readOption("--risk"),
    reportPath: readOption("--report-path"),
    includeLocalDevNote: hasFlag("--local-dev-note"),
    maxLength: normalizePositiveInteger(readOption("--max-length"), DETAILS_MAX_LENGTH),
    approvalReserve: normalizePositiveInteger(
      readOption("--approval-reserve"),
      DEFAULT_APPROVAL_RESERVE
    ),
  });

  emit({ ok: true, report }, { jsonOnly });
};

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  try {
    run();
  } catch (error) {
    emit(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { jsonOnly: hasFlag("--json") }
    );
    process.exitCode = 1;
  }
}

export {
  DEFAULT_APPROVAL_RESERVE,
  DETAILS_MAX_LENGTH,
  RISK_CLASSIFICATIONS,
  STALE_LOCAL_BUNDLE_NOTE,
  VERIFICATION_CLASSES,
  buildCompactTicketReport,
  formatVerificationClass,
  validateCompactTicketReportEvidence,
};
