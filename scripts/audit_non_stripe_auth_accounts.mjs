#!/usr/bin/env node

/**
 * Read-only footprint audit for suspicious Auth users that are not linked to
 * Stripe. Produces deletion-readiness classifications without mutating Auth,
 * billing, storage, Stripe, or customer data.
 */

import fs from "node:fs";
import process from "node:process";
import { loadLocalEnv } from "./lib/load_local_env.mjs";

const DEFAULT_ENV_FILES = [
  ".env.agent.local",
  ".env.local",
  "frontend/.env.local",
];
const AUTH_LIST_PER_PAGE = 200;
const AUTH_LIST_MAX_PAGES = 100;
const PUBLIC_TABLES = [
  "billing_subscription_contracts",
  "ai_credit_ledger",
  "ai_credit_reservations",
  "ai_generations",
  "media_files",
  "projects",
  "user_owned_custom_voices",
];

const usage = () => {
  console.log(`Usage:
  node scripts/audit_non_stripe_auth_accounts.mjs [options]

Options:
  --email <email>             Target one email address (repeatable).
  --email-file <path>         Read one email per line.
  --user-id <uuid>            Target one auth user id (repeatable).
  --json                      Emit JSON instead of text.
  --show-identifiers          Print full emails and user ids. Default redacts them.
  --env-file <path>           Optional env file path (repeatable).
  --help                      Show this message.

Required env:
  SHORTPULSE_PRODUCTION_SUPABASE_URL and SHORTPULSE_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY
  or NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
`);
};

const argValue = (argv, index, flag) => {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
};

const parseArgs = (argv) => {
  const parsed = {
    emails: [],
    userIds: [],
    json: false,
    showIdentifiers: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--email") {
      parsed.emails.push(argValue(argv, index, "--email").trim().toLowerCase());
      index += 1;
      continue;
    }
    if (arg === "--email-file") {
      const filePath = argValue(argv, index, "--email-file");
      const fileEmails = fs
        .readFileSync(filePath, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim().toLowerCase())
        .filter((line) => line && !line.startsWith("#"));
      parsed.emails.push(...fileEmails);
      index += 1;
      continue;
    }
    if (arg === "--user-id") {
      parsed.userIds.push(argValue(argv, index, "--user-id").trim());
      index += 1;
      continue;
    }
    if (arg === "--json") {
      parsed.json = true;
      continue;
    }
    if (arg === "--show-identifiers") {
      parsed.showIdentifiers = true;
      continue;
    }
    if (arg === "--env-file") {
      argValue(argv, index, "--env-file");
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  parsed.emails = Array.from(new Set(parsed.emails.filter(Boolean)));
  parsed.userIds = Array.from(new Set(parsed.userIds.filter(Boolean)));
  return parsed;
};

const normalizeSupabaseUrl = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\/+$/, "");

const readSupabaseConfig = () => {
  const supabaseUrl = normalizeSupabaseUrl(
    process.env.SHORTPULSE_PRODUCTION_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const serviceRoleKey = String(
    process.env.SHORTPULSE_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      "",
  ).trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase URL or service-role key for read-only account audit.",
    );
  }
  if (!supabaseUrl.includes(".supabase.co")) {
    throw new Error(
      "Supabase URL appears invalid. Expected a hosted Supabase project URL.",
    );
  }
  return { supabaseUrl, serviceRoleKey };
};

const authHeaders = (serviceRoleKey) => ({
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
});

const restHeaders = (serviceRoleKey, extra = {}) => ({
  ...authHeaders(serviceRoleKey),
  Prefer: "count=exact",
  ...extra,
});

const redactEmail = (email) => {
  const [local = "", domain = ""] = String(email ?? "").split("@");
  if (!local || !domain) return "(unknown)";
  const localPrefix = local.slice(0, Math.min(2, local.length));
  return `${localPrefix}${"*".repeat(Math.max(3, local.length - localPrefix.length))}@${domain}`;
};

const redactUserId = (userId) => {
  const value = String(userId ?? "");
  if (value.length < 12) return "(unknown)";
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
};

