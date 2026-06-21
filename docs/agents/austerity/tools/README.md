# Austerity Tools

Purpose: inventory helper tools, commands, scripts, and checklists used by Austerity legal-policy runs.

## Current Tools

No Austerity-specific executable tools exist yet.

## Standard Commands

- Docs validation: `npm -C frontend run docs:check`
- Route/footer search: `rg -n "terms|privacy|refund|legal" README.md docs frontend --glob '!frontend/.next/**' --glob '!frontend/node_modules/**'`
- Policy route existence check: `find frontend/pages -maxdepth 2 -type f \( -name '*terms*' -o -name '*privacy*' -o -name '*refund*' \)`

## Tool Rules

- Add scripts only after a repeated Austerity workflow proves the need.
- Prefer read-only audits before automated rewrites.
- Do not encode legal conclusions into scripts unless they are approved policy checks with clear source-of-truth docs.
- Keep legal-policy tools scoped to evidence collection, link/route checks, source ledgers, and docs validation unless the user approves more.
