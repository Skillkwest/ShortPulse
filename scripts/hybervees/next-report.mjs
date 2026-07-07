#!/usr/bin/env node

/**
 * Prints a safe intake packet for the earliest unreviewed Admin Tester Report.
 */

import {
  fail,
  formatReportPacket,
  getSupabaseClient,
  loadHyberveesEnv,
  parseArgs,
  printJson,
} from "./common.mjs";

const usage = () => {
  console.log(`Usage:
  node scripts/hybervees/next-report.mjs [--limit 1] [--json] [--env-file <path>]

Options:
  --limit <number>  Number of unreviewed reports to print. Default: 1.
  --json            Print JSON packets instead of a compact text view.
  --env-file <path> Load a specific env file. Repeatable. Defaults to canonical local env paths.
  --help            Show this message.
`);
};

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  if (args.flags.has("--help")) {
    usage();
    return;
  }

  loadHyberveesEnv(argv);

  const limitValue = Number.parseInt(args.values.get("--limit") || "1", 10);
  const limit =
    Number.isFinite(limitValue) && limitValue > 0
      ? Math.min(limitValue, 25)
      : 1;
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("tester_report_runs")
    .select(
      [
        "id",
        "external_run_id",
        "tester_slug",
        "tester_display_name",
        "scenario",
        "status",
        "created_at",
        "production_surface",
        "persona_report_title",
        "engineering_report_title",
        "report_artifact_paths",
        "evidence",
        "hybervees_review_status",
        "hybervees_reviewed_at",
      ].join(","),
    )
    .or("hybervees_review_status.is.null,hybervees_review_status.neq.reviewed")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const packets = (data || []).map(formatReportPacket);
  if (args.flags.has("--json")) {
    printJson(packets);
    return;
  }

  if (packets.length === 0) {
    console.log("No unreviewed Admin Tester Reports found.");
    return;
  }

  for (const [index, packet] of packets.entries()) {
    if (index > 0) console.log("");
    console.log(`External run: ${packet.externalRunId}`);
    console.log(`Row id: ${packet.id}`);
    console.log(`Tester: ${packet.tester.displayName} (${packet.tester.slug})`);
    console.log(`Created: ${packet.createdAt}`);
    console.log(`Scenario: ${packet.scenario}`);
    console.log(`Surface: ${packet.productionSurface || "n/a"}`);
    console.log(`Review: ${packet.hyberveesReview.status}`);
    console.log("Artifacts:");
    for (const artifactPath of packet.reportArtifactPaths) {
      console.log(`- ${artifactPath}`);
    }
    if (packet.evidenceKeys.length > 0) {
      console.log(`Evidence keys: ${packet.evidenceKeys.join(", ")}`);
    }
  }
}

main().catch((error) => fail(error.message));
