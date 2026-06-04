# Copperknot Handoffs

Purpose: store detailed execution packets for the active production-readiness window without pretending that every packet here is equally current.

## What This Folder Means

This folder contains a mix of:

- currently dispatchable packets
- ready-after-that packets
- historical packets kept for evidence and scope traceability within the active window

Do not infer exact next-work order from this folder listing alone.

## Current Dispatch-Ready Rule

The current authority chain decides whether a packet is truly live:

- exact order: `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`
- lane state: the current queue row plus the freshest retained verification, remeasurement, or closeout-review packet
- rationale for the current top call: the freshest retained verification or baseline packet

If a packet exists here but the current queue does not mark it exact next or actively dispatchable, treat the packet as retained scope history, not as a live dispatch instruction.

## Working Set Expectation

Copperknot should usually keep only a small active handoff set mentally loaded:

- the exact next packet
- at most one ready-after-that packet when it materially reduces future delay

Everything else in this folder should be treated as conditional reference, not routine startup load.

## Current Dispatch State

Use the current dated queue and freshest retained evidence packet for live lane state.

Older dispatch logs are historical traceability only and should not be loaded by default.

## Usage Rule

These handoffs should be treated as execution packets, not as brainstorming notes. An execution agent should be able to start from one of these packets, load the listed context, and act without repeating the full catalog audit.

## Copy/Paste Rule

These packets are intentionally flat and copy/paste ready.

When a packet is pasted into another agent:

- the receiving agent should treat the pasted handoff as the primary scope definition,
- keep the lane bounded to that packet,
- and close out with a concise result that is ready to archive once returned to the user.

## Closeout Intake Rule

Each execution lane should also create one closeout report for the Copperknot at:

- `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/`

Use the filename pattern:

- `YYYY-MM-DD-<lane-id>-closeout.md`

Use the reusable report format at:

- `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/template.md`

At minimum, the closeout should now record:

- systems touched
- acceptance criteria reached
- evidence snapshot
- validation evidence
- explicit recommended score effect

Those reports are intake artifacts for rerating and queue maintenance. They do not change the catalog on their own.

## Send To Catalog Phrase

If the user tells an execution agent `send this to the catalog`, the intended meaning is:

- write the closeout report into `external-lane-closeouts/`
- use the required filename pattern
- follow the required closeout template
- then tell the user the closeout filename, files changed, and final execution status
