# Production Capture Template

Purpose: use only if the resolved composer image model regresses again.

## When To Use This

Use this template only when:

- internal drags fail in production again,
- desktop file drops and internal drags diverge,
- or the composer staging lifecycle contradicts the current resolved model.

## First Questions

1. Does the issue happen for Reference Grid / Quick Slot / Media Library drags?
2. Does the same image work when dragged from the desktop?
3. Does the composer show `preparing`, then `ready`, or does it fail before either state settles?

## Minimum Useful Capture

- source surface
- transfer types
- whether structured/internal/reference payloads were present
- whether `DataTransfer.files` was also present
- staged attachment snapshot while `preparing`
- staged attachment snapshot after it becomes `ready` or fails
- final rendered `img.src` if relevant
- `window.__shortpulseCreateWorkflowDebug.getDiagnosis()` output only if runtime evidence is still needed

## Interpretation Rule

If internal drags fail while desktop file drops work, treat source classification as the primary suspect before expanding preview or persistence theories.
