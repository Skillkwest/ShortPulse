# Phase 2 Evidence: Legacy Route Runtime Extraction

Date: 2026-02-21  
Program: AI Studio Agent Hardening + Modularization  
Phase: 2 (Strangler Consolidation)

## Scope
Extracted legacy route business logic into `agent-runtime` entrypoints while preserving route contracts and behavior.

## Changes Captured
1. Added runtime service entrypoint for prompt generation:
   - `frontend/features/agent-runtime/legacyPromptGenerationService.ts`
2. Added runtime service entrypoint for image describe:
   - `frontend/features/agent-runtime/legacyImageDescribeService.ts`
3. Converted legacy routes into thin HTTP wrappers:
   - `frontend/pages/api/ai/generate-prompt.ts`
   - `frontend/pages/api/ai/describe-image.ts`
4. Preserved compatibility behavior:
   - Same status codes
   - Same error envelope keys (`error`, optional `detail`, optional `model`)
   - Same successful payload shapes (`prompt|description`, `usage`)
   - Same deprecation/sunset/link headers via shared helper

## Verification Commands
```bash
npm -C frontend run test -- tests/api/generate-prompt.sanitization.test.ts tests/api/describe-image.route.test.ts tests/api/auth-guarded-ai-routes.test.ts
node scripts/check_architecture_boundaries.js
node scripts/check_size_budgets.js
node scripts/check_agent_contract_tests.js
node scripts/check_agent_disable_continuity.js
npm -C frontend run validate
npm -C frontend run docs:check
```

## Outcome
All listed checks passed.  
This extraction is behavior-preserving and prepares further consolidation without changing public contracts.
