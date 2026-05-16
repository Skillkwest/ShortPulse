# Bopper Evidence Manifest

Purpose: keep the run packet self-contained by naming what evidence exists and what each artifact proves.

## Run

- Date: 2026-05-15
- Task: Bopper retest of dashboard New Project path, fallback to auth to dashboard if signed-in path is unavailable

## Expected Artifacts

- UI screenshots:
  - `auth-gate.png`
- Runtime/network captures:
  - none
- Console captures:
  - none
- Any copied API payloads or IDs:
  - `observed-path.txt`
  - `auth-gate-dom-snapshot.txt`

## Artifact Notes

- What each artifact proves:
  - `auth-gate.png`: Bopper reached the auth stop point through the visible public-entry path.
  - `auth-gate-dom-snapshot.txt`: visible auth labels and disabled `Sign in` state at the credential boundary.
  - `observed-path.txt`: compact step trace from public dashboard to pricing detour to auth gate.
- Missing evidence to capture before closeout:
  - a saved pricing-page screenshot would make the packet more visually complete
