#!/usr/bin/env node

/**
 * Marks one Admin Tester Report reviewed using only Hybervees-owned metadata.
 */

import {
  fail,
  getSupabaseClient,
  loadHyberveesEnv,
  parseArgs,
  printJson,
  repoRelativePath,
  requireExistingRepoFile,
} from "./common.mjs";

const usage = () => {
  console.log(`Usage:
  node scripts/hybervees/mark-reviewed.mjs --external-run-id <id> --summary <text> --artifact-path <path> [--dry-run] [--env-file <path>]
  node scripts/hybervees/mark-reviewed.mjs --id <uuid> --summary <text> --artifact-path <path> [--dry-run] [--env-file <path>]

Required:
  --id <uuid>              tester_report_runs.id to mark reviewed.
  --external-run-id <id>   Alternative lookup by external_run_id.
  --summary <text>         Short Hybervees insight summary.
  --artifact-path <path>   Retained Hybervees insight report path.

Options:
  --dry-run          Validate inputs and print the update packet without mutating production.
  --env-file <path>  Load a specific env file. Repeatable. Defaults to canonical local env paths.
  --help             Show this message.
`);
};

function requiredValue(args, key) {
  const value = (args.values.get(key) || "").trim();
  if (!value) {
    throw new Error(`Missing ${key}`);
  }
  return value;
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  if (args.flags.has("--help")) {
    usage();
    return;
  }

  loadHyberveesEnv(argv);

  const id = (args.values.get("--id") || "").trim();
  const externalRunId = (args.values.get("--external-run-id") || "").trim();
  if (!id && !externalRunId) {
    throw new Error("Provide --id or --external-run-id");
  }
  if (id && externalRunId) {
    throw new Error("Provide only one of --id or --external-run-id");
  }

  const summary = requiredValue(args, "--summary");
  if (summary.length < 25) {
    throw new Error("--summary is too short to be useful");
  }

  const artifactPath = repoRelativePath(requiredValue(args, "--artifact-path"));
  requireExistingRepoFile(artifactPath, "--artifact-path");

  const update = {
    hybervees_review_status: "reviewed",
    hybervees_reviewed_at: new Date().toISOString(),
    hybervees_reviewed_by: "Hybervees",
    hybervees_insight_summary: summary,
    hybervees_insight_artifact_path: artifactPath,
  };

  const match = id ? { id } : { external_run_id: externalRunId };
  const packet = { match, update };
  if (args.flags.has("--dry-run")) {
    printJson({
      dryRun: true,
      wouldUpdate: packet,
      allowedFields: Object.keys(update),
    });
    return;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tester_report_runs")
    .update(update)
    .match(match)
    .select(
      [
        "id",
        "external_run_id",
        "hybervees_review_status",
        "hybervees_reviewed_at",
        "hybervees_reviewed_by",
        "hybervees_insight_artifact_path",
      ].join(","),
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  printJson(data);
}

main().catch((error) => fail(error.message));
