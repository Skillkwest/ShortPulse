#!/usr/bin/env bash
# Purpose: lightweight inventory helper for Gutan's image-admission surfaces.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

echo "Gutan image admission inventory"
echo "repo: $ROOT_DIR"
echo

echo "Required Gutan files"
for path in \
  "docs/agents/gutan/README.md" \
  "docs/agents/gutan/AGENTS.md" \
  "docs/agents/gutan/standard-operating-procedure.md" \
  "docs/agents/gutan/ownership-manifest.md" \
  "docs/agents/gutan/memory.md" \
  "docs/records/artifacts/agent/gutan/README.md" \
  "docs/records/artifacts/agent/gutan/image-admission-surface-inventory.md" \
  "docs/records/artifacts/agent/gutan/image-admission-policy.md" \
  "docs/records/artifacts/agent/gutan/image-admission-implementation-plan.md" \
  "docs/records/artifacts/agent/gutan/tools.md" \
  "docs/records/artifacts/agent/gutan/training-history.md"; do
  if [[ -f "$path" ]]; then
    echo "ok $path"
  else
    echo "missing $path"
  fi
done

echo
echo "Image admission policy and size-limit references"
rg -n \
  "MAX_IMAGE_MEDIA_BYTES|CANONICAL_IMAGE_UPLOAD_MAX_BYTES|25 \\* 1024 \\* 1024|25MB|25 MB|maybeNormalizeOversizedImageUpload|localTranscode|prepare-upload|finalize-upload|prepare-reference-image-upload|stage-reference-image|copy-from-url" \
  frontend/lib frontend/features frontend/pages/api \
  --glob '!**/.next/**' \
  --glob '!**/node_modules/**' \
  --glob '!**/coverage/**' || true

echo
echo "Direct upload candidates near Gutan surfaces"
rg -n \
  "\\.storage\\.from\\(|upload\\(|FileReader|readAsDataURL|canvas\\.toBlob|createObjectURL" \
  frontend/features/character-manager frontend/features/elements-manager frontend/features/ai-studio frontend/lib/server frontend/lib/adaptive-media \
  --glob '!**/.next/**' \
  --glob '!**/node_modules/**' \
  --glob '!**/coverage/**' || true

echo
echo "Forbidden Supabase transformation sentinels"
rg -n \
  "createSignedUrl\\([^\\n]*transform|/storage/v1/render/image/|SUPABASE_RENDER_IMAGE_PATH" \
  frontend/lib frontend/features frontend/pages/api \
  --glob '!**/.next/**' \
  --glob '!**/node_modules/**' \
  --glob '!**/coverage/**' || true
