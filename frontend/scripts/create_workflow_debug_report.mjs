/* global console, process */

const USAGE = `Usage:
  node frontend/scripts/create_workflow_debug_report.mjs <snapshot.json>

The input JSON should match window.__shortpulseCreateWorkflowDebug.getSnapshot().`;

export const readSnapshotFromText = (text) => {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Snapshot must be a JSON object.");
  }
  return {
    enabled: parsed.enabled === true,
    attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
    events: Array.isArray(parsed.events) ? parsed.events : [],
  };
};

const formatValue = (value) => {
  if (value === null || value === undefined || value === "") return "null";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "[]";
  return String(value);
};

export const buildCreateWorkflowDebugReport = (snapshot) => {
  const eventCounts = new Map();
  snapshot.events.forEach((event) => {
    eventCounts.set(event.type, (eventCounts.get(event.type) ?? 0) + 1);
  });

  const lines = [
    "# Create Workflow Debug Report",
    "",
    `- Enabled: ${snapshot.enabled ? "yes" : "no"}`,
    `- Attachment count: ${snapshot.attachments.length}`,
    `- Event count: ${snapshot.events.length}`,
    "",
    "## Event Counts",
  ];

  if (eventCounts.size === 0) {
    lines.push("- none");
  } else {
    Array.from(eventCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([type, count]) => {
        lines.push(`- ${type}: ${count}`);
      });
  }

  lines.push("", "## Attachments");

  if (snapshot.attachments.length === 0) {
    lines.push("- none");
  } else {
    snapshot.attachments.forEach((attachment, index) => {
      lines.push(`### Attachment ${index + 1}: ${attachment.id ?? "unknown"}`);
      lines.push(`- kind: ${formatValue(attachment.kind)}`);
      lines.push(`- referenceId: ${formatValue(attachment.referenceId)}`);
      lines.push(`- mediaId: ${formatValue(attachment.mediaId)}`);
      lines.push(`- imageUrl: ${formatValue(attachment.imageUrl)}`);
      lines.push(`- submissionImageUrl: ${formatValue(attachment.submissionImageUrl)}`);
      lines.push(`- previewStoragePath: ${formatValue(attachment.previewStoragePath)}`);
      lines.push(`- fullStoragePath: ${formatValue(attachment.fullStoragePath)}`);
      lines.push(`- referenceUrl: ${formatValue(attachment.referenceUrl)}`);
      lines.push(`- referenceRenderUrl: ${formatValue(attachment.referenceRenderUrl)}`);
      lines.push(`- imageFallbackUrls: ${formatValue(attachment.imageFallbackUrls)}`);
      lines.push(`- deliveryStatus: ${formatValue(attachment.deliveryStatus)}`);
      lines.push(`- deliveryError: ${formatValue(attachment.deliveryError)}`);
      lines.push("");
    });
  }

  lines.push("## Recent Events");
  if (snapshot.events.length === 0) {
    lines.push("- none");
  } else {
    snapshot.events.slice(-20).forEach((event) => {
      lines.push(
        `- ${event.at ?? "unknown-time"} :: ${event.type} :: ${JSON.stringify(event.payload ?? {})}`
      );
    });
  }

  return `${lines.join("\n")}\n`;
};

const maybeRunCli = async () => {
  if (import.meta.url !== `file://${process.argv[1]}`) {
    return;
  }

  const [, , inputPath] = process.argv;
  if (!inputPath) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const fs = await import("node:fs/promises");
  const raw = await fs.readFile(inputPath, "utf8");
  const snapshot = readSnapshotFromText(raw);
  process.stdout.write(buildCreateWorkflowDebugReport(snapshot));
};

await maybeRunCli();
