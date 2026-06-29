#!/usr/bin/env node
/* global process, console */

const args = process.argv.slice(2);
const json = args.includes("--json");
const auditFilterIndex = args.findIndex((arg) => arg === "--audit");
const auditFilter =
  auditFilterIndex >= 0 ? (args[auditFilterIndex + 1]?.trim().toLowerCase() ?? "") : "";

const envValue = (key, fallback = "") => process.env[key]?.trim() || fallback;

const maskEmail = (email) => {
  if (!email) return null;
  const [localPart = "", domain = ""] = email.split("@");
  const maskedLocal =
    localPart.length <= 2 ? `${localPart.slice(0, 1)}*` : `${localPart.slice(0, 2)}***`;
  return domain ? `${maskedLocal}@${domain}` : maskedLocal;
};

const auditEmail = envValue("PLAYWRIGHT_AUDIT_EMAIL");
const credentialStatus = auditEmail
  ? /@example\.com$/i.test(auditEmail)
    ? "invalid-example-address"
    : "present"
  : "missing";

const localPulseCustomPort = envValue("PULSE_CUSTOM_CONTRACT_PORT", "3101");
const localPulseBuiltinPort = envValue("PULSE_BUILTIN_CONTRACT_PORT", "3102");
const localPerfPort = envValue("AI_STUDIO_PERF_PORT", "3100");

const audits = [
  {
    id: "pulse-custom-contract",
    command: "npm run test:e2e:pulse-custom-contract",
    targetUrl: envValue("PLAYWRIGHT_BASE_URL", "http://localhost:3000"),
    credentials: ["PLAYWRIGHT_AUDIT_EMAIL", "PLAYWRIGHT_AUDIT_PASSWORD"],
    mutates: "Creates a custom Pulse through the real UI, then deletes it in best-effort cleanup.",
    cleanup:
      "Audit-owned custom Pulse cleanup runs before exit when creation succeeded; inspect stdout JSON if cleanup is uncertain.",
    artifact:
      "Retain the final stdout JSON and command line in the Copperknot or AI Studio browser-proof artifact area.",
  },
  {
    id: "pulse-builtin-contract",
    command: "npm run test:e2e:pulse-builtin-contract",
    targetUrl: envValue("PLAYWRIGHT_BASE_URL", "http://localhost:3000"),
    credentials: ["PLAYWRIGHT_AUDIT_EMAIL", "PLAYWRIGHT_AUDIT_PASSWORD"],
    mutates:
      "No durable custom Pulse is created; the audit signs in, reads the built-in catalog, activates a built-in, and intercepts the Pulse request.",
    cleanup: "No durable audit record cleanup is expected.",
    artifact:
      "Retain the final stdout JSON and command line in the Copperknot or AI Studio browser-proof artifact area.",
  },
  {
    id: "pulse-custom-contract-release-check",
    command: "npm run test:pulse-custom-contract:release-check",
    targetUrl: envValue(
      "PULSE_CUSTOM_CONTRACT_BASE_URL",
      `http://localhost:${localPulseCustomPort}`
    ),
    credentials: ["PLAYWRIGHT_AUDIT_EMAIL", "PLAYWRIGHT_AUDIT_PASSWORD"],
    mutates:
      "Builds/starts a temporary local production server by default, then runs the custom Pulse audit that creates and cleans up an audit-owned Pulse.",
    cleanup:
      "Wrapper tears down the local server; audit-owned custom Pulse cleanup is best-effort and must be checked in stdout JSON.",
    artifact:
      "Retain build/start output plus final audit JSON. This proves local production-bundle behavior, not deployed production behavior.",
  },
  {
    id: "pulse-builtin-contract-release-check",
    command: "npm run test:pulse-builtin-contract:release-check",
    targetUrl: envValue(
      "PULSE_BUILTIN_CONTRACT_BASE_URL",
      `http://localhost:${localPulseBuiltinPort}`
    ),
    credentials: ["PLAYWRIGHT_AUDIT_EMAIL", "PLAYWRIGHT_AUDIT_PASSWORD"],
    mutates:
      "Builds/starts a temporary local production server by default, then runs the built-in Pulse browser contract audit.",
    cleanup: "Wrapper tears down the local server; no durable built-in Pulse cleanup is expected.",
    artifact:
      "Retain build/start output plus final audit JSON. This proves local production-bundle behavior, not deployed production behavior.",
  },
  {
    id: "ai-studio-perf-release-check",
    command: "npm run perf:ai-studio:release-check",
    targetUrl: envValue("PLAYWRIGHT_BASE_URL", `http://localhost:${localPerfPort}`),
    credentials: ["PLAYWRIGHT_AUDIT_EMAIL", "PLAYWRIGHT_AUDIT_PASSWORD"],
    mutates:
      "Builds/starts a temporary local production server with perf audit runtime enabled; uses a signed-in browser session and runtime-only seeded audit state.",
    cleanup: "Wrapper tears down the local server; no durable account-record cleanup is expected.",
    artifact:
      "Retain build/start output plus final perf JSON. This proves local production-bundle behavior, not deployed production behavior.",
  },
  {
    id: "style-drop",
    command: "npm run test:e2e:style-drop",
    targetUrl: envValue("PLAYWRIGHT_BASE_URL", "http://localhost:3100"),
    credentials: ["PLAYWRIGHT_AUDIT_EMAIL", "PLAYWRIGHT_AUDIT_PASSWORD"],
    mutates:
      "Seeds runtime Reference Grid items through audit helpers and intercepts style extraction/copy requests; no durable account record should be created by the harness.",
    cleanup:
      "No durable cleanup is expected; retain request/response summaries to prove interception worked.",
    artifact:
      "Retain the final stdout JSON with passing and failing Reference Grid to Styles packet summaries.",
  },
  {
    id: "audio-exclusivity",
    command: "npm run test:e2e:audio-exclusivity",
    targetUrl: envValue("PLAYWRIGHT_AUDIO_EXCLUSIVITY_BASE_URL", "http://localhost:3000"),
    credentials: ["PLAYWRIGHT_AUDIT_EMAIL", "PLAYWRIGHT_AUDIT_PASSWORD"],
    mutates:
      "Creates Media Library audio fixtures in the audit account and verifies playback exclusivity across Media, Reference Grid, preview modal, and detail modal surfaces.",
    cleanup:
      "Deletes audit-owned audio fixtures before exit; final result is only trustworthy when cleanup.succeeded is true.",
    artifact:
      "Retain the final stdout JSON, especially cleanup status, skipped lanes, severe signals, and playback result summaries.",
  },
  {
    id: "ai-studio-loading-gate",
    command: "npm run test:e2e:ai-studio-loading-gate",
    targetUrl: envValue(
      "PLAYWRIGHT_AI_STUDIO_ENTRY_BASE_URL",
      envValue("PLAYWRIGHT_BASE_URL", "https://shortpulse.ai")
    ),
    credentials: ["PLAYWRIGHT_AUDIT_EMAIL", "PLAYWRIGHT_AUDIT_PASSWORD"],
    mutates:
      "Signs in and delays the media-compliance request to verify the loading gate; no durable account record should be created.",
    cleanup: "No durable cleanup is expected.",
    artifact:
      "Retain the final stdout JSON with loading gate state, target URL, and severe signal summary.",
  },
];

