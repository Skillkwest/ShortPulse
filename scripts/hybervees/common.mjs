#!/usr/bin/env node

/**
 * Shared helpers for Hybervees tester-report tooling.
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "../lib/load_local_env.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const repoRoot = path.resolve(__dirname, "..", "..");

const require = createRequire(import.meta.url);

export const DEFAULT_ENV_PATHS = [
  "frontend/.vercel/.env.production.local",
  "frontend/.env.local",
  ".env.local",
];

export function loadHyberveesEnv(argv = []) {
  return loadLocalEnv({
    argv,
    defaultPaths: DEFAULT_ENV_PATHS,
  });
}

export function getSupabaseClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Load the canonical local env file; secret values are never printed.",
    );
  }

  const supabaseModulePath = path.join(
    repoRoot,
    "frontend",
    "node_modules",
    "@supabase",
    "supabase-js",
  );
  const { createClient } = require(supabaseModulePath);
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export function parseArgs(argv) {
  const parsed = {
    flags: new Set(),
    values: new Map(),
    repeated: new Map(),
    positionals: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      parsed.positionals.push(arg);
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed.flags.add(arg);
      continue;
    }

    parsed.values.set(arg, next);
    if (!parsed.repeated.has(arg)) {
      parsed.repeated.set(arg, []);
    }
    parsed.repeated.get(arg).push(next);
    index += 1;
  }

  return parsed;
}

export function repoRelativePath(filePath) {
  return path
    .relative(repoRoot, path.resolve(repoRoot, filePath))
    .replaceAll(path.sep, "/");
}

export function resolveRepoPath(filePath) {
  return path.resolve(repoRoot, filePath);
}

export function requireExistingRepoFile(filePath, label) {
  const resolved = resolveRepoPath(filePath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`${label} does not exist: ${repoRelativePath(filePath)}`);
  }
  return resolved;
}

export function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

export function fail(message) {
  console.error(`[hybervees] ${message}`);
  process.exit(1);
}

export function formatReportPacket(row) {
  const evidenceKeys =
    row.evidence &&
    typeof row.evidence === "object" &&
    !Array.isArray(row.evidence)
      ? Object.keys(row.evidence).sort()
      : [];

  return {
    id: row.id,
    externalRunId: row.external_run_id,
    tester: {
      slug: row.tester_slug,
      displayName: row.tester_display_name,
    },
    scenario: row.scenario,
    status: row.status,
    createdAt: row.created_at,
    productionSurface: row.production_surface,
    reportTitles: {
      persona: row.persona_report_title,
      engineering: row.engineering_report_title,
    },
    reportArtifactPaths: row.report_artifact_paths || [],
    evidenceKeys,
    hyberveesReview: {
      status: row.hybervees_review_status || "unreviewed",
      reviewedAt: row.hybervees_reviewed_at || null,
    },
  };
}
