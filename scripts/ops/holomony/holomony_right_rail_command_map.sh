#!/usr/bin/env bash
# Purpose: verify and print Holomony's compact AI Studio right-rail owner/test map.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../../.." && pwd)"

required_files=(
  "docs/agents/holomony/right-rail-command-index.md"
  "docs/agents/holomony/reference-grid-ownership-map.md"
  "docs/agents/holomony/reference-grid-diagnostic-sop.md"
  "frontend/features/ai-studio/components/AiStudioPageContent.tsx"
  "frontend/features/ai-studio/components/ReferenceGrid.tsx"
  "frontend/features/ai-studio/reference-grid/components/ReferenceGridSections.tsx"
  "frontend/features/ai-studio/reference-grid/controllers/useReferenceGridRuntimeScaffold.ts"
  "frontend/features/ai-studio/logic/panelVisibility.ts"
  "frontend/features/ai-studio/logic/referenceGridDropOwnership.ts"
  "frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts"
  "frontend/features/ai-studio/components/canvas/useAiStudioCanvasWorkspaceState.ts"
  "frontend/features/ai-studio/components/canvas/canvasWorkspaceContracts.ts"
  "frontend/features/ai-studio/components/canvas/canvasDropController.ts"
  "frontend/features/ai-studio/components/canvas/useCanvasViewportDropHandlers.ts"
  "frontend/features/ai-studio/logic/sessionSnapshotCanvas.ts"
  "frontend/features/ai-studio/hooks/useAiStudioPageProjectSessionRuntime.ts"
  "frontend/lib/ai-studio-session/projectWorkspaceSnapshot.ts"
)

missing=0
for rel_path in "${required_files[@]}"; do
  if [[ ! -f "${repo_root}/${rel_path}" ]]; then
    echo "Missing right-rail command file: ${rel_path}" >&2
    missing=1
  fi
done

if [[ "${missing}" -ne 0 ]]; then
  exit 1
fi

echo "Holomony right-rail command files are present."
echo
echo "Load ladder:"
echo "- Tier 0: AGENTS startup spine + Holomony AGENTS/memory + right-rail-command-index.md"
echo "- Tier 1: owner map/diagnostic SOP + exact owner code path before edits or decision-grade claims"
echo "- Tier 2: ADR/SOP authority docs only for contract disputes, launch claims, or stale-doc reconciliation"
echo
echo "Owner map:"
echo "- Visibility: AiStudioPageContent.tsx, panelVisibility.ts, AiStudioShellFrame.tsx"
echo "- Projection/Quick Slot: reference-projections/, reference-domain/, useReferenceGridOutputCollections"
echo "- URL authority: referenceGridMedia.ts, referenceOutputAuthority.ts, useReferenceGridResolvedMediaController"
echo "- Hydration/performance: preview runtime, hydration controllers, virtual metrics, card render controllers"
echo "- Intake/drop: referenceGridDropOwnership.ts, reference-ingestion/, drop controllers, shell DnD controller"
echo "- Canvas/drop/restore: canvas workspace state, drop handlers, sessionSnapshotCanvas, projectWorkspaceSnapshot"
echo
echo "Test map:"
echo "- Visibility: npm run test -- panelVisibility AiStudioPageContent"
echo "- Projection: npm run test -- referenceProjections referenceDomain useReferenceGridOutputCollections useReferenceGridOutputViewModels"
echo "- URL authority: npm run test -- referenceGridMedia referenceOutputAuthority mediaPreviewTrustPolicy useReferenceGridResolvedMediaController"
echo "- Hydration/loading: npm run test -- useReferenceGridPreviewRuntime useReferenceGridImageHydrationController useReferenceGridHydrationQueueController referenceGridCardVisualState ReferenceGridCard"
echo "- Performance: npm run test -- useReferenceGridViewportProjectionController useReferenceGridVirtualMetricsController useReferenceGridCardItemsController referenceGridPropsEquality"
echo "- Detail handoff: npm run test -- DetailModal"
echo "- Drop routing: npm run test -- useAiStudioShellDndController useReferenceGridDropController useReferenceGridCuratedDndController"
echo "- Canvas/drop/restore: npm run test -- canvas useAiStudioPageMediaReferenceRuntime useAiStudioPageProjectSessionRuntime"
echo
echo "This helper is an orientation and drift guard, not production health proof."