const parseContentRangeCount = (value) => {
  const raw = String(value ?? "");
  const match = raw.match(/\/(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : null;
};

const fetchJson = async ({ supabaseUrl, serviceRoleKey }, path, init = {}) => {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      ...authHeaders(serviceRoleKey),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(
      `${path} returned ${response.status}: ${text.slice(0, 200)}`,
    );
  }
  return { payload, response };
};

const listUsersPage = async (config, page) => {
  const url = new URL(`${config.supabaseUrl}/auth/v1/admin/users`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(AUTH_LIST_PER_PAGE));
  const response = await fetch(url, {
    headers: authHeaders(config.serviceRoleKey),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Auth user list failed (${response.status}).`);
  }
  return Array.isArray(payload?.users) ? payload.users : [];
};

const getAuthUserById = async (config, userId) => {
  const { payload } = await fetchJson(
    config,
    `/auth/v1/admin/users/${encodeURIComponent(userId)}`,
  );
  return payload?.user ?? null;
};

const findAuthUserByEmail = async (config, email) => {
  for (let page = 1; page <= AUTH_LIST_MAX_PAGES; page += 1) {
    const users = await listUsersPage(config, page);
    const found = users.find(
      (user) =>
        String(user?.email ?? "")
          .trim()
          .toLowerCase() === email,
    );
    if (found) return found;
    if (users.length < AUTH_LIST_PER_PAGE) break;
  }
  return null;
};

const restSelect = async (config, table, query) => {
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/${table}?${query}`,
    {
      headers: restHeaders(config.serviceRoleKey, { Range: "0-999" }),
    },
  );
  const body = await response.text();
  if (!response.ok) {
    return {
      rows: [],
      count: null,
      error: `${response.status}: ${body.slice(0, 160)}`,
    };
  }
  return {
    rows: body ? JSON.parse(body) : [],
    count: parseContentRangeCount(response.headers.get("content-range")),
    error: null,
  };
};

const countRowsForUser = async (config, table, userId) => {
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/${table}?select=id&user_id=eq.${encodeURIComponent(userId)}`,
    {
      headers: restHeaders(config.serviceRoleKey, { Range: "0-0" }),
    },
  );
  const body = await response.text();
  if (!response.ok) {
    return { count: null, error: `${response.status}: ${body.slice(0, 160)}` };
  }
  return {
    count: parseContentRangeCount(response.headers.get("content-range")) ?? 0,
    error: null,
  };
};

const probeStoragePrefix = async (config, userId) => {
  const response = await fetch(
    `${config.supabaseUrl}/storage/v1/object/list/media_library`,
    {
      method: "POST",
      headers: authHeaders(config.serviceRoleKey),
      body: JSON.stringify({
        prefix: userId,
        limit: 1,
        offset: 0,
        sortBy: { column: "name", order: "asc" },
      }),
    },
  );
  const text = await response.text();
  if (!response.ok) {
    return {
      checked: false,
      hasObjects: null,
      error: `${response.status}: ${text.slice(0, 160)}`,
    };
  }
  const payload = text ? JSON.parse(text) : [];
  return {
    checked: true,
    hasObjects: Array.isArray(payload) ? payload.length > 0 : null,
    error: null,
  };
};

const summarizeLedger = (rows) => {
  let total = 0;
  const sources = new Map();
  for (const row of rows) {
    const change = Number(row?.change_cents ?? 0);
    if (Number.isFinite(change)) total += change;
    const source = String(row?.source ?? "unknown");
    sources.set(source, (sources.get(source) ?? 0) + 1);
  }
  return {
    sampledNetChangeCents: total,
    sampledSources: Object.fromEntries([...sources.entries()].sort()),
  };
};

const auditUser = async (config, authUser) => {
  const userId = String(authUser?.id ?? "");
  const [billingProfile, balance, ledger, ...counts] = await Promise.all([
    restSelect(
      config,
      "billing_profiles",
      `select=plan_id,stripe_customer_id,stripe_subscription_id,subscription_status,current_period_end&user_id=eq.${encodeURIComponent(userId)}`,
    ),
    restSelect(
      config,
      "ai_credit_balance",
      `select=balance_cents,updated_at&user_id=eq.${encodeURIComponent(userId)}`,
    ),
    restSelect(
      config,
      "ai_credit_ledger",
      `select=change_cents,source&user_id=eq.${encodeURIComponent(userId)}&limit=1000`,
    ),
    ...PUBLIC_TABLES.map((table) => countRowsForUser(config, table, userId)),
  ]);

  const tableCounts = Object.fromEntries(
    PUBLIC_TABLES.map((table, index) => [table, counts[index]?.count]),
  );
  const tableErrors = Object.fromEntries(
    PUBLIC_TABLES.map((table, index) => [table, counts[index]?.error]).filter(
      ([, error]) => error,
    ),
  );
  const profile = billingProfile.rows[0] ?? null;
  const creditBalance = balance.rows[0] ?? null;
  const storage = await probeStoragePrefix(config, userId);
  const ledgerSummary = summarizeLedger(ledger.rows);
  const stripeLinked = Boolean(
    profile?.stripe_customer_id ||
    profile?.stripe_subscription_id ||
    (tableCounts.billing_subscription_contracts ?? 0) > 0,
  );
  const appFootprint =
    Number(creditBalance?.balance_cents ?? 0) !== 0 ||
    Object.entries(tableCounts).some(
      ([table, count]) =>
        table !== "billing_subscription_contracts" && Number(count ?? 0) > 0,
    ) ||
    storage.hasObjects === true;

  let deletionReadiness = "zero_footprint_auth_delete_candidate";
  if (stripeLinked) {
    deletionReadiness = "stripe_review_required_before_delete";
  } else if (appFootprint) {
    deletionReadiness = "owned_footprint_cleanup_required_before_auth_delete";
  }

  return {
    user: {
      id: userId,
      email: authUser?.email ?? null,
      createdAt: authUser?.created_at ?? null,
      lastSignInAt: authUser?.last_sign_in_at ?? null,
    },
    billing: {
      planId: profile?.plan_id ?? null,
      subscriptionStatus: profile?.subscription_status ?? null,
      hasStripeCustomerId: Boolean(profile?.stripe_customer_id),
      hasStripeSubscriptionId: Boolean(profile?.stripe_subscription_id),
      profileReadError: billingProfile.error,
    },
    credits: {
      balanceCents: Number(creditBalance?.balance_cents ?? 0),
      balanceReadError: balance.error,
      ledgerCount: ledger.count,
      ledgerReadError: ledger.error,
      ...ledgerSummary,
    },
    counts: tableCounts,
    countErrors: tableErrors,
    storage,
    deletionReadiness,
  };
};

const redactReport = (report, showIdentifiers) => {
  if (showIdentifiers) return report;
  return {
    ...report,
    user: {
      ...report.user,
      id: redactUserId(report.user.id),
      email: redactEmail(report.user.email),
    },
  };
};

const printTextReport = (reports, showIdentifiers) => {
  console.log(`Audited accounts: ${reports.length}`);
  for (const rawReport of reports) {
    const report = redactReport(rawReport, showIdentifiers);
    console.log(`\n- ${report.user.email} (${report.user.id})`);
    console.log(
      `  created=${report.user.createdAt ?? "unknown"} lastSignIn=${report.user.lastSignInAt ?? "never"}`,
    );
    console.log(
      `  billing plan=${report.billing.planId ?? "none"} status=${report.billing.subscriptionStatus ?? "none"} stripeCustomer=${report.billing.hasStripeCustomerId} stripeSubscription=${report.billing.hasStripeSubscriptionId}`,
    );
    console.log(
      `  credits balance=${report.credits.balanceCents} ledger=${report.credits.ledgerCount ?? "unknown"} reservations=${report.counts.ai_credit_reservations ?? "unknown"} generations=${report.counts.ai_generations ?? "unknown"}`,
    );
    console.log(
      `  media=${report.counts.media_files ?? "unknown"} projects=${report.counts.projects ?? "unknown"} voices=${report.counts.user_owned_custom_voices ?? "unknown"} storagePrefix=${report.storage.checked ? String(report.storage.hasObjects) : "unproven"}`,
    );
    console.log(`  deletionReadiness=${report.deletionReadiness}`);
  }
};

const main = async () => {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  if (args.help) {
    usage();
    return;
  }
  if (args.emails.length === 0 && args.userIds.length === 0) {
    throw new Error(
      "Provide at least one --email, --email-file, or --user-id target.",
    );
  }

  loadLocalEnv({ argv, defaultPaths: DEFAULT_ENV_FILES });
  const config = readSupabaseConfig();
  const targets = [];

  for (const email of args.emails) {
    const user = await findAuthUserByEmail(config, email);
    if (!user) {
      targets.push({ missing: true, email });
      continue;
    }
    targets.push(user);
  }

  for (const userId of args.userIds) {
    const user = await getAuthUserById(config, userId);
    if (!user) {
      targets.push({ missing: true, userId });
      continue;
    }
    targets.push(user);
  }

  const reports = [];
  for (const target of targets) {
    if (target.missing) {
      reports.push({
        user: {
          id: target.userId ?? "(not found)",
          email: target.email ?? "(not found)",
          createdAt: null,
          lastSignInAt: null,
        },
        billing: {},
        credits: {},
        counts: {},
        countErrors: {},
        storage: {
          checked: false,
          hasObjects: null,
          error: "auth user not found",
        },
        deletionReadiness: "auth_user_not_found",
      });
      continue;
    }
    reports.push(await auditUser(config, target));
  }

  if (args.json) {
    console.log(
      JSON.stringify(
        reports.map((report) => redactReport(report, args.showIdentifiers)),
        null,
        2,
      ),
    );
    return;
  }
  printTextReport(reports, args.showIdentifiers);
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
