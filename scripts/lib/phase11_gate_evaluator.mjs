#!/usr/bin/env node
/**
 * Shared Phase 11/13 gate evaluation helpers.
 * Purpose: normalize one-row SQL gate summaries into deterministic PASS/HOLD packets.
 */

export const DEFAULT_UNRESOLVED_THRESHOLD = 0.1;
export const DEFAULT_RECOVERY_THRESHOLD = 99;

/**
 * Parse numeric-like values with a fallback.
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
export const asNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") return fallback;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

/**
 * Parse boolean-like values with a fallback.
 * @param {unknown} value
 * @param {boolean} fallback
 * @returns {boolean}
 */
export const asBool = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
};

/**
 * Parse one-row gate JSON input (object or one-element array).
 * @param {string} input
 * @returns {Record<string, unknown>}
 */
export const parseGateRowInput = (input) => {
  const parsed = JSON.parse(input);
  if (Array.isArray(parsed)) {
    if (!parsed.length) throw new Error("Input JSON array is empty.");
    return parsed[0];
  }
  if (parsed && typeof parsed === "object") return parsed;
  throw new Error("Input JSON must be an object or one-row array.");
};

/**
 * Evaluate gate row values against locked thresholds.
 * @param {{
 *  row: Record<string, unknown>,
 *  windowLabel: string,
 *  unresolvedThreshold: number,
 *  recoveryThreshold: number,
 * }} params
 * @returns {Record<string, unknown>}
 */
export const summarizeGateRow = ({
  row,
  windowLabel,
  unresolvedThreshold,
  recoveryThreshold,
}) => {
  const duplicateSettlementCount = asNumber(row.duplicate_settlement_count);
  const duplicateMediaCount = asNumber(row.duplicate_media_persistence_count);
  const unresolvedPercent = asNumber(row.unresolved_no_media_percent);
  const recoveryPercent = asNumber(row.recovery_success_percent);
  const recoverySampleSize = asNumber(row.recovery_success_sample_size);

  const duplicateSettlementPass = asBool(
    row.duplicate_settlement_pass,
    duplicateSettlementCount === 0
  );
  const duplicateMediaPass = asBool(
    row.duplicate_media_persistence_pass,
    duplicateMediaCount === 0
  );
  const unresolvedPass = asBool(
    row.unresolved_no_media_pass,
    unresolvedPercent < unresolvedThreshold
  );

  const recoveryIsNA = recoverySampleSize === 0;
  const recoveryPass = recoveryIsNA
    ? null
    : asBool(row.recovery_success_pass, recoveryPercent >= recoveryThreshold);

  const requiredPasses =
    duplicateSettlementPass && duplicateMediaPass && unresolvedPass && (recoveryPass ?? true);
  const decision = requiredPasses ? "PASS" : "HOLD";

  return {
    evaluated_at_utc: new Date().toISOString(),
    window: windowLabel,
    start_at: row.start_at ?? null,
    end_at: row.end_at ?? null,
    duplicate_settlement_count: duplicateSettlementCount,
    duplicate_settlement_pass: duplicateSettlementPass,
    duplicate_media_persistence_count: duplicateMediaCount,
    duplicate_media_persistence_pass: duplicateMediaPass,
    unresolved_no_media_percent: unresolvedPercent,
    unresolved_no_media_pass: unresolvedPass,
    recovery_success_sample_size: recoverySampleSize,
    recovery_success_percent: recoveryPercent,
    recovery_success_pass: recoveryPass,
    recovery_success_evaluation: recoveryIsNA ? "N/A (sample size 0)" : recoveryPass ? "PASS" : "FAIL",
    decision,
    threshold_unresolved_percent: unresolvedThreshold,
    threshold_recovery_percent: recoveryThreshold,
  };
};

/**
 * Build human-readable summary lines for logs/evidence notes.
 * @param {Record<string, unknown>} summary
 * @returns {string[]}
 */
export const buildSummaryLines = (summary) => {
  return [
    "## Phase 11 Gate Evaluation",
    `- Window: ${summary.window}`,
    `- Interval: ${summary.start_at ?? "unknown"} -> ${summary.end_at ?? "unknown"}`,
    `- Duplicate settlement: ${summary.duplicate_settlement_count} (${summary.duplicate_settlement_pass ? "PASS" : "FAIL"})`,
    `- Duplicate media persistence: ${summary.duplicate_media_persistence_count} (${summary.duplicate_media_persistence_pass ? "PASS" : "FAIL"})`,
    `- Unresolved no-media: ${summary.unresolved_no_media_percent}% (< ${summary.threshold_unresolved_percent}% target) => ${summary.unresolved_no_media_pass ? "PASS" : "FAIL"}`,
    `- Recovery success: sample=${summary.recovery_success_sample_size}, rate=${summary.recovery_success_percent}% (>= ${summary.threshold_recovery_percent}% target) => ${summary.recovery_success_evaluation}`,
    `- Recommended decision: ${summary.decision}`,
  ];
};
