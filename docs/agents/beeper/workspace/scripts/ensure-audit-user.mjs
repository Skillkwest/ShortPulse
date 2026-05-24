#!/usr/bin/env node

/**
 * Keeps Beeper's dedicated audit account aligned with the active frontend runtime project.
 * Default mode is read-only status output; pass --apply to create or update the user.
 */

import process from "node:process";
import {
  ensureDirectory,
  ensureBeeperAuditUser,
  resolveBeeperRuntimeConfig,
} from "./lib/beeperAuditRuntime.mjs";

const usage = () => {
  console.log(`Usage:
  node docs/agents/beeper/workspace/scripts/ensure-audit-user.mjs [options]

Options:
  --apply                  Create/update the dedicated Beeper audit user in the active runtime project.
  --environment <name>     Target environment: local, development, staging, or production. Default: local.
  --base-url <url>         Optional app base URL override (defaults to localhost runtime posture).
  --help                   Show this message.

Reads:
  - audit credentials from .env.agent.local
  - runtime Supabase config from frontend/.env.local
`);
};

const main = async () => {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    usage();
    return;
  }

  const apply = argv.includes("--apply");
  const config = resolveBeeperRuntimeConfig({ argv });
  ensureDirectory(`${config.repoRoot}/beeper`);

  const result = await ensureBeeperAuditUser(config, { apply });
  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "check",
        environment: config.environment,
        baseUrl: config.baseUrl,
        runtimeProjectRef: config.runtimeProjectRef,
        auditEmail: config.auditEmail,
        ...result,
      },
      null,
      2,
    ),
  );
};

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
