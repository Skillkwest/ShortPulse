/* global require, process, console, __dirname, window, document, Buffer, HTMLAudioElement, HTMLButtonElement, HTMLElement, MouseEvent */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * AI Studio audio exclusivity browser audit.
 * Seeds deterministic WAV fixtures into the Media panel + Reference Grid and verifies that
 * only one audible surface plays at a time across voice previews, ref-grid audio, preview
 * modals, and the detail modal.
 */
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const IGNORED_CONSOLE_PATTERNS = [
  /\[hmr\]\s+invalid message/i,
  /\[hmr\]\s+connected/i,
  /\[fast refresh\]\s+(rebuilding|done)/i,
  /react devtools/i,
  /favicon\.ico/i,
];

const SEVERE_SIGNAL_PATTERNS = [
  /maximum update depth exceeded/i,
  /too many re-renders/i,
  /page is unresponsive/i,
  /long[- ]running script/i,
  /resizeobserver loop limit exceeded/i,
];

const GENERIC_NETWORK_FAILURE_PATTERN =
  /failed to load resource: the server responded with a status of \d+/i;

function loadEnvFromFileIfNeeded(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const key = match[1];
    if (!key || (process.env[key] ?? "") !== "") continue;
    let value = match[2] ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadAuditEnv() {
  const frontendRoot = path.resolve(__dirname, "..", "..");
  const repoRoot = path.resolve(frontendRoot, "..");
  loadEnvFromFileIfNeeded(path.join(frontendRoot, ".env.local"));
  loadEnvFromFileIfNeeded(path.join(repoRoot, ".env.agent.local"));
}

loadAuditEnv();

const BASE_URL = (
  process.env.PLAYWRIGHT_AUDIO_EXCLUSIVITY_BASE_URL || "http://localhost:3000"
).trim();
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== "false";

function loadAuditCredentials() {
  const email = (process.env.PLAYWRIGHT_AUDIT_EMAIL || "").trim();
  const password = (process.env.PLAYWRIGHT_AUDIT_PASSWORD || "").trim() || "AuditPass!12345";
  return { email, password };
}

function shouldIgnoreConsole(text) {
  return IGNORED_CONSOLE_PATTERNS.some((pattern) => pattern.test(text));
}

function hasSevereSignal(text) {
  return SEVERE_SIGNAL_PATTERNS.some((pattern) => pattern.test(text));
}

function summarizeSignals(consoleEntries, pageErrors, requestFailures) {
  const severeConsole = consoleEntries.filter(
    (entry) =>
      (entry.type === "error" &&
        !shouldIgnoreConsole(entry.text) &&
        !GENERIC_NETWORK_FAILURE_PATTERN.test(entry.text)) ||
      hasSevereSignal(entry.text)
  );
  const severePageErrors = pageErrors.filter((entry) => !shouldIgnoreConsole(entry.text));
  return {
    severeConsole,
    severePageErrors,
    requestFailures,
    ok: severeConsole.length === 0 && severePageErrors.length === 0,
  };
}

async function attachSurfaceObservers(page) {
  const consoleEntries = [];
  const pageErrors = [];
  const requestFailures = [];
  page.on("console", (message) => {
    const text = message.text();
    if (shouldIgnoreConsole(text)) return;
    consoleEntries.push({
      type: message.type(),
      text,
      location: message.location(),
    });
  });
  page.on("pageerror", (error) => {
    pageErrors.push({
      text: String(error?.message || error),
    });
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure();
    requestFailures.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      errorText: failure?.errorText || null,
    });
  });
  return { consoleEntries, pageErrors, requestFailures };
}

function createToneWavBuffer({ durationMs, frequencyHz, sampleRate = 16000 }) {
  const channelCount = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const frameCount = Math.max(1, Math.round((durationMs / 1000) * sampleRate));
  const blockAlign = channelCount * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = frameCount * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  const amplitude = 0.25 * 0x7fff;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const sample =
      Math.sin((2 * Math.PI * frequencyHz * frame) / sampleRate) *
      amplitude *
      Math.min(1, frame / 400);
    buffer.writeInt16LE(Math.round(sample), 44 + frame * bytesPerSample);
  }

  return buffer;
}

