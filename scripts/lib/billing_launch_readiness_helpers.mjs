/**
 * Shared constants and small utilities for the billing launch-readiness audit.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const execFileAsync = promisify(execFile);

export const REQUIRED_PLAN_IDS = ["starter", "media", "studio", "business"];
export const REQUIRED_INTERVALS = ["month", "year"];
export const REQUIRED_STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
];
export const REQUIRED_ROUTE_PATHS = [
  "/pricing",
  "/api/auth/callback-url",
  "/api/billing/subscription/change",
  "/api/billing/stripe/webhook",
  "/api/internal/billing-contract-renewals/run",
];

const readArgValue = (argv, index, label) => {
  const value = argv[index + 1];
  if (!value) throw new Error(`${label} requires a value`);
  return value.trim();
};

export const parseArgs = (argv) => {
  const parsed = {
    baseUrl: "https://www.shortpulse.ai",
    strict: false,
    skipVercel: false,
    skipStripe: false,
    skipDbTrigger: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base-url") {
      parsed.baseUrl = readArgValue(argv, index, "--base-url").replace(/\/+$/, "");
      index += 1;
      continue;
    }
    if (arg === "--strict") {
      parsed.strict = true;
      continue;
    }
    if (arg === "--skip-vercel") {
      parsed.skipVercel = true;
      continue;
    }
    if (arg === "--skip-stripe") {
      parsed.skipStripe = true;
      continue;
    }
    if (arg === "--skip-db-trigger") {
      parsed.skipDbTrigger = true;
      continue;
    }
    if (arg === "--json") {
      parsed.json = true;
      continue;
    }
    if (arg === "--env-file") {
      readArgValue(argv, index, "--env-file");
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return parsed;
};

export const usage = () => {
  console.log(`Usage:
  node scripts/check_billing_launch_readiness.mjs [options]

Options:
  --base-url <url>       Production URL to verify. Default: https://www.shortpulse.ai
  --strict               Exit non-zero on warnings as well as failures.
  --skip-vercel          Skip Vercel env/route checks.
  --skip-stripe          Skip Stripe webhook endpoint checks.
  --skip-db-trigger      Skip hosted DB auth trigger checks.
  --json                 Emit machine-readable JSON only.
  --env-file <path>      Optional env file path (repeatable). Parsed by shared loader.
`);
};

export const createReporter = () => {
  const checks = [];
  const record = ({ status, id, summary, detail = null }) => {
    checks.push({ status, id, summary, detail });
  };
  return {
    checks,
    pass: (id, summary, detail = null) => record({ status: "pass", id, summary, detail }),
    warn: (id, summary, detail = null) => record({ status: "warn", id, summary, detail }),
    fail: (id, summary, detail = null) => record({ status: "fail", id, summary, detail }),
  };
};

export const runNodeScript = async (scriptPath, args) => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    maxBuffer: 20 * 1024 * 1024,
  });
  return `${stdout}${stderr ? `\n${stderr}` : ""}`.trim();
};

export const fetchText = async (url, options = {}) => {
  const response = await fetch(url, options);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${body.slice(0, 240)}`);
  }
  return { response, body };
};

export const fetchJson = async (url, options = {}) => {
  const { body } = await fetchText(url, options);
  return JSON.parse(body);
};

export const parseNextData = (html) => {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) throw new Error("Missing __NEXT_DATA__ payload on /pricing.");
  return JSON.parse(match[1]);
};
