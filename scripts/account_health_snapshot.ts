#!/usr/bin/env npx tsx

import { loadLocalEnv } from "./lib/load_local_env.mjs";
import {
  asLookupMode,
  asPositiveInt,
  DEFAULT_DEEP_LOOKBACK_DAYS,
  MAX_DEEP_LOOKBACK_DAYS,
  type DeepLookupMode as LookupMode,
} from "../frontend/lib/server/adminUserHealth/deep";

type ParsedArgs = {
  lookup: string;
  lookupMode: LookupMode;
  lookbackDays: number;
  json: boolean;
  strict: boolean;
  help: boolean;
};

const usage = () => {
  console.error(
    [
      "Usage:",
      "  npx tsx scripts/account_health_snapshot.ts --lookup <email-or-user-id> [options]",
      "",
      "Options:",
      "  --lookup <value>         Email address or user id to inspect.",
      "  --account <value>        Alias for --lookup.",
      "  --lookup-mode <mode>     auto|email|user_id (default auto).",
      "  --lookback-days <n>      Lookback window for drain analysis (default 30).",
      "  --json                   Emit the raw snapshot as JSON.",
      "  --strict                 Exit non-zero if critical findings or compatibility warnings exist.",
      "  --env-file <path>        Optional env file path (repeatable).",
      "  --help                   Show this message.",
    ].join("\n")
  );
};

const readArgValues = (name: string): string[] => {
  const values: string[] = [];
  const prefixed = `${name}=`;
  for (let index = 0; index < process.argv.length; index += 1) {
    const token = process.argv[index];
    if (token === name) {
      const next = process.argv[index + 1];
      if (typeof next === "string") values.push(next);
      continue;
    }
    if (token.startsWith(prefixed)) {
      values.push(token.slice(prefixed.length));
    }
  }
  return values;
};

const readSingleArg = (names: string[]): string | null => {
  for (const name of names) {
    const values = readArgValues(name);
    if (values.length > 0) {
      return values[values.length - 1] ?? null;
    }
  }
  return null;
};

const hasFlag = (names: string[]): boolean => names.some((name) => process.argv.includes(name));

const parseArgs = (): ParsedArgs => {
  const lookup = readSingleArg(["--lookup", "--account"])?.trim() ?? "";
  const lookupMode = asLookupMode(readSingleArg(["--lookup-mode"]));
  const lookbackDays = Math.min(
    MAX_DEEP_LOOKBACK_DAYS,
    asPositiveInt(readSingleArg(["--lookback-days"]), DEFAULT_DEEP_LOOKBACK_DAYS)
  );

  const args = {
    lookup,
    lookupMode,
    lookbackDays,
    json: hasFlag(["--json"]),
    strict: hasFlag(["--strict"]),
    help: hasFlag(["--help", "-h"]),
  };

  return args;
};