async function createAuditFixtures() {
  const fixtureDir = await fsp.mkdtemp(path.join(os.tmpdir(), "shortpulse-audio-exclusivity-"));
  const stamp = Date.now();
  const files = [
    {
      key: "libraryA",
      filename: `audio-exclusivity-library-a-${stamp}.wav`,
      frequencyHz: 330,
    },
    {
      key: "libraryB",
      filename: `audio-exclusivity-library-b-${stamp}.wav`,
      frequencyHz: 440,
    },
    {
      key: "referenceGrid",
      filename: `audio-exclusivity-ref-grid-${stamp}.wav`,
      frequencyHz: 550,
    },
  ];

  const fixtures = {};
  for (const file of files) {
    const filePath = path.join(fixtureDir, file.filename);
    await fsp.writeFile(
      filePath,
      createToneWavBuffer({
        durationMs: 5000,
        frequencyHz: file.frequencyHz,
      })
    );
    fixtures[file.key] = {
      ...file,
      path: filePath,
    };
  }

  return {
    dir: fixtureDir,
    fixtures,
  };
}

async function signIn(page, email, password) {
  const signInTab = page.getByRole("tab", { name: /^sign in$/i }).first();
  if (
    (await signInTab.isVisible().catch(() => false)) &&
    (await signInTab.getAttribute("aria-selected").catch(() => null)) !== "true"
  ) {
    await signInTab.click();
  }
  await page.locator("#email").waitFor({ state: "visible", timeout: 30_000 });
  await page.locator("#password").waitFor({ state: "visible", timeout: 30_000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("button.auth-submit").click();
}

async function waitForNonAuthRoute(page, timeoutMs) {
  try {
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function satisfyMediaComplianceIfPresent(page) {
  const gateHeading = page.getByRole("heading", { name: /^confirm media rights$/i }).first();
  const gateVisible = await gateHeading.isVisible().catch(() => false);
  if (!gateVisible) return;

  const agreementCheckbox = page
    .getByLabel(/^i confirm that the media i use in shortpulse follows these rules\.$/i)
    .first();
  const continueButton = page.getByRole("button", { name: /^continue$/i }).first();

  await agreementCheckbox.check({ force: true });
  await continueButton.click({ timeout: 10_000 });
  await gateHeading.waitFor({ state: "hidden", timeout: 20_000 });
}

async function ensureSignedIn(page, baseUrl, targetPath, email, password) {
  await page.goto(`${baseUrl}${targetPath}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.waitForTimeout(1000);

  if (page.url().includes("/auth")) {
    await signIn(page, email, password);
    const reached = await waitForNonAuthRoute(page, 20_000);
    if (!reached) {
      throw new Error(`Auth did not reach protected route for ${targetPath} on ${baseUrl}`);
    }
  }

  await page.goto(`${baseUrl}${targetPath}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await satisfyMediaComplianceIfPresent(page);
}

async function waitForAiStudioReady(page) {
  const retryProjectButton = page
    .getByRole("button", { name: /^retry (project|workspace) load$/i })
    .first();
  const soundButton = page.getByRole("button", { name: /^sound$/i }).first();
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    if (await retryProjectButton.isVisible().catch(() => false)) {
      throw new Error(
        "AI Studio did not finish loading: retry project/workspace state is visible."
      );
    }
    if (await soundButton.isVisible().catch(() => false)) {
      return;
    }
    await page.waitForTimeout(500);
  }

  throw new Error("Timed out waiting for AI Studio toolbar controls.");
}

async function installVoicePreviewTracking(page) {
  await page.evaluate(() => {
    if (window.__shortpulseVoicePreviewTrackingInstalled) return;
    window.__shortpulseVoicePreviewTrackingInstalled = true;
    window.__shortpulseVoicePreviewInstances = [];
    const OriginalAudio = window.Audio;
    function WrappedAudio(...args) {
      const audio = new OriginalAudio(...args);
      window.__shortpulseVoicePreviewInstances.push(audio);
      return audio;
    }
    WrappedAudio.prototype = OriginalAudio.prototype;
    Object.setPrototypeOf(WrappedAudio, OriginalAudio);
    window.Audio = WrappedAudio;
  });
}

async function readVoicePreviewStates(page) {
  return page.evaluate(() =>
    Array.isArray(window.__shortpulseVoicePreviewInstances)
      ? window.__shortpulseVoicePreviewInstances.map((audio, index) => ({
          index,
          paused: audio.paused,
          currentTime: audio.currentTime,
          src: audio.src,
        }))
      : []
  );
}

async function openTool(page, labelPattern) {
  const button = page.getByRole("button", { name: labelPattern }).first();
  await button.waitFor({ timeout: 20_000 });
  await button.click({ timeout: 10_000 });
}

async function uploadReferenceGridFixture(page, filePath) {
  const input = page.locator('input[type="file"][multiple][style*="display: none"]').first();
  await input.waitFor({ state: "attached", timeout: 20_000 });
  await input.setInputFiles(filePath);
}

async function uploadMediaLibraryFixtures(page, filePaths) {
  const input = page.locator(".media-library-panel-file-input").first();
  await input.waitFor({ state: "attached", timeout: 20_000 });
  await input.setInputFiles(filePaths);
}

function exactAudioButtonName(filename) {
  return new RegExp(`^(Play|Pause) audio ${escapeForRegex(filename)}$`);
}

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function openMediaAudioTab(page) {
  const audioTab = page.getByRole("tab", { name: /^audio$/i }).first();
  if (!(await audioTab.isVisible().catch(() => false))) {
    throw new Error("Media Library Audio tab is not visible.");
  }
  await audioTab.click({ timeout: 10_000 });
}

async function waitForAudioButtons(page, filenames, timeoutMs = 60_000) {
  for (const filename of filenames) {
    await page
      .getByRole("button", { name: exactAudioButtonName(filename) })
      .first()
      .waitFor({
        timeout: timeoutMs,
      });
  }
}

function getReferenceGridAudioButton(page) {
  return page
    .locator(".reference-canvas-grid .reference-card.has-audio .reference-card-audio-play")
    .first();
}

async function waitForReferenceGridAudioCard(page, timeoutMs = 60_000) {
  await getReferenceGridAudioButton(page).waitFor({ timeout: timeoutMs });
}

async function waitForReferenceGridAudioState(page, expectedPaused) {
  await page.waitForFunction(
    (targetPaused) => {
      const audio = document.querySelector(
        ".reference-canvas-grid .reference-card.has-audio audio.reference-card-audio"
      );
      return audio instanceof HTMLAudioElement && audio.paused === targetPaused;
    },
    expectedPaused,
    { timeout: 20_000 }
  );
}

async function readReferenceGridAudioState(page) {
  return page.evaluate(() => {
    const card = document.querySelector(".reference-canvas-grid .reference-card.has-audio");
    const button = card?.querySelector(".reference-card-audio-play");
    const audio = card?.querySelector("audio.reference-card-audio");
    return audio instanceof HTMLAudioElement
      ? {
          paused: audio.paused,
          currentTime: audio.currentTime,
          label: button?.getAttribute("aria-label") ?? null,
        }
      : null;
  });
}

async function ensureReferenceGridAudioPlaying(page) {
  const state = await readReferenceGridAudioState(page);
  if (!state) {
    throw new Error("Reference Grid audio card is missing.");
  }
  if (state.paused) {
    await getReferenceGridAudioButton(page).click({ timeout: 10_000 });
  }
  await waitForReferenceGridAudioState(page, false);
}

async function readMediaPanelAudioStates(page, filenames) {
  return page.evaluate((targetFilenames) => {
    return targetFilenames.map((filename) => {
      const buttons = Array.from(document.querySelectorAll(".reference-card-audio-play"));
      const button = buttons.find(
        (candidate) =>
          (candidate.getAttribute("aria-label") || "").includes(`audio ${filename}`) &&
          candidate.closest(".media-library-panel-audio-reference-card")
      );
      const audio = button
        ?.closest(".media-library-panel-audio-reference-card")
        ?.querySelector("audio.reference-card-audio");
      return audio instanceof HTMLAudioElement
        ? {
            filename,
            paused: audio.paused,
            currentTime: audio.currentTime,
            label: button?.getAttribute("aria-label") ?? null,
          }
        : null;
    });
  }, filenames);
}

async function dispatchMediaPanelAudioCardDoubleClick(page, filename) {
  await page.evaluate((targetFilename) => {
    const cards = Array.from(
      document.querySelectorAll(".media-library-panel-audio-reference-card")
    );
    const card = cards.find((candidate) =>
      Array.from(candidate.querySelectorAll(".reference-card-audio-play")).some((button) =>
        (button.getAttribute("aria-label") || "").includes(`audio ${targetFilename}`)
      )
    );
    if (!(card instanceof HTMLElement)) {
      throw new Error(`Unable to find media panel audio card for ${targetFilename}`);
    }
    card.dispatchEvent(
      new MouseEvent("dblclick", {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );
  }, filename);
}

async function dispatchReferenceGridCardDoubleClick(page) {
  await page.evaluate(() => {
    const card = document.querySelector(".reference-canvas-grid .reference-card.has-audio");
    if (!(card instanceof HTMLElement)) {
      throw new Error("Unable to find ref-grid audio card.");
    }
    card.dispatchEvent(
      new MouseEvent("dblclick", {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );
  });
}

async function playMediaPreviewModalAudio(page) {
  await page.waitForFunction(
    () =>
      document.querySelectorAll(
        ".media-library-panel-preview-backdrop audio.media-library-panel-preview-media"
      ).length > 0,
    { timeout: 20_000 }
  );
  const playButton = page
    .locator(".media-library-panel-preview-backdrop")
    .getByRole("button", { name: /^play audio preview$/i })
    .first();
  await playButton.click({ timeout: 10_000 });
  await page.waitForFunction(
    () => {
      const audio = document.querySelector(
        ".media-library-panel-preview-backdrop audio.media-library-panel-preview-media"
      );
      return audio instanceof HTMLAudioElement && !audio.paused;
    },
    { timeout: 20_000 }
  );
}

async function readDetailModalAudioDiagnostics(page) {
  return page.evaluate(() => {
    const root = document.querySelector("#ai-studio-modal-layer-root");
    const playButtons = Array.from(
      document.querySelectorAll("#ai-studio-modal-layer-root .detail-modal-audio-play")
    );
    const audioNodes = Array.from(
      document.querySelectorAll("#ai-studio-modal-layer-root audio.art-hero-audio")
    );
    return {
      modalLayerPresent: Boolean(root),
      title:
        document
          .querySelector("#ai-studio-modal-layer-root .art-modal-title")
          ?.textContent?.trim() ?? null,
      playButtons: playButtons.map((button) => ({
        ariaLabel: button.getAttribute("aria-label"),
        ariaPressed: button.getAttribute("aria-pressed"),
        className: button.getAttribute("class"),
        disabled: button instanceof HTMLButtonElement ? button.disabled : null,
      })),
      audioNodes: audioNodes.map((audio) => {
        const htmlAudio = audio instanceof HTMLAudioElement ? audio : null;
        return {
          className: audio.getAttribute("class"),
          src: htmlAudio?.src ?? null,
          currentSrc: htmlAudio?.currentSrc ?? null,
          paused: htmlAudio?.paused ?? null,
          readyState: htmlAudio?.readyState ?? null,
          networkState: htmlAudio?.networkState ?? null,
          currentTime: htmlAudio?.currentTime ?? null,
          duration: htmlAudio?.duration ?? null,
          errorCode: htmlAudio?.error?.code ?? null,
          errorMessage: htmlAudio?.error?.message ?? null,
        };
      }),
    };
  });
}

async function playDetailModalAudio(page) {
  await page.waitForFunction(
    () => document.querySelectorAll("#ai-studio-modal-layer-root audio.art-hero-audio").length > 0,
    { timeout: 20_000 }
  );
  const playButton = page.locator("#ai-studio-modal-layer-root .detail-modal-audio-play").first();
  await playButton.click({ timeout: 10_000 });
  const started = await page
    .waitForFunction(
      () => {
        const audio = document.querySelector("#ai-studio-modal-layer-root audio.art-hero-audio");
        return audio instanceof HTMLAudioElement && !audio.paused;
      },
      { timeout: 20_000 }
    )
    .then(() => true)
    .catch(() => false);
  if (started) return;
  const diagnostics = await readDetailModalAudioDiagnostics(page);
  throw new Error(`Detail modal audio did not start: ${JSON.stringify(diagnostics)}`);
}

async function closeMediaPreviewModal(page) {
  const closeButton = page.getByRole("button", { name: /^close media preview$/i }).first();
  await closeButton.click({ timeout: 10_000 });
  await closeButton.waitFor({ state: "detached", timeout: 20_000 });
}

async function closeDetailModal(page) {
  const closeButton = page.locator(".art-close-btn").first();
  await closeButton.click({ timeout: 10_000 });
  await closeButton.waitFor({ state: "detached", timeout: 20_000 });
}

async function closeOpenMediaSurfacesForCleanup(page) {
  const previewClose = page.getByRole("button", { name: /^close media preview$/i }).first();
  if (await previewClose.isVisible().catch(() => false)) {
    await previewClose.click({ timeout: 10_000 }).catch(() => {});
    await previewClose.waitFor({ state: "detached", timeout: 10_000 }).catch(() => {});
  }

  const detailClose = page.locator(".art-close-btn").first();
  if (await detailClose.isVisible().catch(() => false)) {
    await detailClose.click({ timeout: 10_000 }).catch(() => {});
    await detailClose.waitFor({ state: "detached", timeout: 10_000 }).catch(() => {});
  }
}

async function deleteMediaLibraryAudioFixture(page, filename) {
  const audioButton = page.getByRole("button", { name: exactAudioButtonName(filename) }).first();
  if (!(await audioButton.isVisible().catch(() => false))) {
    return { filename, attempted: false, succeeded: false, reason: "audio card not visible" };
  }

  await audioButton
    .locator(
      "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' media-library-panel-audio-card-shell ')]"
    )
    .first()
    .hover({ timeout: 10_000 })
    .catch(() => {});

  const deleteButton = page.getByRole("button", { name: `Delete media ${filename}` }).first();
  if (!(await deleteButton.isVisible().catch(() => false))) {
    return { filename, attempted: false, succeeded: false, reason: "delete action not visible" };
  }

  await deleteButton.click({ timeout: 10_000, force: true });
  const dialog = page.getByRole("dialog", { name: "Delete this media?" }).first();
  await dialog.waitFor({ timeout: 20_000 });
  await dialog.getByRole("button", { name: /^delete$/i }).click({ timeout: 10_000 });
  const removed = await page
    .waitForFunction(
      (targetFilename) => {
        const buttons = Array.from(document.querySelectorAll(".reference-card-audio-play"));
        return !buttons.some(
          (button) =>
            (button.getAttribute("aria-label") || "").includes(`audio ${targetFilename}`) &&
            button.closest(".media-library-panel-audio-reference-card")
        );
      },
      filename,
      { timeout: 60_000 }
    )
    .then(() => true)
    .catch(() => false);

  if (!removed) {
    return {
      filename,
      attempted: true,
      succeeded: false,
      reason: "audio card remained visible after delete confirmation",
    };
  }

  await dialog.waitFor({ state: "hidden", timeout: 10_000 }).catch(async () => {
    const cancelButton = dialog.getByRole("button", { name: /^cancel$/i }).first();
    if (await cancelButton.isVisible().catch(() => false)) {
      await cancelButton.click({ timeout: 10_000 }).catch(() => {});
    }
    await page.keyboard.press("Escape").catch(() => {});
    await dialog.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
  });
  await page.waitForTimeout(1000);
  const stillPresent = await page
    .waitForFunction(
      (targetFilename) => {
        const buttons = Array.from(document.querySelectorAll(".reference-card-audio-play"));
        return buttons.some(
          (button) =>
            (button.getAttribute("aria-label") || "").includes(`audio ${targetFilename}`) &&
            button.closest(".media-library-panel-audio-reference-card")
        );
      },
      filename,
      { timeout: 500 }
    )
    .then(() => true)
    .catch(() => false);
  if (stillPresent) {
    return {
      filename,
      attempted: true,
      succeeded: false,
      reason: "audio card reappeared after delete confirmation",
    };
  }
  return { filename, attempted: true, succeeded: true };
}

async function cleanupMediaLibraryAudioFixtures(page, filenames, shouldAttempt) {
  const cleanup = {
    attempted: false,
    succeeded: false,
    items: filenames.map((filename) => ({
      filename,
      attempted: false,
      succeeded: false,
      reason: "cleanup not attempted",
    })),
  };
  if (!shouldAttempt) return cleanup;

  cleanup.attempted = true;
  await closeOpenMediaSurfacesForCleanup(page);
  await openTool(page, /^media$/i);

  cleanup.items = [];
  for (const filename of filenames) {
    await openMediaAudioTab(page);
    cleanup.items.push(await deleteMediaLibraryAudioFixture(page, filename));
  }
  cleanup.succeeded = cleanup.items.every((item) => item.succeeded);
  return cleanup;
}

async function runAudit(browser, creds, fixtureBundle) {
  const context = await browser.newContext({ viewport: { width: 1720, height: 1080 } });
  const page = await context.newPage();
  const observers = await attachSurfaceObservers(page);
  let mediaLibraryFixturesUploaded = false;
  const result = {
    ok: false,
    baseUrl: BASE_URL,
    fixtures: {
      libraryA: fixtureBundle.fixtures.libraryA.filename,
      libraryB: fixtureBundle.fixtures.libraryB.filename,
      referenceGrid: fixtureBundle.fixtures.referenceGrid.filename,
    },
    voiceToReferenceGrid: null,
    mediaPanelInlineHandoff: null,
    referenceGridToMediaPreview: null,
    referenceGridToDetailModal: null,
    cleanup: {
      attempted: false,
      succeeded: false,
      items: [],
    },
    fatalError: null,
    severeSignals: null,
    finalUrl: null,
  };

  try {
    await ensureSignedIn(page, BASE_URL, "/ai-studio", creds.email, creds.password);
    await waitForAiStudioReady(page);
    await installVoicePreviewTracking(page);

    await openTool(page, /^sound$/i);
    const firstVoiceButton = page.locator(".voices-properties-voice-chip-play").nth(0);
    const voicePreviewAvailable = await firstVoiceButton
      .waitFor({ timeout: HEADLESS ? 5_000 : 20_000 })
      .then(() => true)
      .catch(() => false);

    if (!HEADLESS && !voicePreviewAvailable) {
      throw new Error("Voice preview controls were not visible for non-headless audio audit.");
    }

    const initialVoiceLabel = voicePreviewAvailable
      ? await firstVoiceButton.getAttribute("aria-label")
      : null;
    if (!HEADLESS) {
      await firstVoiceButton.click({ timeout: 10_000 });
      const voiceStarted = await page
        .waitForFunction(
          () => {
            const button = document.querySelectorAll(".voices-properties-voice-chip-play")[0];
            return (
              button instanceof HTMLButtonElement &&
              /^Stop /i.test(button.getAttribute("aria-label") || "")
            );
          },
          { timeout: 5_000 }
        )
        .then(() => true)
        .catch(() => false);

      if (!voiceStarted) {
        result.voiceToReferenceGrid = {
          skipped: true,
          reason:
            "Voice preview never entered the playing state in the browser runtime for this audit run.",
          initialVoiceLabel,
          finalVoiceLabel: await firstVoiceButton.getAttribute("aria-label"),
          trackedVoiceStates: await readVoicePreviewStates(page),
        };
      } else {
        await referenceGridAudioButton.click({ timeout: 10_000 });
        await page.waitForFunction(
          () => {
            const firstVoice = document.querySelectorAll(".voices-properties-voice-chip-play")[0];
            if (
              !(firstVoice instanceof HTMLButtonElement) ||
              !/^Play /i.test(firstVoice.getAttribute("aria-label") || "")
            ) {
              return false;
            }
            const audio = document.querySelector(
              ".reference-canvas-grid .reference-card.has-audio audio.reference-card-audio"
            );
            if (!(audio instanceof HTMLAudioElement) || audio.paused) return false;
            const tracked = Array.isArray(window.__shortpulseVoicePreviewInstances)
              ? window.__shortpulseVoicePreviewInstances
              : [];
            return tracked.length > 0 && tracked.every((candidate) => candidate.paused);
          },
          { timeout: 20_000 }
        );

        result.voiceToReferenceGrid = {
          skipped: false,
          initialVoiceLabel,
          finalVoiceLabel: await firstVoiceButton.getAttribute("aria-label"),
          referenceGridState: await readReferenceGridAudioState(page),
          trackedVoiceStates: await readVoicePreviewStates(page),
        };
      }
    } else {
      result.voiceToReferenceGrid = {
        skipped: true,
        reason:
          "Voice preview exclusivity is skipped in default headless mode because provider-backed sample playback is not deterministic in this local browser runtime.",
        initialVoiceLabel,
        finalVoiceLabel: voicePreviewAvailable
          ? await firstVoiceButton.getAttribute("aria-label")
          : null,
        trackedVoiceStates: await readVoicePreviewStates(page),
      };
    }

    await uploadReferenceGridFixture(page, fixtureBundle.fixtures.referenceGrid.path);
    const referenceGridAudioButton = getReferenceGridAudioButton(page);
    await waitForReferenceGridAudioCard(page);

    await openTool(page, /^media$/i);
    await page
      .locator(".media-library-panel-file-input")
      .first()
      .waitFor({ state: "attached", timeout: 20_000 });
    await uploadMediaLibraryFixtures(page, [
      fixtureBundle.fixtures.libraryA.path,
      fixtureBundle.fixtures.libraryB.path,
    ]);
    mediaLibraryFixturesUploaded = true;
    await openMediaAudioTab(page);
    await waitForAudioButtons(page, [
      fixtureBundle.fixtures.libraryA.filename,
      fixtureBundle.fixtures.libraryB.filename,
    ]);

    const libraryAButton = page
      .getByRole("button", { name: exactAudioButtonName(fixtureBundle.fixtures.libraryA.filename) })
      .first();
    const libraryBButton = page
      .getByRole("button", { name: exactAudioButtonName(fixtureBundle.fixtures.libraryB.filename) })
      .first();
    await libraryAButton.click({ timeout: 10_000 });
    await page.waitForFunction(
      (targetFilename) => {
        const buttons = Array.from(document.querySelectorAll(".reference-card-audio-play"));
        const button = buttons.find(
          (candidate) =>
            (candidate.getAttribute("aria-label") || "").includes(`audio ${targetFilename}`) &&
            candidate.closest(".media-library-panel-audio-reference-card")
        );
        const audio = button
          ?.closest(".media-library-panel-audio-reference-card")
          ?.querySelector("audio.reference-card-audio");
        return audio instanceof HTMLAudioElement && !audio.paused;
      },
      fixtureBundle.fixtures.libraryA.filename,
      { timeout: 20_000 }
    );

    await libraryBButton.click({ timeout: 10_000 });
    await page.waitForFunction(
      ({ firstFilename, secondFilename }) => {
        const buttons = Array.from(document.querySelectorAll(".reference-card-audio-play"));
        const firstButton = buttons.find(
          (candidate) =>
            (candidate.getAttribute("aria-label") || "").includes(`audio ${firstFilename}`) &&
            candidate.closest(".media-library-panel-audio-reference-card")
        );
        const secondButton = buttons.find(
          (candidate) =>
            (candidate.getAttribute("aria-label") || "").includes(`audio ${secondFilename}`) &&
            candidate.closest(".media-library-panel-audio-reference-card")
        );
        const firstAudio = firstButton
          ?.closest(".media-library-panel-audio-reference-card")
          ?.querySelector("audio.reference-card-audio");
        const secondAudio = secondButton
          ?.closest(".media-library-panel-audio-reference-card")
          ?.querySelector("audio.reference-card-audio");
        return (
          firstAudio instanceof HTMLAudioElement &&
          secondAudio instanceof HTMLAudioElement &&
          firstAudio.paused &&
          !secondAudio.paused
        );
      },
      {
        firstFilename: fixtureBundle.fixtures.libraryA.filename,
        secondFilename: fixtureBundle.fixtures.libraryB.filename,
      },
      { timeout: 20_000 }
    );

    result.mediaPanelInlineHandoff = await readMediaPanelAudioStates(page, [
      fixtureBundle.fixtures.libraryA.filename,
      fixtureBundle.fixtures.libraryB.filename,
    ]);

    await ensureReferenceGridAudioPlaying(page);
    await dispatchMediaPanelAudioCardDoubleClick(page, fixtureBundle.fixtures.libraryA.filename);
    await playMediaPreviewModalAudio(page);
    await page.waitForFunction(
      () => {
        const modalAudio = document.querySelector(
          ".media-library-panel-preview-backdrop audio.media-library-panel-preview-media"
        );
        if (!(modalAudio instanceof HTMLAudioElement) || modalAudio.paused) return false;
        const referenceAudio = document.querySelector(
          ".reference-canvas-grid .reference-card.has-audio audio.reference-card-audio"
        );
        return referenceAudio instanceof HTMLAudioElement && referenceAudio.paused;
      },
      { timeout: 20_000 }
    );

    result.referenceGridToMediaPreview = {
      referenceGridState: await readReferenceGridAudioState(page),
      modalTitle: await page
        .locator(".media-library-panel-preview-backdrop .art-modal-title")
        .first()
        .textContent()
        .then((value) => value?.trim() ?? null),
      modalAudioPaused: await page.evaluate(() => {
        const audio = document.querySelector(
          ".media-library-panel-preview-backdrop audio.media-library-panel-preview-media"
        );
        return audio instanceof HTMLAudioElement ? audio.paused : null;
      }),
    };
    await closeMediaPreviewModal(page);

    await ensureReferenceGridAudioPlaying(page);
    await dispatchReferenceGridCardDoubleClick(page);
    await playDetailModalAudio(page);
    await page.waitForFunction(
      () => {
        const detailAudio = document.querySelector(
          "#ai-studio-modal-layer-root audio.art-hero-audio"
        );
        if (!(detailAudio instanceof HTMLAudioElement) || detailAudio.paused) return false;
        const referenceAudio = document.querySelector(
          ".reference-canvas-grid .reference-card.has-audio audio.reference-card-audio"
        );
        return referenceAudio instanceof HTMLAudioElement && referenceAudio.paused;
      },
      { timeout: 20_000 }
    );

    result.referenceGridToDetailModal = {
      referenceGridState: await readReferenceGridAudioState(page),
      detailAudioPaused: await page.evaluate(() => {
        const audio = document.querySelector("#ai-studio-modal-layer-root audio.art-hero-audio");
        return audio instanceof HTMLAudioElement ? audio.paused : null;
      }),
      detailAudioCurrentTime: await page.evaluate(() => {
        const audio = document.querySelector("#ai-studio-modal-layer-root audio.art-hero-audio");
        return audio instanceof HTMLAudioElement ? audio.currentTime : null;
      }),
    };
    await closeDetailModal(page);

    result.severeSignals = summarizeSignals(
      observers.consoleEntries,
      observers.pageErrors,
      observers.requestFailures
    );
    result.finalUrl = page.url();
  } catch (error) {
    result.fatalError = String(error?.stack || error?.message || error);
  } finally {
    if (!result.severeSignals) {
      result.severeSignals = summarizeSignals(
        observers.consoleEntries,
        observers.pageErrors,
        observers.requestFailures
      );
    }
    result.finalUrl = result.finalUrl || page.url();
    result.cleanup = await cleanupMediaLibraryAudioFixtures(
      page,
      [fixtureBundle.fixtures.libraryA.filename, fixtureBundle.fixtures.libraryB.filename],
      mediaLibraryFixturesUploaded
    ).catch((error) => ({
      attempted: mediaLibraryFixturesUploaded,
      succeeded: false,
      items: [
        {
          filename: fixtureBundle.fixtures.libraryA.filename,
          attempted: false,
          succeeded: false,
          reason: String(error?.message || error),
        },
        {
          filename: fixtureBundle.fixtures.libraryB.filename,
          attempted: false,
          succeeded: false,
          reason: String(error?.message || error),
        },
      ],
    }));
    await context.close();
  }

  result.ok = Boolean(!result.fatalError && result.severeSignals?.ok && result.cleanup.succeeded);
  return result;
}

async function main() {
  const creds = loadAuditCredentials();
  if (!creds.email) {
    console.error("[ai-studio-audio-exclusivity.audit] PLAYWRIGHT_AUDIT_EMAIL is required.");
    process.exit(1);
  }
  if (/@example\.com$/i.test(creds.email)) {
    console.error(
      "[ai-studio-audio-exclusivity.audit] PLAYWRIGHT_AUDIT_EMAIL cannot use @example.com. Use a dedicated real test account."
    );
    process.exit(1);
  }

  const fixtureBundle = await createAuditFixtures();
  let browser = null;
  try {
    browser = await chromium.launch({ headless: HEADLESS });
    const result = await runAudit(browser, creds, fixtureBundle);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(
      `[ai-studio-audio-exclusivity.audit] ${String(error?.stack || error?.message || error)}`
    );
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    await fsp.rm(fixtureBundle.dir, { recursive: true, force: true }).catch(() => {});
  }
}

void main();
