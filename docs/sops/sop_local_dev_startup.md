# SOP: Local ShortPulse Startup

## Scope

Use this runbook when the user asks to start or run ShortPulse locally, especially in the Codex desktop Windows environment.

Trigger phrases include:

- `start pulse`
- `run pulse`
- `start the app`
- `run the app`
- `launch ShortPulse`

## Success target

- ShortPulse responds at `http://127.0.0.1:3000/`.
- The app is launched through the repo-owned portable runtime path instead of the machine `PATH`.

## Required launcher

From repo root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start_pulse_local.ps1
```

## Why this launcher exists

This workspace has hit repeated Windows-local failures when startup depended on shell `PATH` state, `npm run dev:next`, or the machine `node` alias. The launcher avoids those problems by:

- downloading a portable Node runtime into the repo when needed
- using that runtime directly instead of `node` from `PATH`
- installing frontend dependencies when they are missing
- starting Next.js directly on port `3000`
- reusing an already-healthy ShortPulse server on `3000` when present

## Workflow

1. Run `scripts/start_pulse_local.ps1` from repo root.
2. Wait for the launcher to report either:
   - the existing ShortPulse server is already healthy on port `3000`, or
   - a fresh ShortPulse dev server has started successfully
3. Verify `http://127.0.0.1:3000/` returns a healthy response.

## Port handling

- Port `3000` is the default and required local target for this repo contract.
- If port `3000` is already owned by the same ShortPulse repo and the app is healthy, reuse it.
- If port `3000` is owned by the same ShortPulse repo but unhealthy, the launcher may replace that stale server.
- If port `3000` is owned by an unrelated process, do not kill it silently. Surface that conflict to the user.

## Do not do this first

- Do not start with raw `npm run dev`.
- Do not start with raw `npm run dev:next`.
- Do not assume `node` or `npm` on the machine `PATH` are usable.
- Do not paste or execute raw `PATH` strings inside PowerShell.

## Troubleshooting

- Missing dependencies:
  The launcher installs them automatically when `frontend/node_modules/next/dist/bin/next` is missing.

- Missing Node:
  The launcher downloads `node-v22.18.0-win-x64.zip` from the official Node.js distribution and expands it under repo root.

- Unrelated process already on `3000`:
  Stop and report the conflict instead of force-killing the process.

- Browser still shows an old failure:
  Reload `http://127.0.0.1:3000/` after the launcher reports success.
