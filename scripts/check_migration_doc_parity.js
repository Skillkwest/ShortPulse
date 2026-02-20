// Migration/documentation parity checks.
// Run with: node scripts/check_migration_doc_parity.js
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(REPO_ROOT, "sql", "migrations");
const DATABASE_MIGRATIONS_DOC = path.join(REPO_ROOT, "docs", "database-migrations.md");
const SQL_SOP_DOC = path.join(REPO_ROOT, "docs", "sops", "sop_sql_migration_operations.md");

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function listMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d{3}_.+\.sql$/.test(file))
    .sort();
}

function extractMigrationReferences(text) {
  const refs = new Set();
  const pattern = /sql\/migrations\/(\d{3}_[a-z0-9_]+\.sql)/gi;
  let match = pattern.exec(text);
  while (match) {
    refs.add(match[1]);
    match = pattern.exec(text);
  }
  return refs;
}

function extractAllMentionedMigrationFiles(text) {
  const refs = new Set();
  const pattern = /(\d{3}_[a-z0-9_]+\.sql)/gi;
  let match = pattern.exec(text);
  while (match) {
    refs.add(match[1]);
    match = pattern.exec(text);
  }
  return refs;
}

function run() {
  const errors = [];
  const migrationFiles = listMigrationFiles();

  const dbDocText = readText(DATABASE_MIGRATIONS_DOC);
  const sopDocText = readText(SQL_SOP_DOC);

  const dbDocRefs = extractMigrationReferences(dbDocText);
  const sopDocMentions = extractAllMentionedMigrationFiles(sopDocText);

  for (const migrationFile of migrationFiles) {
    if (!dbDocRefs.has(migrationFile) && !sopDocMentions.has(migrationFile)) {
      errors.push(`Migration missing from docs inventory: ${migrationFile}`);
    }
  }

  const allDocMentions = new Set([...dbDocRefs, ...sopDocMentions]);
  for (const mention of allDocMentions) {
    const exists = fs.existsSync(path.join(MIGRATIONS_DIR, mention));
    if (!exists) {
      errors.push(`Docs reference missing migration file: ${mention}`);
    }
  }

  if (!dbDocText.includes("018_add_ai_agent_conversation_state.sql")) {
    errors.push("docs/database-migrations.md missing migration 018 reference.");
  }
  if (!dbDocText.includes("028_harden_ai_agent_conversation_state_security.sql")) {
    errors.push("docs/database-migrations.md missing migration 028 reference.");
  }
  if (!sopDocText.includes("028_harden_ai_agent_conversation_state_security.sql")) {
    errors.push("docs/sops/sop_sql_migration_operations.md missing migration 028 reference.");
  }

  if (errors.length) {
    console.error("Migration/doc parity checks failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("Migration/doc parity checks passed.");
}

run();
