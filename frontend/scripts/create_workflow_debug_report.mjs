/* global console, process, URL */

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

export const summarizeCreateWorkflowDebugUrl = (value) => {
  if (typeof value !== "string" || value.length === 0) {
    return { kind: "empty", host: null, path: null, length: 0 };
  }
  if (value.startsWith("blob:")) {
    return { kind: "blob", host: null, path: null, length: value.length };
  }
  if (value.startsWith("data:")) {
    const mediaTypeEnd = value.indexOf(";") > 0 ? value.indexOf(";") : 32;
    return {
      kind: "data",
      host: null,
      path: value.slice(5, mediaTypeEnd) || null,
      length: value.length,
    };
  }
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return {
        kind: url.protocol === "https:" ? "https" : "http",
        host: url.host,
        path: url.pathname,
        length: value.length,
      };
    }
  } catch {
    return { kind: "other", host: null, path: null, length: value.length };
  }
  return { kind: "other", host: null, path: null, length: value.length };
};

export const buildCreateWorkflowDebugDiagnosis = (snapshot) => {
  const eventCounts = snapshot.events.reduce((counts, event) => {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
    return counts;
  }, {});
  const imageAttachments = snapshot.attachments.filter((attachment) => attachment.kind === "image");
  const blockers = [];
  if (!snapshot.enabled) blockers.push("debug_disabled");
  if (!imageAttachments.length) blockers.push("no_image_attachment");
  if (imageAttachments.some((attachment) => attachment.deliveryStatus === "failed")) {
    blockers.push("delivery_failed");
  }
  if (
    imageAttachments.some((attachment) => {
      const status = attachment.deliveryStatus ?? "pending";
      return status === "pending" || status === "preparing";
    })
  ) {
    blockers.push("delivery_not_ready");
  }
  if (
    imageAttachments.some((attachment) => {
      const status = attachment.deliveryStatus ?? "pending";
      return (
        status === "ready" &&
        summarizeCreateWorkflowDebugUrl(attachment.submissionImageUrl).kind !== "https"
      );
    })
  ) {
    blockers.push("missing_durable_submission_url");
  }
  if ((eventCounts.attachment_prepare_failed ?? 0) > 0) {
    blockers.push("send_preparation_failed");
  }
  const sendAttemptObserved =
    (eventCounts.attachment_send_prepare_started ?? 0) > 0 ||
    (eventCounts.attachment_prepare_failed ?? 0) > 0 ||
    (eventCounts.agent_send_payload_ready ?? 0) > 0;
  if (
    sendAttemptObserved &&
    (eventCounts.agent_send_payload_ready ?? 0) === 0 &&
    imageAttachments.length > 0
  ) {
    blockers.push("send_payload_not_observed");
  }
  if ((eventCounts.preview_img_error ?? 0) > 0) {
    blockers.push("preview_render_failed");
  }
  const latestPreviewEvent = [...snapshot.events]
    .reverse()
    .find((event) => event.type === "preview_resolved_source_changed");
  if (latestPreviewEvent?.payload?.resolvedSrc === null) {
    blockers.push("preview_source_missing");
  }

  let likelyFailureClass = "ready_for_model_send";
  if (!snapshot.enabled) likelyFailureClass = "debug_disabled";
  else if (!imageAttachments.length) likelyFailureClass = "no_image_attachment";
  else if (blockers.includes("delivery_failed")) likelyFailureClass = "delivery_failed";
  else if (blockers.includes("delivery_not_ready")) likelyFailureClass = "delivery_not_ready";
  else if (blockers.includes("missing_durable_submission_url")) {
    likelyFailureClass = "missing_durable_submission_url";
  } else if (blockers.includes("send_preparation_failed")) {
    likelyFailureClass = "send_preparation_failed";
  } else if (blockers.includes("send_payload_not_observed")) {
    likelyFailureClass = "send_payload_missing_image";
  } else if (blockers.includes("preview_render_failed")) {
    likelyFailureClass = "preview_render_failed";
  } else if (blockers.includes("preview_source_missing")) {
    likelyFailureClass = "preview_source_missing";
  }

  return {
    generatedAt: new Date().toISOString(),
    enabled: snapshot.enabled,
    attachmentCount: snapshot.attachments.length,
    imageAttachmentCount: imageAttachments.length,
    eventCounts,
    attachments: snapshot.attachments.map((attachment) => ({
      id: attachment.id,
      kind: attachment.kind,
      deliveryStatus: attachment.deliveryStatus ?? null,
      deliveryError: attachment.deliveryError ?? null,
      imageUrl: summarizeCreateWorkflowDebugUrl(attachment.imageUrl),
      submissionImageUrl: summarizeCreateWorkflowDebugUrl(attachment.submissionImageUrl),
      previewStoragePath: attachment.previewStoragePath ?? null,
      fullStoragePath: attachment.fullStoragePath ?? null,
    })),
    blockers,
    likelyFailureClass,
  };
};

const formatValue = (value) => {
  if (value === null || value === undefined || value === "") return "null";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "[]";
  return String(value);
};

const formatUrlSummary = (summary) => {
  const location = [summary.host, summary.path].filter(Boolean).join("");
  return `${summary.kind}${location ? `:${location}` : ""} (${summary.length} chars)`;
};

export const buildCreateWorkflowDebugReport = (snapshot) => {
  const diagnosis = buildCreateWorkflowDebugDiagnosis(snapshot);
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
    `- Likely failure class: ${diagnosis.likelyFailureClass}`,
    `- Blockers: ${diagnosis.blockers.length ? diagnosis.blockers.join(", ") : "none"}`,
    "",
    "## Diagnosis",
    "",
    `- Image attachment count: ${diagnosis.imageAttachmentCount}`,
    `- Send payload observed: ${
      (diagnosis.eventCounts.agent_send_payload_ready ?? 0) > 0 ? "yes" : "no"
    }`,
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
      lines.push(
        `- imageUrl: ${formatUrlSummary(summarizeCreateWorkflowDebugUrl(attachment.imageUrl))}`
      );
      lines.push(
        `- submissionImageUrl: ${formatUrlSummary(
          summarizeCreateWorkflowDebugUrl(attachment.submissionImageUrl)
        )}`
      );
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
