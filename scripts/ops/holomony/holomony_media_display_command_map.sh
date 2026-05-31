#!/usr/bin/env bash
# Purpose: verify and print Holomony's media-display/grid/detail-modal owner map.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../../.." && pwd)"

required_files=(
  "docs/agents/holomony/media-display-command-index.md"
  "docs/agents/holomony/media-display-authority-ledger.md"
  "docs/agents/holomony/right-rail-command-index.md"
  "frontend/features/ai-studio/components/DetailModal.tsx"
  "frontend/features/ai-studio/hooks/useAiStudioReferenceGridProps.ts"
  "frontend/features/ai-studio/reference-grid/components/ReferenceGridCard.tsx"
  "frontend/features/ai-studio/components/media-library-modal/MediaLibraryPanelPreviewModal.tsx"
  "frontend/features/ai-studio/hooks/useMediaLibraryPanelSelectionController.ts"
  "frontend/features/ai-studio/components/media-library-modal/MediaLibraryMediaGrid.tsx"
  "frontend/features/ai-studio/components/media-library-modal/MediaLibraryAllItemsGrid.tsx"
  "frontend/features/ai-studio/components/MediaLibraryPanel.tsx"
  "frontend/features/ai-studio/components/EmbeddedMediaLibraryPanel.tsx"
  "frontend/features/ai-studio/components/ElementsEmbeddedMediaLibraryPanel.tsx"
  "frontend/features/elements-manager/components/ElementsPanelSplitHost.tsx"
  "frontend/features/character-manager/components/CharacterEmbeddedMediaLibraryPanel.tsx"
  "frontend/features/character-manager/components/CharacterPanelSplitHost.tsx"
  "frontend/features/media-library/hooks/useMediaSurfacePreviewRuntime.ts"
  "frontend/features/media-library/hooks/useMediaSurfacePreviewSigning.ts"
  "frontend/features/media-library/hooks/useMediaMasonryVirtualization.ts"
  "frontend/features/media-library/hooks/useMediaGridVideoBudgetController.ts"
  "frontend/lib/mediaPreviewTrustPolicy.ts"
)

missing=0
for rel_path in "${required_files[@]}"; do
  if [[ ! -f "${repo_root}/${rel_path}" ]]; then
    echo "Missing media-display command file: ${rel_path}" >&2
    missing=1
  fi
done

if [[ "${missing}" -ne 0 ]]; then
  exit 1
fi

echo "Holomony media-display command files are present."
echo
echo "Modal authorities:"
echo "- AI Studio DetailModal: StudioOutput/reference output media authority and full-quality promotion"
echo "- MediaLibraryPanelPreviewModal: AI Studio/Elements/Character media-grid double-click previews"
echo
echo "Owned grids/carriages:"
echo "- Reference Grid and Quick Slot: ReferenceGrid, ReferenceGridCard, resolved-media/preview/runtime controllers"
echo "- AI Studio Media panel: MediaLibraryPanel plus shared MediaLibraryMediaGrid/MediaLibraryAllItemsGrid"
echo "- Elements carriage: ElementsPanelSplitHost -> ElementsEmbeddedMediaLibraryPanel -> EmbeddedMediaLibraryPanel"
echo "- Character carriage: CharacterPanelSplitHost -> CharacterEmbeddedMediaLibraryPanel -> EmbeddedMediaLibraryPanel"
echo
echo "Regression traps to keep in view:"
echo "- no Supabase /storage/v1/render/image/ runtime display authority"
echo "- no createSignedUrl transform options"
echo "- no /_next/image as full-quality modal image authority"
echo "- no browser broken-image icons as normal media UI"
echo "- no duplicated per-surface media resolvers when shared runtime owns the behavior"
echo
echo "Suggested proof commands:"
echo "- npm run test -- DetailModal DetailModal.fullQuality"
echo "- npm run test -- MediaLibraryPanelPreviewModal MediaLibraryMediaGrid MediaLibraryAllItemsGrid"
echo "- npm run test -- MediaLibraryPanel"
echo "- npm run test -- ElementsPanelSplitHost CharacterPanelSplitHost CharacterEmbeddedMediaLibraryPanel"
echo "- npm run test -- useMediaLibraryPanelRuntime useMediaLibraryPanelDataController"
echo "- npm run test:adaptive-media-runtime"
echo
echo "This helper proves owner-path presence, not runtime health."
