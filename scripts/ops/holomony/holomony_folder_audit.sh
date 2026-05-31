#!/usr/bin/env bash
# Purpose: verify the Holomony local operating folder stays complete, indexed, and docs-clean.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../../.." && pwd)"

required_files=(
  "docs/agents/holomony/README.md"
  "docs/agents/holomony/AGENTS.md"
  "docs/agents/holomony/memory.md"
  "docs/agents/holomony/media-display-command-index.md"
  "docs/agents/holomony/media-display-authority-ledger.md"
  "docs/agents/holomony/ownership-manifest.md"
  "docs/agents/holomony/right-rail-command-index.md"
  "docs/agents/holomony/standard-operating-procedure.md"
  "docs/records/artifacts/agent/holomony/README.md"
  "docs/records/artifacts/agent/holomony/tools.md"
  "docs/records/artifacts/agent/holomony/training-history.md"
  "scripts/ops/holomony/holomony_media_display_command_map.sh"
  "scripts/ops/holomony/holomony_right_rail_command_map.sh"
)

echo "Checking required Holomony files..."
for rel_path in "${required_files[@]}"; do
  if [[ ! -f "${repo_root}/${rel_path}" ]]; then
    echo "Missing required file: ${rel_path}" >&2
    exit 1
  fi
done

echo "Checking docs indexes..."
grep -q 'docs/agents/holomony/README.md' "${repo_root}/docs/agents/README.md"
grep -q 'docs/agents/holomony/standard-operating-procedure.md' "${repo_root}/docs/agents/README.md"
grep -q 'docs/agents/holomony/ownership-manifest.md' "${repo_root}/docs/agents/README.md"
grep -q 'docs/agents/holomony/media-display-command-index.md' "${repo_root}/docs/agents/README.md"
grep -q 'docs/agents/holomony/media-display-authority-ledger.md' "${repo_root}/docs/agents/README.md"
grep -q 'docs/agents/holomony/right-rail-command-index.md' "${repo_root}/docs/agents/README.md"
grep -q 'docs/agents/holomony/README.md' "${repo_root}/docs/README.md"
grep -q 'docs/agents/holomony/standard-operating-procedure.md' "${repo_root}/docs/README.md"
grep -q 'docs/agents/holomony/ownership-manifest.md' "${repo_root}/docs/README.md"
grep -q 'docs/agents/holomony/media-display-command-index.md' "${repo_root}/docs/README.md"
grep -q 'docs/agents/holomony/media-display-authority-ledger.md' "${repo_root}/docs/README.md"
grep -q 'docs/agents/holomony/right-rail-command-index.md' "${repo_root}/docs/README.md"
grep -q 'scripts/ops/holomony/holomony_media_display_command_map.sh' "${repo_root}/scripts/ops/README.md"
grep -q 'scripts/ops/holomony/holomony_right_rail_command_map.sh' "${repo_root}/scripts/ops/README.md"

echo "Running docs validation..."
(
  cd "${repo_root}"
  node scripts/check_docs_links.js
  node scripts/check_docs_semantic_drift.js
)

echo "Holomony folder audit passed."
