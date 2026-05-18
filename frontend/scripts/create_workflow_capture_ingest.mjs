/* global console, process */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCreateWorkflowDebugDiagnosis,
  buildCreateWorkflowDebugReport,
  readSnapshotFromText,
  summarizeCreateWorkflowDebugUrl,
} from "./create_workflow_debug_report.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_CAPTURE_OUTPUT_DIR = path.resolve(
  __dirname,
  "../../docs/records/artifacts/agent/create-workflow/workspace/captures"
);

const timestampSlug = () => new Date().toISOString().replace(/[:]/g, "-").replace(/\..+$/, "Z");

export const analyzeCreateWorkflowSnapshot = (snapshot, incidentId = "unknown-incident") => {
  const diagnosis = buildCreateWorkflowDebugDiagnosis(snapshot);
  const eventCounts = Object.create(null);
  const previewEvents = [];

  snapshot.events.forEach((event) => {
    eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
    if (event.type === "preview_resolved_source_changed") {
      previewEvents.push(event);
    }
  });

  const firstResolvedPreviewSource =
    previewEvents.find((event) => typeof event.payload?.resolvedSrc === "string")?.payload
      ?.resolvedSrc ?? null;
  const lastResolvedPreviewSource =
    [...previewEvents].reverse().find((event) => typeof event.payload?.resolvedSrc === "string")
      ?.payload?.resolvedSrc ?? null;

  const previewResolvedToNullCount = previewEvents.filter(
    (event) => event.payload?.resolvedSrc === null
  ).length;

  return {
    incidentId,
    generatedAt: new Date().toISOString(),
    attachmentCount: snapshot.attachments.length,
    attachmentIds: snapshot.attachments.map((attachment) => attachment.id),
    imageUrlPresentAtEnd: snapshot.attachments.some(
      (attachment) => typeof attachment.imageUrl === "string" && attachment.imageUrl.length > 0
    ),
    submissionImageUrlPresentAtEnd: snapshot.attachments.some(
      (attachment) =>
        typeof attachment.submissionImageUrl === "string" &&
        attachment.submissionImageUrl.length > 0
    ),
    durableSubmissionImageUrlPresentAtEnd: snapshot.attachments.some(
      (attachment) =>
        summarizeCreateWorkflowDebugUrl(attachment.submissionImageUrl).kind === "https"
    ),
    readyImageAttachmentCount: snapshot.attachments.filter(
      (attachment) => attachment.kind === "image" && attachment.deliveryStatus === "ready"
    ).length,
    failedImageAttachmentCount: snapshot.attachments.filter(
      (attachment) => attachment.kind === "image" && attachment.deliveryStatus === "failed"
    ).length,
    preparingImageAttachmentCount: snapshot.attachments.filter(
      (attachment) =>
        attachment.kind === "image" &&
        ((attachment.deliveryStatus ?? "pending") === "preparing" ||
          (attachment.deliveryStatus ?? "pending") === "pending")
    ).length,
    sendPayloadReadyCount: eventCounts.agent_send_payload_ready ?? 0,
    diagnosis,
    previewErrorCount: eventCounts.preview_img_error ?? 0,
    previewRepairAttemptCount: eventCounts.preview_repair_attempted ?? 0,
    previewRepairResolvedCount: eventCounts.preview_repair_resolved ?? 0,
    attachmentReplaceCount: eventCounts.attachment_replaced ?? 0,
    attachmentRemoveCount: eventCounts.attachment_removed ?? 0,
    attachmentResetCount: eventCounts.attachments_reset ?? 0,
    attachmentClearCount: eventCounts.attachments_cleared ?? 0,
    firstResolvedPreviewSource,
    lastResolvedPreviewSource,
    previewResolvedToNullCount,
    eventCounts,
    likelySignals: [
      ...(previewResolvedToNullCount > 0 ? ["preview_resolved_to_null"] : []),
      ...((eventCounts.attachment_replaced ?? 0) > 0 ? ["attachment_replaced"] : []),
      ...((eventCounts.preview_img_error ?? 0) > 0 ? ["preview_img_error"] : []),
      ...((eventCounts.attachments_reset ?? 0) > 0 ? ["attachments_reset"] : []),
      ...(diagnosis.blockers ?? []),
    ],
  };
};

