---
name: skill-doc-index
description: Verify docs/README.md includes key docs and keep documentation_overview in sync.
---

# Doc Index Audit

Purpose: prevent doc drift by ensuring the docs index stays complete.

## When to use
- New docs are added
- SOPs or runbooks are introduced/renamed
- Before MVP release readiness

## Sources of truth
- `docs/README.md`
- `docs/documentation_overview.md`
- `docs/AGENTS.md`
- `docs/known-issues.md`
- `scripts/check_docs_links.js` (API doc link checker)

## Workflow
1. **Index coverage**
   - Ensure `docs/README.md` lists new docs and critical runbooks.
   - Confirm `docs/AGENTS.md` and `docs/known-issues.md` are included.
2. **Overview sync**
   - Check that `docs/documentation_overview.md` reflects key docs and current scope.
3. **API docs**
   - Run `node scripts/check_docs_links.js` to ensure API docs are referenced.
4. **Report**
   - List missing docs and where they should be added.

## Output format (recommended)
```
Doc index report
- Missing from docs/README.md: <list>
- Missing from documentation_overview.md: <list>
```
