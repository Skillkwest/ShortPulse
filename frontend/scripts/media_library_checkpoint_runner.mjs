#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const FRONTEND_ROOT = path.resolve(path.dirname(SCRIPT_FILE), "..");

const CHECKPOINTS = {
  "count-hot-path": {
    title: "Count Hot Path",
    description:
      "Validates the non-blocking panel count lane so first media paint is not blocked on exact library totals.",
    commands: [
      "npm test -- features/ai-studio/hooks/__tests__/useMediaLibraryPanelDataController.test.tsx",
      "npm test -- tests/api/media-list.test.ts",
    ],
    doneHint:
      "Done when the panel loads rows without synchronous count work and the count follows in a non-blocking lane.",
  },
  "phase0-baseline": {
    title: "Phase 0 Baseline",
    description:
      "Captures the retained prep packet, probe, and AI Studio media-surface baseline before deeper browse-path changes.",
    commands: ["npm run media:phase0", "npm run test:e2e:media-library-runtime"],
    doneHint:
      "Done when at least one retained baseline packet exists for the AI Studio panel/modal surfaces and derivative health comparison.",
  },
  "preview-authority": {
    title: "Preview Authority",
    description:
      "Use after the count checkpoint to simplify which layer decides the preview URL for visible AI Studio media rows.",
    commands: [
      'npm test -- tests/api/media-list.test.ts --testNamePattern="does not seed initial signed urls for the modal surface|seeds initial signed urls for the panel surface on the default mixed open|seeds initial signed urls for the elements panel surface on the default mixed open|supports panel mediaKind queries without tab|supports audio mediaKind queries without tab"',
      'npm test -- tests/api/media-resolve-previews.test.ts --testNamePattern="does not apply transforms by default when surface is media-library-panel|prefers trusted direct preview urls over storage lookup on browse surfaces|narrows browse-surface storage lookup to preferred and original candidates"',
      'npm test -- features/media-library/hooks/__tests__/useMediaPreviewSigningController.test.ts --testNamePattern="limits panel resolver escalation to visible unresolved rows|limits modal resolver escalation to visible unresolved rows|prefers durable direct preview urls over signing for panel rows|prefers durable direct preview urls over signing for modal rows|does not blind-prefetch beyond the initial slice before visibility is known|keeps dense panel-style signing bounded across initial open and load-more append|does not schedule deferred offscreen prefetch work for panel signing"',
      "npm test -- features/ai-studio/hooks/__tests__/useMediaLibraryPanelDataController.test.tsx",
    ],
    doneHint:
      "Done when the AI Studio media browse path is closer to list -> authoritative preview fields -> sign/render.",
  },
  "panel-runtime-churn": {
    title: "Panel Runtime Churn",
    description:
      "Validates panel controller/runtime reductions so refreshes, append loads, and signed-url updates avoid redundant row and state churn.",
    commands: [
      "npm test -- features/ai-studio/hooks/__tests__/useMediaLibraryPanelDataController.test.tsx",
      "npm test -- features/media-library/runtime/__tests__/store.test.ts",
      "npm test -- features/media-library/runtime/__tests__/useMediaLibraryPanelRuntime.test.ts",
      'npm test -- features/ai-studio/components/__tests__/MediaLibraryPanel.test.tsx --testNamePattern="auto-loads the next media page when scrolling near the bottom|auto-loads the next prompt page when scrolling near the bottom on Prompts tab|switches All Media root tabs between mixed media, image-only, video-only, and prompts|passes panel-specific preview resolver callback to media grid|opens preview modal on all-media media double-click without ingest side effects|drops internal references into the active custom folder and refreshes its rows"',
    ],
    doneHint:
      "Done when panel refresh, append, and signed-preview paths validate without broad panel-suite noise and without redundant runtime row churn.",
  },
  "deep-scroll-performance": {
    title: "Deep Scroll Performance",
    description:
      "Protects older-media browsing by validating cursor append order, aggregate runtime ordering, indexed virtualization windows, visible-scoped signing, and long-session media callback cleanup.",
    commands: [
      "npm test -- features/media-library/logic/__tests__/mediaLibraryPageHelpers.test.ts",
      "npm test -- features/ai-studio/hooks/__tests__/useMediaLibraryPanelDataController.test.tsx",
      "npm test -- features/media-library/runtime/__tests__/store.test.ts",
      "npm test -- features/media-library/runtime/__tests__/useMediaLibraryPanelRuntime.test.ts",
      "npm test -- features/media-library/logic/__tests__/mediaGridVirtualization.test.ts",
      "npm test -- features/media-library/logic/__tests__/mediaPreviewSigningPass.test.ts",
      "npm test -- features/media-library/hooks/__tests__/useMediaPreviewSigningController.test.ts",
      "npm run type-check:touched",
    ],
    doneHint:
      "Done when deep-scroll append, render-window, signing, and runtime-order tests pass; run npm run test:e2e:media-library-runtime separately when authenticated browser proof is required.",
  },
};