export const buildCreateWorkflowCaptureReport = (analysis, snapshot) => {
  const lines = [
    `# Create Workflow Capture Analysis`,
    "",
    `- Incident: ${analysis.incidentId}`,
    `- Generated at: ${analysis.generatedAt}`,
    `- Attachment count: ${analysis.attachmentCount}`,
    `- Attachment ids: ${analysis.attachmentIds.length ? analysis.attachmentIds.join(", ") : "none"}`,
    `- imageUrl present at end: ${analysis.imageUrlPresentAtEnd ? "yes" : "no"}`,
    `- submissionImageUrl present at end: ${analysis.submissionImageUrlPresentAtEnd ? "yes" : "no"}`,
    `- durable submissionImageUrl present at end: ${
      analysis.durableSubmissionImageUrlPresentAtEnd ? "yes" : "no"
    }`,
    `- Ready image attachments: ${analysis.readyImageAttachmentCount}`,
    `- Preparing/pending image attachments: ${analysis.preparingImageAttachmentCount}`,
    `- Failed image attachments: ${analysis.failedImageAttachmentCount}`,
    `- Send payload ready events: ${analysis.sendPayloadReadyCount}`,
    `- Likely failure class: ${analysis.diagnosis.likelyFailureClass}`,
    `- Diagnosis blockers: ${
      analysis.diagnosis.blockers.length ? analysis.diagnosis.blockers.join(", ") : "none"
    }`,
    `- Preview error count: ${analysis.previewErrorCount}`,
    `- Preview repair attempt count: ${analysis.previewRepairAttemptCount}`,
    `- Preview repair resolved count: ${analysis.previewRepairResolvedCount}`,
    `- Attachment replace count: ${analysis.attachmentReplaceCount}`,
    `- Attachment remove count: ${analysis.attachmentRemoveCount}`,
    `- Attachment reset count: ${analysis.attachmentResetCount}`,
    `- Attachment clear count: ${analysis.attachmentClearCount}`,
    `- First resolved preview source: ${analysis.firstResolvedPreviewSource ?? "null"}`,
    `- Last resolved preview source: ${analysis.lastResolvedPreviewSource ?? "null"}`,
    `- Preview resolved-to-null count: ${analysis.previewResolvedToNullCount}`,
    `- Likely signals: ${analysis.likelySignals.length ? analysis.likelySignals.join(", ") : "none"}`,
    "",
    "## Embedded Debug Report",
    "",
    buildCreateWorkflowDebugReport(snapshot).trimEnd(),
    "",
  ];

  return `${lines.join("\n")}\n`;
};

export const parseArgs = (argv) => {
  const inputPath = argv.find((arg) => !arg.startsWith("--")) ?? null;
  const getValue = (flag) => {
    const index = argv.indexOf(flag);
    return index >= 0 && index < argv.length - 1 ? argv[index + 1] : null;
  };

  return {
    inputPath,
    incidentId: getValue("--incident-id") ?? "unknown-incident",
    outputDir: getValue("--output-dir") ?? DEFAULT_CAPTURE_OUTPUT_DIR,
    label: getValue("--label") ?? "capture",
  };
};

const maybeRunCli = async () => {
  if (import.meta.url !== `file://${process.argv[1]}`) {
    return;
  }

  const args = parseArgs(process.argv.slice(2));
  if (!args.inputPath) {
    console.error(
      "Usage: node frontend/scripts/create_workflow_capture_ingest.mjs <snapshot.json> [--incident-id <id>] [--output-dir <dir>] [--label <label>]"
    );
    process.exitCode = 1;
    return;
  }

  const raw = await fs.readFile(args.inputPath, "utf8");
  const snapshot = readSnapshotFromText(raw);
  const analysis = analyzeCreateWorkflowSnapshot(snapshot, args.incidentId);
  const report = buildCreateWorkflowCaptureReport(analysis, snapshot);

  await fs.mkdir(args.outputDir, { recursive: true });
  const prefix = `${timestampSlug()}-${args.label}`;
  const analysisPath = path.join(args.outputDir, `${prefix}.analysis.json`);
  const reportPath = path.join(args.outputDir, `${prefix}.report.md`);

  await fs.writeFile(analysisPath, `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
  await fs.writeFile(reportPath, report, "utf8");

  process.stdout.write(
    `${JSON.stringify(
      {
        analysisPath,
        reportPath,
      },
      null,
      2
    )}\n`
  );
};

await maybeRunCli();
