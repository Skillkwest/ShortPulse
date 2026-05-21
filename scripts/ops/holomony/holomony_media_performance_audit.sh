#!/usr/bin/env bash
# Purpose: verify the core media-performance package Holomony depends on is present and docs-clean.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../../.." && pwd)"

required_files=(
  "docs/agents/holomony/README.md"
  "docs/agents/holomony/AGENTS.md"
  "docs/agents/holomony/memory.md"
  "docs/agents/holomony/standard-operating-procedure.md"
  "docs/records/artifacts/agent/holomony/tools.md"
  "docs/records/artifacts/agent/holomony/media-surface-inventory.md"
  "docs/records/artifacts/agent/holomony/training-history.md"
  "docs/sops/sop_media_performance_operations.md"
  "docs/sops/sop_media_panel_performance_kpi.md"
  "frontend/scripts/media_panel_kpi_capture.mjs"
  "frontend/scripts/media_panel_kpi_score.mjs"
  "frontend/tests/e2e/media-library-runtime.audit.js"
  "frontend/tests/e2e/media-panel-persistence.audit.js"
  "frontend/lib/mediaPerfTelemetry.ts"
)

echo "Checking required media-performance files..."
for rel_path in "${required_files[@]}"; do
  if [[ ! -f "${repo_root}/${rel_path}" ]]; then
    echo "Missing required file: ${rel_path}" >&2
    exit 1
  fi
done

echo "Checking Holomony indexes..."
grep -q 'docs/agents/holomony/README.md' "${repo_root}/docs/agents/README.md"
grep -q 'docs/agents/holomony/standard-operating-procedure.md' "${repo_root}/docs/agents/README.md"
grep -q 'docs/agents/holomony/ownership-manifest.md' "${repo_root}/docs/agents/README.md"
grep -q 'docs/agents/holomony/README.md' "${repo_root}/docs/README.md"
grep -q 'docs/agents/holomony/standard-operating-procedure.md' "${repo_root}/docs/README.md"
grep -q 'docs/agents/holomony/ownership-manifest.md' "${repo_root}/docs/README.md"

echo "Running docs validation..."
(
  cd "${repo_root}"
  node scripts/check_docs_links.js
  node scripts/check_docs_semantic_drift.js
)

echo "Holomony media performance audit passed."
