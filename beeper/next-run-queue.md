# Beeper Next Run Queue

Purpose: keep the highest-value next testing lanes visible so Beeper spends less time choosing and more time running deeper real-user checks.

## Selection Rule

- Prefer the topmost lane unless the user redirects scope.
- Prefer deeper workflow completion over new process hardening when both are possible.
- Use `beeper/action-coverage/master-coverage-log.md` and the performance ledger before starting.
- Use `beeper/route-success-map.md` before starting so the lane is tied to a believable route-level outcome.
- Use `docs/records/artifacts/agent/beeper/retest-debt.md` before starting so open fix validations compete fairly with new exploration.
- Prefer lower-coverage routes over comfortable repeat routes unless a retest or blocker has higher ROI.

## Ranked Queue

### 1. Character route retest or deeper manage/create path

- Why this is next:
  - AI Studio just gained a validated success path, so lower-coverage routes should win next
  - Character coverage improved, but fresh-session resume now has an open engineering issue and the route still lacks clean reuse validation
- Entry surface:
  - production `/character`
- Success condition:
  - either confirm the bootstrap issue is gone
  - or validate a cleaner manage-list/create-save workflow than this checkpoint reached

### 2. Dashboard deeper control or announcement behavior

- Why this is next:
  - dashboard still has only shallow coverage outside launch-card entry and known CTA semantics
  - this is the cleanest lower-risk route if Character is blocked again
- Entry surface:
  - production `/dashboard`
- Success condition:
  - validate one deeper dashboard control beyond the launch cards
  - confirm whether announcement behavior is only copy friction or an actual workflow problem

### 3. Media Library post-fix or higher-risk workflow lane

- Why this is next:
  - Media Library now has stronger browse/search coverage
  - the next pass there should either retest the search-empty-state fix or validate a riskier workflow like detail/modal or bulk operations
- Entry surface:
  - production `/ai-studio` Media library panel or modal
- Success condition:
  - either confirm the empty-state fix or validate one deeper non-destructive workflow beyond search and single-item selection

### 4. AI Studio generate-path retest or broader library workflow

- Why this is next:
  - the route now has one validated success path, so AI Studio is no longer the top breadth gap
  - the next return there should be for retest debt or a clearly different deeper workflow
- Entry surface:
  - existing project in production AI Studio
- Success condition:
  - either confirm progress on the generate-path defect
  - or validate a broader non-generate library action than prompt persistence alone

## Current Training Focus

- Weakest scoring category: `coverage expansion`
- Main rule for the next run:
  - choose a low-coverage lane that validates one full user workflow and is likely to expose a trust-breaking user moment if one exists
