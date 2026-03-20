#!/usr/bin/env node
/**
 * Phase 3 staging rollback-drill runner.
 *
 * Default mode is preflight-only (no mutation). Use --execute-rollback to
 * invoke the control-plane rollback RPC and capture post-state.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createClient } = require("../frontend/node_modules/@supabase/supabase-js");

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FRONTEND_ROOT = path.join(REPO_ROOT, "frontend");

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
};

const parseArgs = (argv) => {
  const parsed = {
    executeRollback: false,
    reason: "phase3_staging_rollback_drill",
    source: "manual",
    cooldownHours: 1,
    out: "",
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1] ?? "";
    if (token === "--help" || token === "-h") return { ...parsed, help: true };
    if (token === "--execute-rollback") {
      parsed.executeRollback = true;
      continue;
    }
    if (token === "--reason") {
      parsed.reason = next || parsed.reason;
      i += 1;
      continue;
    }
    if (token === "--source") {
      parsed.source = next || parsed.source;
      i += 1;
      continue;
    }
    if (token === "--cooldown-hours") {
      const parsedHours = Number(next);
      if (Number.isFinite(parsedHours)) parsed.cooldownHours = Math.max(1, Math.min(168, Math.floor(parsedHours)));
      i += 1;
      continue;
    }
    if (token === "--out") {
      parsed.out = next;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return parsed;
};

const usage = () => {
  process.stdout.write(
    [
      "Usage:",
      "  node scripts/run_phase3_staging_rollback_drill.mjs [options]",
      "",
      "Options:",
      "  --execute-rollback       Execute rollback_agent_safety_policy RPC (default: preflight only)",
      "  --reason <text>          Reason string for rollback event",
      "  --source <text>          Source string for rollback event",
      "  --cooldown-hours <1-168> Cooldown hours when executing rollback (default: 1)",
      "  --out <json-file>        Write output JSON to file",
      "",
    ].join("\n")
  );
};

const getRequiredEnv = (key) => {
  const value = process.env[key];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return String(value).trim();
};

const main = async () => {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  loadEnvFile(path.join(REPO_ROOT, ".env.agent.local"));
  loadEnvFile(path.join(FRONTEND_ROOT, ".env.local"));

  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const capturedAt = new Date().toISOString();

  const activeBefore = await client.rpc("get_active_agent_safety_policy");
  if (activeBefore.error) throw activeBefore.error;

  let rollbackResult = null;
  let activeAfter = null;

  if (args.executeRollback) {
    const rollback = await client.rpc("rollback_agent_safety_policy", {
      p_reason: args.reason,
      p_actor_user_id: null,
      p_actor_email: null,
      p_source: args.source,
      p_cooldown_hours: args.cooldownHours,
    });
    if (rollback.error) throw rollback.error;
    rollbackResult = rollback.data;

    const after = await client.rpc("get_active_agent_safety_policy");
    if (after.error) throw after.error;
    activeAfter = after.data;
  }

  const output = {
    capturedAt,
    mode: args.executeRollback ? "execute_rollback" : "preflight_only",
    reason: args.reason,
    source: args.source,
    cooldownHours: args.cooldownHours,
    activePolicyBefore: activeBefore.data,
    rollbackResult,
    activePolicyAfter: activeAfter,
  };

  const encoded = JSON.stringify(output, null, 2);
  if (args.out) {
    const outputPath = path.resolve(process.cwd(), args.out);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, encoded, "utf8");
    process.stdout.write(`[phase3-rollback-drill] wrote ${outputPath}\n`);
    return;
  }
  process.stdout.write(`${encoded}\n`);
};

main().catch((error) => {
  process.stderr.write(
    `[phase3-rollback-drill] error: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
});

