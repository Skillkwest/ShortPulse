#!/usr/bin/env node

/**
 * Temporary guardrail: block implicit hosted migration pushes.
 * The repo's canonical migration source is `sql/migrations`, while
 * default Supabase CLI push behavior expects `supabase/migrations`.
 */

console.error(
  [
    "[db:migrate] blocked by policy.",
    "Do not use implicit `supabase db push` for hosted promotion in this repo.",
    "Use the environment-pinned SQL migration process documented in:",
    "docs/database-migrations.md and docs/deployment.md",
  ].join("\n")
);

process.exit(1);