const normalizeCountMap = (value: Record<string, number>): string =>
  Object.entries(value)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${key}=${count}`)
    .join(", ");

type AccountHealthSnapshot = Awaited<
  typeof import("../frontend/lib/server/adminUserHealth/snapshot").loadAdminHealthSnapshot
>;
type Snapshot = Awaited<ReturnType<AccountHealthSnapshot>>;
type OptionalQueueSummary = {
  queue?: {
    total: number;
    byStatus: Record<string, number>;
    exhaustedCount: number;
    exhaustedWithReleasedReservationCount: number;
    exhaustedWithChargeCount: number;
  };
};

const printHumanReport = (snapshot: Snapshot) => {
  const queue = (snapshot as Snapshot & OptionalQueueSummary).queue;

  console.log("[account-health] snapshot loaded");
  console.log(
    `[account-health] target lookup=${snapshot.target.lookup} mode=${snapshot.target.lookupMode} user_id=${snapshot.target.userId} email=${snapshot.target.email ?? "n/a"}`
  );
  console.log(
    `[account-health] account created_at=${snapshot.target.createdAt ?? "n/a"} last_sign_in_at=${snapshot.target.lastSignInAt ?? "n/a"}`
  );
  console.log(
    `[account-health] credits available_cents=${snapshot.credits.availableCents} reserved_cents=${snapshot.credits.reservedCents} spendable_cents=${snapshot.credits.spendableCents} total_debits_abs=${snapshot.credits.totalDebitsCentsAbs} generation_debits_abs=${snapshot.credits.generationDebitsCentsAbs}`
  );

  console.log(
    `[account-health] generations total=${snapshot.generations.total} by_status=${normalizeCountMap(snapshot.generations.byStatus)}`
  );
  console.log(
    `[account-health] generations last24h total=${snapshot.generations.last24h.total} success=${snapshot.generations.last24h.success} fail=${snapshot.generations.last24h.fail} fail_rate=${snapshot.generations.last24h.failRatePercent}%`
  );
  console.log(
    `[account-health] generations last7d total=${snapshot.generations.last7d.total} success=${snapshot.generations.last7d.success} fail=${snapshot.generations.last7d.fail} fail_rate=${snapshot.generations.last7d.failRatePercent}%`
  );
  console.log(
    `[account-health] generations last30d total=${snapshot.generations.last30d.total} success=${snapshot.generations.last30d.success} fail=${snapshot.generations.last30d.fail} fail_rate=${snapshot.generations.last30d.failRatePercent}%`
  );

  console.log(
    `[account-health] reservations total=${snapshot.reservations.total} by_status=${normalizeCountMap(snapshot.reservations.byStatus)} provider_attached_over_1h=${snapshot.reservations.reservedWithProviderOver1hCount} pre_submit_over_15m=${snapshot.reservations.reservedWithoutProviderOver15mCount}`
  );
  if (queue) {
    console.log(
      `[account-health] queue total=${queue.total} by_status=${normalizeCountMap(queue.byStatus)} exhausted=${queue.exhaustedCount} exhausted_with_released_reservation=${queue.exhaustedWithReleasedReservationCount} exhausted_with_charge=${queue.exhaustedWithChargeCount}`
    );
  } else {
    console.log("[account-health] queue summary: not included in current snapshot schema");
  }
  console.log(
    `[account-health] drainage cost_without_success_cents=${snapshot.drainage.costWithoutSuccessfulGeneration.debitCents} linked=${snapshot.drainage.costWithoutSuccessfulGeneration.linkedNonSuccessGeneration.debitCents} missing_linkage=${snapshot.drainage.costWithoutSuccessfulGeneration.missingLinkageData.debitCents}`
  );

  if (snapshot.compatibility.warnings.length > 0) {
    console.log("[account-health] compatibility warnings:");
    for (const warning of snapshot.compatibility.warnings) {
      console.log(`- ${warning}`);
    }
  } else {
    console.log("[account-health] compatibility warnings: none");
  }

  console.log("[account-health] findings:");
  for (const finding of snapshot.findings) {
    console.log(`- [${finding.severity}] ${finding.code}: ${finding.summary}`);
  }

  console.log("[account-health] next steps:");
  for (const step of snapshot.nextSteps) {
    console.log(`- ${step}`);
  }
};

const main = async () => {
  const args = parseArgs();

  if (args.help) {
    usage();
    return;
  }

  if (!args.lookup) {
    usage();
    throw new Error("Missing --lookup / --account value.");
  }

  loadLocalEnv({
    argv: process.argv.slice(2),
    defaultPaths: ["frontend/.env.local", ".env.local"],
  });

  const snapshotModule = await import("../frontend/lib/server/adminUserHealth/snapshot");
  const loadAdminHealthSnapshot =
    snapshotModule.loadAdminHealthSnapshot ?? snapshotModule.default?.loadAdminHealthSnapshot;

  if (typeof loadAdminHealthSnapshot !== "function") {
    throw new Error("loadAdminHealthSnapshot export is unavailable.");
  }

  const snapshot = await loadAdminHealthSnapshot({
    lookup: args.lookup,
    lookupMode: args.lookupMode,
    lookbackDays: args.lookbackDays,
  });

  if (args.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    printHumanReport(snapshot);
  }

  if (
    args.strict &&
    (snapshot.compatibility.warnings.length > 0 ||
      snapshot.findings.some((finding) => finding.severity === "critical"))
  ) {
    const reason = snapshot.compatibility.warnings.length > 0
      ? "compatibility warnings present"
      : "critical findings present";
    throw new Error(`Strict check failed: ${reason}.`);
  }
};

main().catch((error) => {
  console.error(`[account-health] error=${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