const normalizeString = (value) => (typeof value === "string" ? value.trim() : "");

export const getCheckpoint = (checkpointId) => {
  const normalized = normalizeString(checkpointId).toLowerCase();
  return normalized ? (CHECKPOINTS[normalized] ?? null) : null;
};

export const parseArgs = (argv) => {
  const readValue = (flag) => {
    const prefixed = `${flag}=`;
    for (let index = 0; index < argv.length; index += 1) {
      const token = argv[index];
      if (token === flag) return argv[index + 1] ?? "";
      if (token.startsWith(prefixed)) return token.slice(prefixed.length);
    }
    return "";
  };

  return {
    help: argv.includes("--help") || argv.includes("-h"),
    list: argv.includes("--list"),
    run: argv.includes("--run"),
    checkpoint: normalizeString(readValue("--checkpoint")).toLowerCase(),
  };
};

const usage = () => {
  process.stdout.write(
    [
      "Usage:",
      "  node frontend/scripts/media_library_checkpoint_runner.mjs [options]",
      "",
      "Options:",
      "  --list                     Show available checkpoints.",
      "  --checkpoint <id>         Show one checkpoint or run it with --run.",
      "  --run                      Execute the checkpoint command bundle.",
      "  --help                     Show this message.",
      "",
    ].join("\n")
  );
};

export const buildCheckpointSummary = (checkpointId, checkpoint) =>
  [
    `Checkpoint: ${checkpointId}`,
    `Title: ${checkpoint.title}`,
    `Description: ${checkpoint.description}`,
    "Commands:",
    ...checkpoint.commands.map((command) => `- ${command}`),
    `Done hint: ${checkpoint.doneHint}`,
  ].join("\n");

const listCheckpoints = () => {
  for (const [checkpointId, checkpoint] of Object.entries(CHECKPOINTS)) {
    process.stdout.write(`${buildCheckpointSummary(checkpointId, checkpoint)}\n\n`);
  }
};

const runCommand = (command) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd: FRONTEND_ROOT,
      shell: true,
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed with exit code ${code ?? 1}: ${command}`));
    });
    child.on("error", reject);
  });

const runCheckpoint = async (checkpointId, checkpoint) => {
  process.stdout.write(`${buildCheckpointSummary(checkpointId, checkpoint)}\n\n`);
  for (const command of checkpoint.commands) {
    await runCommand(command);
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  if (args.list || !args.checkpoint) {
    listCheckpoints();
    return;
  }

  const checkpoint = getCheckpoint(args.checkpoint);
  if (!checkpoint) {
    throw new Error(
      `Unknown checkpoint: ${args.checkpoint}. Expected one of ${Object.keys(CHECKPOINTS).join(", ")}.`
    );
  }

  if (!args.run) {
    process.stdout.write(`${buildCheckpointSummary(args.checkpoint, checkpoint)}\n`);
    return;
  }

  await runCheckpoint(args.checkpoint, checkpoint);
};

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === SCRIPT_FILE) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
