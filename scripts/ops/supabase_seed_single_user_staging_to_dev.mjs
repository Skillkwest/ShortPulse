#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const require = createRequire(import.meta.url);
const { createClient } = require(path.join(
  repoRoot,
  "frontend",
  "node_modules",
  "@supabase",
  "supabase-js",
  "dist",
  "index.cjs"
));

const args = process.argv.slice(2);

const usage = () => {
  console.log(`Usage:
  node scripts/ops/supabase_seed_single_user_staging_to_dev.mjs --email <email> [--apply] [--skip-db] [--storage-scope <full|continuity|project-continuity|project-runtime>] [--storage-concurrency <n>]

Options:
  --email <email>   Required. User email to seed from staging into development.
  --apply           Execute the copy. Without this flag the script only prints the plan.
  --skip-db         Skip relational upserts and copy only storage objects.
  --storage-scope   Storage copy scope. "full" copies every rewritten path,
                    "continuity" copies project/character continuity assets,
                    "project-continuity" copies project-linked continuity assets plus
                    snapshot/character support, and "project-runtime" copies only
                    project-linked runtime originals.
                    Default: full.
  --storage-concurrency  Parallel storage copy workers. Default: 16.
`);
};

let email = "";
let apply = false;
let skipDb = false;
let storageScope = "full";
let storageConcurrency = 16;
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--email") {
    email = args[i + 1] ?? "";
    i += 1;
    continue;
  }
  if (arg === "--apply") {
    apply = true;
    continue;
  }
  if (arg === "--skip-db") {
    skipDb = true;
    continue;
  }
  if (arg === "--storage-scope") {
    storageScope = args[i + 1] ?? "";
    i += 1;
    continue;
  }
  if (arg === "--storage-concurrency") {
    storageConcurrency = Number.parseInt(args[i + 1] ?? "", 10);
    i += 1;
    continue;
  }
  if (arg === "--help" || arg === "-h") {
    usage();
    process.exit(0);
  }
  throw new Error(`Unknown argument: ${arg}`);
}

if (!email) {
  usage();
  process.exit(1);
}
if (!["full", "continuity", "project-continuity", "project-runtime"].includes(storageScope)) {
  throw new Error(`Unsupported --storage-scope value: ${storageScope}`);
}
if (!Number.isInteger(storageConcurrency) || storageConcurrency < 1) {
  throw new Error(`Unsupported --storage-concurrency value: ${storageConcurrency}`);
}

const envPath = path.join(repoRoot, ".env.agent.local");
const envText = fs.readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const idx = line.indexOf("=");
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
      return [key, value];
    })
);

const requireEnv = (name) => {
  const value = env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
};

const STAGING_DB_URL = requireEnv("SHORTPULSE_STAGING_DB_URL");
const DEV_DB_URL = requireEnv("SHORTPULSE_DEVELOPMENT_DB_URL");
const STAGING_URL = requireEnv("SHORTPULSE_STAGING_SUPABASE_URL");
const DEV_URL = requireEnv("SHORTPULSE_DEVELOPMENT_SUPABASE_URL");
const STAGING_SERVICE_ROLE_KEY = requireEnv("SHORTPULSE_STAGING_SUPABASE_SERVICE_ROLE_KEY");
const DEV_SERVICE_ROLE_KEY = requireEnv("SHORTPULSE_DEVELOPMENT_SUPABASE_SERVICE_ROLE_KEY");

const PSQL_BIN = "/opt/homebrew/opt/libpq/bin/psql";
const MEDIA_BUCKET = "media_library";
const BATCH_SIZE = 200;

const psql = (dbUrl, sql) =>
  execFileSync(
    PSQL_BIN,
    [dbUrl, "-X", "-A", "-t", "-F", "\t", "-c", sql],
    { encoding: "utf8" }
  ).trim();

const singleValue = (text) => text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0] ?? "";
const sqlQuote = (value) => `'${String(value).replace(/'/g, "''")}'`;

const stagingUserId = singleValue(
  psql(
    STAGING_DB_URL,
    `select id from auth.users where lower(email)=lower('${email.replace(/'/g, "''")}');`
  )
);
const devUserId = singleValue(
  psql(
    DEV_DB_URL,
    `select id from auth.users where lower(email)=lower('${email.replace(/'/g, "''")}');`
  )
);

if (!stagingUserId) throw new Error(`No staging auth.users row found for ${email}`);
if (!devUserId) throw new Error(`No development auth.users row found for ${email}`);

