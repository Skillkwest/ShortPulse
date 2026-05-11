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
      "Captures the retained prep packet, probe, and browser/runtime baseline before deeper browse-path changes.",
    commands: [
      "npm run media:phase0",
      "npm run test:e2e:media-library-runtime",
    ],
    doneHint:
      "Done when at least one retained baseline packet exists for route, panel, and derivative health comparison.",
  },
  "preview-authority": {
    title: "Preview Authority",
    description:
      "Use after the count checkpoint to simplify which layer decides the preview URL for visible media rows.",
    commands: [
      "npm test -- tests/api/media-list.test.ts",
      "npm test -- features/ai-studio/hooks/__tests__/useMediaLibraryPanelDataController.test.tsx",
    ],
    doneHint:
      "Done when the normal browse path is closer to list -> authoritative preview fields -> sign/render.",
  },
  "panel-runtime-churn": {
    title: "Panel Runtime Churn",
    description:
      "Validates panel controller/runtime reductions so refreshes, append loads, and signed-url updates avoid redundant row and state churn.",
    commands: [
      "npm test -- features/ai-studio/hooks/__tests__/useMediaLibraryPanelDataController.test.tsx",
      "npm test -- features/media-library/runtime/__tests__/store.test.ts",
      "npm test -- features/media-library/runtime/__tests__/useMediaLibraryPanelRuntime.test.ts",
      "npm test -- features/ai-studio/components/__tests__/MediaLibraryPanel.test.tsx --testNamePattern=\"auto-loads the next media page when scrolling near the bottom|auto-loads the next prompt page when scrolling near the bottom on Prompts tab|switches All Media root tabs between mixed media, image-only, video-only, and prompts|passes panel-specific preview resolver callback to media grid|opens preview modal on all-media media double-click without ingest side effects|drops internal references into the active custom folder and refreshes its rows\"",
    ],
    doneHint:
      "Done when panel refresh, append, and signed-preview paths validate without broad panel-suite noise and without redundant runtime row churn.",
  },
  "route-runtime-churn": {
    title: "Route Runtime Churn",
    description:
      "Validates route runtime reductions so media-tab cache updates and prompt/media selectors avoid unnecessary shared-runtime churn.",
    commands: [
      "npm test -- features/media-library/runtime/__tests__/store.test.ts",
      "npm test -- features/media-library/runtime/__tests__/useMediaLibraryRouteRuntime.test.ts",
    ],
    doneHint:
      "Done when route runtime cache updates batch cleanly and route prompt/media selectors stay stable under unrelated runtime changes.",
  },
};

const normalizeString = (value) => (typeof value === "string" ? value.trim() : "");

export const getCheckpoint = (checkpointId) => {
  const normalized = normalizeString(checkpointId).toLowerCase();
  return normalized ? CHECKPOINTS[normalized] ?? null : null;
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