const selectedAudits = auditFilter
  ? audits.filter((audit) => audit.id.toLowerCase().includes(auditFilter))
  : audits;

if (auditFilter && selectedAudits.length === 0) {
  console.error(`[browser-audit-preflight] No audit matched --audit ${auditFilter}`);
  process.exit(1);
}

const payload = {
  generatedAt: new Date().toISOString(),
  credentials: {
    status: credentialStatus,
    auditEmail: maskEmail(auditEmail),
    password: envValue("PLAYWRIGHT_AUDIT_PASSWORD") ? "present" : "default-or-missing",
  },
  launchPolicy: {
    productionBrowserProofUrl: "https://www.shortpulse.ai",
    note: "Local release checks prove a local production bundle. Use the production URL for deployed behavior claims unless explicitly approved otherwise.",
  },
  audits: selectedAudits,
};

if (json) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log("[browser-audit-preflight] AI Studio browser audit proof boundary");
  console.log(
    `credentials=${payload.credentials.status} auditEmail=${payload.credentials.auditEmail ?? "none"}`
  );
  console.log(`productionBrowserProofUrl=${payload.launchPolicy.productionBrowserProofUrl}`);
  console.log(payload.launchPolicy.note);
  for (const audit of selectedAudits) {
    console.log("");
    console.log(`- ${audit.id}`);
    console.log(`  command: ${audit.command}`);
    console.log(`  target: ${audit.targetUrl}`);
    console.log(`  credentials: ${audit.credentials.join(", ")}`);
    console.log(`  mutates: ${audit.mutates}`);
    console.log(`  cleanup: ${audit.cleanup}`);
    console.log(`  artifact: ${audit.artifact}`);
  }
}
