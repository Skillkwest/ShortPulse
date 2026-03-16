# Agent Instructions (ShortPulse Docs)

Scope: `ShortPulse/docs/`.

Inherit the root startup contract in `../AGENTS.md` first, then apply the scoped docs rules below.

## Keep docs discoverable
- If you add a new doc, add it to `README.md` (docs index) and the relevant section index (`api/README.md`, `sops/README.md`, etc.) when appropriate.
- Update `documentation_overview.md` if the documentation taxonomy or governance rules change.
- Prefer small, scoped docs over giant catch-alls; keep titles and filenames consistent (`kebab-case.md`).

## Mini Ecosystem isolation
- Treat `mini-ecosystem/` as out-of-scope for default docs audits and planning/build reviews unless the user explicitly asks for Mini Ecosystem work.
- Do not include Mini Ecosystem artifacts in routine docs quality sweeps that target canonical product docs under `docs/`.

## When to update docs
- Routes, navigation, or page behavior changes: update `../README.md` and the relevant SOP.
- Supabase changes (tables/RLS/storage): update `supabase_full_schema.sql`, `data-dictionary.md`, and `security-checklist.md`.
- Supabase workflow docs: enforce CLI-first instructions and explicitly avoid Docker-based local Supabase commands.
