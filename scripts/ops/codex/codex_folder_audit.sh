#!/usr/bin/env bash
# Purpose: verify the Codex local operating folder stays complete, indexed, and docs-clean.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../../.." && pwd)"

required_files=(
  "docs/agents/codex/README.md"
  "docs/agents/codex/AGENTS.md"
  "docs/agents/codex/memory.md"
  "docs/records/artifacts/agent/codex/README.md"
  "docs/records/artifacts/agent/codex/training-history.md"
  "docs/records/artifacts/agent/codex/tools.md"
)

echo "Checking required Codex files..."
for rel_path in "${required_files[@]}"; do
  if [[ ! -f "${repo_root}/${rel_path}" ]]; then
    echo "Missing required file: ${rel_path}" >&2
    exit 1
  fi
done

echo "Checking docs indexes..."
grep -q 'docs/agents/codex/README.md' "${repo_root}/docs/agents/README.md"
grep -q 'docs/agents/codex/AGENTS.md' "${repo_root}/docs/agents/README.md"
grep -q 'docs/agents/codex/memory.md' "${repo_root}/docs/README.md"

echo "Running docs validation..."
(
  cd "${repo_root}"
  node scripts/check_docs_links.js
  node scripts/check_docs_semantic_drift.js
)

echo "Codex folder audit passed."
