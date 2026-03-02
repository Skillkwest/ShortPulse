# Phase 13 Wave F Pass 4: Policy-Version Telemetry Alignment

Date: 2026-03-02  
Status: Pass

## Scope
1. Extended `studio-agent` coordinator contract to accept runtime-resolved safety `policyVersion`.
2. Wired `/api/ai/studio-agent` to pass `resolveRuntimeSafetyProfile(...).policyVersion` into coordinator telemetry paths.
3. Preserved fallback behavior: if runtime profile resolution does not provide a numeric version, telemetry still derives version from profile-id suffix.
4. Added API regression coverage for control-plane profile versions that do not encode `_vN` in profile id strings.

## Validation Commands
1. `npm -C frontend run test -- --run tests/api/studio-agent.runtime.test.ts`
- Result: pass (`32/32` tests).
2. `npm -C frontend run type-check`
- Result: pass.
3. `npm -C frontend run lint`
- Result: pass with one pre-existing warning outside this slice (`frontend/features/character-manager/components/CharacterSheetPresetTabs.tsx`: `activeIndex` unused).
4. `npm -C frontend run build`
- Result: pass.
5. `npm -C frontend run docs:check`
- Result: pass.

## Gate Result
1. Wave F observability contract now emits authoritative `policy_version` values from control-plane runtime resolution.
2. Non-suffixed profile ids (for example `staging_lenient`) no longer emit null policy versions when a control-plane version is available.
3. Backward-compatible fallback behavior remains intact for env/fallback profile-only execution lanes.

## Rollback Readiness
1. Revert `studio-agent` coordinator + route patch if regression appears in telemetry consumer pipelines.
2. Fallback behavior remains bounded by existing profile-id parsing and does not affect policy decision enforcement.

## Residual Risk
1. This slice changes telemetry semantics only; policy enforcement logic is unchanged.
