#!/usr/bin/env node
/**
 * Hosted schema contract probe for migration-sensitive runtime columns.
 * Uses PostgREST limit=0 checks when Supabase URL/API credentials are present,
 * and falls back to psql information_schema checks when only SUPABASE_DB_URL is
 * available in hosted migration workflows.
 */
import { execFileSync } from "node:child_process";

const REQUIRED_TABLES = [
  {
    table: "generation_projection",
    columns: [
      "generation_id",
      "workspace_runtime_key",
      "workflow_reload",
      "save_error",
      "display_title",
      "remux_recovery",
    ],
  },
  {
    table: "project_workspace_states",
    columns: ["project_id", "checkpoint_revision", "snapshot_updated_at"],
  },
  {
    table: "project_output_display_items",
    columns: [
      "project_id",
      "output_id",
      "source_snapshot_updated_at",
      "display_title",
    ],
  },
  {
    table: "project_generation_items",
    columns: ["project_id", "generation_id", "user_id"],
  },
  {
    table: "browser_crash_sessions",
    columns: [
      "review_status",
      "reviewed_at",
      "reviewed_by",
      "reviewed_by_email",
      "review_note",
    ],
  },
];

const REQUIRED_INDEXES = [
  {
    schema: "public",
    table: "ai_generations",
    index: "ai_generations_user_request_id_unique_idx",
  },
];

const readArg = (name) => {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length).trim() : "";
};

const normalizeBaseUrl = (value) =>
  value.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");

const resolveRestConfig = () => {
  const url =
    readArg("supabase-url") ||
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_REST_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const key =
    readArg("supabase-key") ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  if (!url || !key) return null;
  return { baseUrl: normalizeBaseUrl(url), key };
};

const resolveDbUrl = () =>
  readArg("db-url") || process.env.SUPABASE_DB_URL || "";

const toJson = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const checkRestContract = async ({ baseUrl, key }) => {
  const failures = [];
  for (const { table, columns } of REQUIRED_TABLES) {
    const url = `${baseUrl}/rest/v1/${table}?select=${encodeURIComponent(columns.join(","))}&limit=0`;
    const response = await fetch(url, {
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
      },
    });
    if (response.ok) {
      console.log(`[schema-contract:rest] ${table} ok`);
      continue;
    }
    const body = await response.text();
    const parsed = toJson(body);
    failures.push(
      `${table} returned ${response.status}${parsed?.code ? ` ${parsed.code}` : ""}${
        parsed?.message ? `: ${parsed.message}` : ""
      }`,
    );
  }
  return failures;
};

const quoteSqlLiteral = (value) => `'${value.replaceAll("'", "''")}'`;

const checkDbContract = (dbUrl) => {
  const values = REQUIRED_TABLES.flatMap(({ table, columns }) =>
    columns.map(
      (column) =>
        `('public', ${quoteSqlLiteral(table)}, ${quoteSqlLiteral(column)})`,
    ),
  ).join(",\n");
  const indexValues = REQUIRED_INDEXES.map(
    ({ schema, table, index }) =>
      `(${quoteSqlLiteral(schema)}, ${quoteSqlLiteral(table)}, ${quoteSqlLiteral(index)})`,
  ).join(",\n");
  const sql = `
with expected_columns(table_schema, table_name, column_name) as (
  values
${values}
),
missing_columns as (
  select expected_columns.*
  from expected_columns
  left join information_schema.columns existing
    on existing.table_schema = expected_columns.table_schema
   and existing.table_name = expected_columns.table_name
   and existing.column_name = expected_columns.column_name
  where existing.column_name is null
),
expected_indexes(table_schema, table_name, index_name) as (
  values
${indexValues}
),
missing_indexes as (
  select expected_indexes.*
  from expected_indexes
  left join pg_indexes existing
    on existing.schemaname = expected_indexes.table_schema
   and existing.tablename = expected_indexes.table_name
   and existing.indexname = expected_indexes.index_name
  where existing.indexname is null
),
missing as (
  select table_schema, table_name, column_name, null::text as index_name
  from missing_columns
  union all
  select table_schema, table_name, null::text as column_name, index_name
  from missing_indexes
)
select coalesce(json_agg(missing order by table_name, column_name, index_name), '[]'::json)
from missing;
`;
  const output = execFileSync(
    "psql",
    [dbUrl, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).trim();
  const missing = toJson(output) ?? [];
  if (!Array.isArray(missing) || !missing.length) {
    console.log("[schema-contract:db] required columns and indexes ok");
    return [];
  }
  return missing.map((row) =>
    row.column_name
      ? `${row.table_schema}.${row.table_name}.${row.column_name} is missing`
      : `${row.table_schema}.${row.table_name} index ${row.index_name} is missing`,
  );
};

const run = async () => {
  const restConfig = resolveRestConfig();
  const dbUrl = resolveDbUrl();
  let failures = [];

  if (restConfig) {
    failures.push(...(await checkRestContract(restConfig)));
  }
  if (dbUrl) {
    failures.push(...checkDbContract(dbUrl));
  } else if (restConfig) {
    console.warn(
      "[schema-contract:db] index verification skipped because SUPABASE_DB_URL is unavailable",
    );
  } else {
    throw new Error(
      "Missing schema contract target. Provide SUPABASE_URL plus a Supabase API key, or SUPABASE_DB_URL.",
    );
  }

  if (failures.length) {
    console.error("[schema-contract] failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("[schema-contract] passed");
};

run().catch((error) => {
  console.error(
    `[schema-contract] error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