const staging = createClient(STAGING_URL, STAGING_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const dev = createClient(DEV_URL, DEV_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const tableConfigs = [
  { table: "projects", conflict: "id", order: ["id"] },
  { table: "media_prompts", conflict: "id", order: ["id"] },
  { table: "media_folders", conflict: "id", order: ["id"] },
  { table: "ai_generations", conflict: "id", order: ["id"] },
  { table: "generation_attempts", conflict: "id", order: ["id"] },
  { table: "media_files", conflict: "id", order: ["id"] },
  { table: "ai_generation_outputs", conflict: "id", order: ["id"] },
  { table: "generation_publications", conflict: "id", order: ["id"] },
  { table: "generation_projection", conflict: "generation_id", order: ["generation_id"] },
  { table: "characters", conflict: "id", order: ["id"] },
  { table: "character_reference_packs", conflict: "id", order: ["id"] },
  { table: "character_media_assets", conflict: "id", order: ["id"] },
  { table: "character_reference_images", conflict: "id", order: ["id"] },
  { table: "character_quick_swap_items", conflict: "id", order: ["id"] },
  { table: "project_generation_items", conflict: "project_id,generation_id", order: ["project_id", "generation_id"] },
  { table: "project_prompt_items", conflict: "project_id,prompt_id", order: ["project_id", "prompt_id"] },
  { table: "project_workspace_states", conflict: "project_id", order: ["project_id"] },
  { table: "project_media_items", conflict: "project_id,media_file_id", order: ["project_id", "media_file_id"] },
  { table: "user_preferences", conflict: "user_id", order: ["user_id"] },
  {
    table: "user_media_compliance_acceptances",
    conflict: "user_id,agreement_key,agreement_version",
    order: ["id"],
  },
];

const STORAGE_PATH_KEYS = new Set([
  "storage_path",
  "thumbnail_path",
  "poster_variant_path",
  "thumb_variant_path",
  "preview_variant_path",
  "preview_storage_path",
  "full_storage_path",
]);

const storagePathMap = new Map();

const rewriteUserScopedPath = (value) => {
  if (typeof value !== "string") return value;
  if (!value.startsWith(`${stagingUserId}/`)) return value;
  return `${devUserId}/${value.slice(stagingUserId.length + 1)}`;
};

const deepReplace = (value) => {
  if (typeof value === "string") {
    const replaced = value.split(stagingUserId).join(devUserId);
    return rewriteUserScopedPath(replaced);
  }
  if (Array.isArray(value)) return value.map((entry) => deepReplace(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => {
        if (STORAGE_PATH_KEYS.has(key)) {
          const next = rewriteUserScopedPath(entry);
          if (typeof entry === "string" && typeof next === "string" && entry !== next) {
            storagePathMap.set(entry, next);
          }
          return [key, next];
        }
        return [key, deepReplace(entry)];
      })
    );
  }
  return value;
};

const normalizeRow = (row) => {
  const next = deepReplace(row);
  if ("user_id" in next) next.user_id = devUserId;
  if ("snapshot" in next && next.snapshot && typeof next.snapshot === "object") {
    next.snapshot = deepReplace(next.snapshot);
  }
  for (const key of STORAGE_PATH_KEYS) {
    if (typeof row[key] === "string") {
      const rewritten = rewriteUserScopedPath(row[key]);
      if (typeof rewritten === "string" && rewritten !== row[key]) {
        storagePathMap.set(row[key], rewritten);
        next[key] = rewritten;
      }
    }
  }
  return next;
};

const fetchTableRows = async ({ table, order }) => {
  const rows = [];
  let from = 0;
  while (true) {
    let query = staging.from(table).select("*").eq("user_id", stagingUserId);
    for (const column of order) {
      query = query.order(column, { ascending: true });
    }
    const { data, error } = await query.range(from, from + BATCH_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < BATCH_SIZE) break;
    from += BATCH_SIZE;
  }
  return rows;
};

const chunk = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const plannedRows = [];
for (const config of tableConfigs) {
  const rows = await fetchTableRows(config);
  plannedRows.push({
    ...config,
    sourceRows: rows,
    targetRows: rows.map((row) => normalizeRow(row)),
  });
}

const findPlan = (table) => plannedRows.find((plan) => plan.table === table);

const characterMediaAssetsPlan = findPlan("character_media_assets");
const quickSwapPlan = findPlan("character_quick_swap_items");

let skippedInvalidQuickSwapRows = 0;
if (characterMediaAssetsPlan && quickSwapPlan) {
  const assetKindById = new Map(
    characterMediaAssetsPlan.sourceRows.map((row) => [row.id, row.asset_kind ?? ""])
  );
  const retainedSourceRows = [];
  const retainedTargetRows = [];

  for (let index = 0; index < quickSwapPlan.sourceRows.length; index += 1) {
    const sourceRow = quickSwapPlan.sourceRows[index];
    const assetKind = assetKindById.get(sourceRow.character_media_id ?? "") ?? "";
    if (sourceRow.character_media_id && assetKind && assetKind !== "quickswap") {
      skippedInvalidQuickSwapRows += 1;
      continue;
    }
    retainedSourceRows.push(sourceRow);
    retainedTargetRows.push(quickSwapPlan.targetRows[index]);
  }

  quickSwapPlan.sourceRows = retainedSourceRows;
  quickSwapPlan.targetRows = retainedTargetRows;
}

const collectUserScopedPaths = (value, acc) => {
  if (typeof value === "string") {
    if (value.startsWith(`${stagingUserId}/`)) {
      acc.add(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectUserScopedPaths(entry, acc);
    return;
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) collectUserScopedPaths(entry, acc);
  }
};

const projectContinuityStoragePaths = (() => {
  const required = new Set();
  const projectMediaItemsPlan = findPlan("project_media_items");
  const projectGenerationItemsPlan = findPlan("project_generation_items");
  const aiGenerationOutputsPlan = findPlan("ai_generation_outputs");
  const mediaFilesPlan = findPlan("media_files");

  const referencedMediaIds = new Set(
    (projectMediaItemsPlan?.sourceRows ?? []).map((row) => row.media_file_id).filter(Boolean)
  );
  const referencedGenerationIds = new Set(
    (projectGenerationItemsPlan?.sourceRows ?? []).map((row) => row.generation_id).filter(Boolean)
  );

  for (const outputRow of aiGenerationOutputsPlan?.sourceRows ?? []) {
    if (referencedGenerationIds.has(outputRow.generation_id) && outputRow.media_file_id) {
      referencedMediaIds.add(outputRow.media_file_id);
    }
  }

  for (const mediaRow of mediaFilesPlan?.sourceRows ?? []) {
    if (!referencedMediaIds.has(mediaRow.id)) continue;
    for (const key of STORAGE_PATH_KEYS) {
      if (typeof mediaRow[key] === "string" && mediaRow[key]) {
        required.add(mediaRow[key]);
      }
    }
  }

  for (const mediaRow of characterMediaAssetsPlan?.sourceRows ?? []) {
    for (const key of STORAGE_PATH_KEYS) {
      if (typeof mediaRow[key] === "string" && mediaRow[key]) {
        required.add(mediaRow[key]);
      }
    }
    collectUserScopedPaths(mediaRow.metadata, required);
  }

  return required;
})();

const projectRuntimeStoragePaths = (() => {
  const required = new Set();
  const projectMediaItemsPlan = findPlan("project_media_items");
  const projectGenerationItemsPlan = findPlan("project_generation_items");
  const aiGenerationOutputsPlan = findPlan("ai_generation_outputs");
  const mediaFilesPlan = findPlan("media_files");

  const referencedMediaIds = new Set(
    (projectMediaItemsPlan?.sourceRows ?? []).map((row) => row.media_file_id).filter(Boolean)
  );
  const referencedGenerationIds = new Set(
    (projectGenerationItemsPlan?.sourceRows ?? []).map((row) => row.generation_id).filter(Boolean)
  );

  for (const outputRow of aiGenerationOutputsPlan?.sourceRows ?? []) {
    if (referencedGenerationIds.has(outputRow.generation_id) && outputRow.media_file_id) {
      referencedMediaIds.add(outputRow.media_file_id);
    }
  }

  for (const mediaRow of mediaFilesPlan?.sourceRows ?? []) {
    if (!referencedMediaIds.has(mediaRow.id)) continue;
    if (typeof mediaRow.storage_path === "string" && mediaRow.storage_path) {
      required.add(mediaRow.storage_path);
    }
  }

  return required;
})();

const continuityStoragePaths = (() => {
  const required = new Set(projectContinuityStoragePaths);
  const charactersPlan = findPlan("characters");
  const projectWorkspaceStatesPlan = findPlan("project_workspace_states");

  for (const mediaRow of characterMediaAssetsPlan?.sourceRows ?? []) {
    for (const key of STORAGE_PATH_KEYS) {
      if (typeof mediaRow[key] === "string" && mediaRow[key]) {
        required.add(mediaRow[key]);
      }
    }
    collectUserScopedPaths(mediaRow.metadata, required);
  }

  for (const row of projectWorkspaceStatesPlan?.sourceRows ?? []) {
    collectUserScopedPaths(row.snapshot, required);
  }

  for (const row of charactersPlan?.sourceRows ?? []) {
    collectUserScopedPaths(row.metadata, required);
  }

  return required;
})();

for (const sourcePath of continuityStoragePaths) {
  if (!storagePathMap.has(sourcePath)) {
    storagePathMap.set(sourcePath, rewriteUserScopedPath(sourcePath));
  }
}

let uniqueStorageCopies = [...storagePathMap.entries()].filter(([sourcePath]) => {
  if (!sourcePath) return false;
  if (storageScope === "full") return true;
  if (storageScope === "project-runtime") {
    return projectRuntimeStoragePaths.has(sourcePath);
  }
  if (storageScope === "project-continuity") {
    return projectContinuityStoragePaths.has(sourcePath);
  }
  return continuityStoragePaths.has(sourcePath);
});

const existingTargetPaths = new Set();
for (const targetBatch of chunk(uniqueStorageCopies.map(([, targetPath]) => targetPath), 200)) {
  if (targetBatch.length === 0) continue;
  const existingRows = psql(
    DEV_DB_URL,
    `select name
       from storage.objects
      where bucket_id = ${sqlQuote(MEDIA_BUCKET)}
        and name in (${targetBatch.map((value) => sqlQuote(value)).join(", ")});`
  );
  for (const line of existingRows.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean)) {
    existingTargetPaths.add(line);
  }
}
uniqueStorageCopies = uniqueStorageCopies.filter(([, targetPath]) => !existingTargetPaths.has(targetPath));

console.log(`[user-seed] email=${email}`);
console.log(`[user-seed] staging_user_id=${stagingUserId}`);
console.log(`[user-seed] dev_user_id=${devUserId}`);
console.log(`[user-seed] storage_scope=${storageScope}`);
console.log(`[user-seed] storage_concurrency=${storageConcurrency}`);
for (const plan of plannedRows) {
  console.log(`[user-seed] table=${plan.table} rows=${plan.sourceRows.length}`);
}
if (skippedInvalidQuickSwapRows > 0) {
  console.log(
    `[user-seed] skipped_invalid_character_quick_swap_items=${skippedInvalidQuickSwapRows}`
  );
}
if (existingTargetPaths.size > 0) {
  console.log(`[user-seed] storage_paths_already_present=${existingTargetPaths.size}`);
}
console.log(`[user-seed] storage_paths_to_copy=${uniqueStorageCopies.length}`);

if (!apply) {
  console.log("[user-seed] dry-run only; rerun with --apply to execute.");
  process.exit(0);
}

if (!skipDb) {
  for (const plan of plannedRows) {
    if (plan.targetRows.length === 0) continue;
    for (const batch of chunk(plan.targetRows, 100)) {
      const { error } = await dev
        .from(plan.table)
        .upsert(batch, { onConflict: plan.conflict, ignoreDuplicates: false });
      if (error) {
        throw new Error(`${plan.table} upsert failed: ${error.message}`);
      }
    }
    console.log(`[user-seed] upserted table=${plan.table} rows=${plan.targetRows.length}`);
  }
} else {
  console.log("[user-seed] skip_db=true; relational upserts skipped.");
}

const copyStorageObject = async ([sourcePath, targetPath]) => {
  let lastError = "";

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { data, error } = await staging.storage.from(MEDIA_BUCKET).download(sourcePath);
    if (error) {
      lastError = `download:${error.message}`;
      if (attempt < 3) await sleep(500 * attempt);
      continue;
    }
    const contentType =
      data && typeof data === "object" && "type" in data && typeof data.type === "string"
        ? data.type
        : undefined;
    const { error: uploadError } = await dev.storage
      .from(MEDIA_BUCKET)
      .upload(targetPath, data, { upsert: true, ...(contentType ? { contentType } : {}) });
    if (!uploadError) {
      return { ok: true, sourcePath, targetPath };
    }
    lastError = `upload:${uploadError.message}`;
    if (attempt < 3) await sleep(500 * attempt);
  }

  return { ok: false, sourcePath, targetPath, error: lastError || "unknown" };
};

const storageFailures = [];
for (let index = 0; index < uniqueStorageCopies.length; index += storageConcurrency) {
  const batch = uniqueStorageCopies.slice(index, index + storageConcurrency);
  const results = await Promise.all(batch.map((entry) => copyStorageObject(entry)));
  for (const result of results) {
    if (!result.ok) {
      storageFailures.push(result);
      console.warn(
        `[user-seed] storage_copy_failed source=${result.sourcePath} target=${result.targetPath} error=${result.error}`
      );
    }
  }
  console.log(
    `[user-seed] storage_copied=${Math.min(index + storageConcurrency, uniqueStorageCopies.length)}/${uniqueStorageCopies.length}`
  );
}

if (storageFailures.length > 0) {
  throw new Error(`storage copy incomplete failures=${storageFailures.length}`);
}

console.log("[user-seed] done");
