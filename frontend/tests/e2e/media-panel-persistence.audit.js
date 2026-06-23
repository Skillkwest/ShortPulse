/* global require, process, console, __dirname, HTMLImageElement, HTMLVideoElement, document, Buffer, window, fetch */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Media panel save/reopen persistence audit.
 * Uploads a real image fixture through the target media panel surface, verifies browse-ready
 * visibility, reloads and reopens the panel, verifies the same item again, then repeats the check
 * in a fresh signed-in browser context before deleting the audit fixture.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const PNG_BYTES = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 4, 0, 0,
  0, 181, 28, 12, 2, 0, 0, 0, 11, 73, 68, 65, 84, 120, 218, 99, 252, 255, 31, 0, 3, 3, 2, 0, 239,
  154, 236, 175, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);

const DEFAULT_BASE_URL = (
  process.env.PLAYWRIGHT_MEDIA_LIBRARY_BASE_URL || "http://localhost:3000"
).trim();
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== "false";
const CLEANUP_ONLY = process.env.PLAYWRIGHT_MEDIA_PANEL_CLEANUP_ONLY === "true";
const AUDIT_IMAGE_FILENAME_PREFIX = "holomony-save-browse-audit";
const AUDIT_VIDEO_FILENAME_PREFIX = "holomony-video-variant-audit";
const VIDEO_FIXTURE_SOURCE_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "public",
  "dashboard",
  "homepage-hero-background-lite.mp4"
);
const SUPPORTED_SURFACES = new Set(["ai-studio-panel", "elements-media-panel"]);

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function usage() {
  process.stdout.write(
    [
      "Usage:",
      "  node frontend/tests/e2e/media-panel-persistence.audit.js [options]",
      "",
      "Environment:",
      "  PLAYWRIGHT_AUDIT_EMAIL            Required real test account email",
      "  PLAYWRIGHT_AUDIT_PASSWORD         Optional password override",
      "  PLAYWRIGHT_MEDIA_LIBRARY_BASE_URL Default base URL (default http://localhost:3000)",
      "  PLAYWRIGHT_MEDIA_PANEL_SURFACE    Optional surface override (ai-studio-panel | elements-media-panel)",
      "  PLAYWRIGHT_MEDIA_PANEL_CLEANUP_ONLY Set to true to delete audit-owned fixtures without uploading",
      "  PLAYWRIGHT_HEADLESS               Set to false to watch the audit",
      "",
      "Options:",
      "  --surface <surface-id>            Choose ai-studio-panel or elements-media-panel",
      "",
      "Notes:",
      "  - Uses the real Media panel upload path.",
      "  - Deletes the audit fixture after the reopen checks finish.",
    ].join("\n")
  );
}

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
  loadEnvFromFileIfNeeded(path.join(frontendRoot, ".env.playwright.local"));
  loadEnvFromFileIfNeeded(path.join(repoRoot, ".env.agent.local"));
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  usage();
  process.exit(0);
}

loadAuditEnv();

function readSurfaceArg(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== "--surface") continue;
    return (argv[index + 1] || "").trim();
  }
  return "";
}

function loadAuditCredentials() {
  const email = (process.env.PLAYWRIGHT_AUDIT_EMAIL || "").trim();
  const password = (process.env.PLAYWRIGHT_AUDIT_PASSWORD || "").trim() || "AuditPass!12345";
  return { email, password };
}

async function signIn(page, email, password) {
  const signInTab = page.getByRole("tab", { name: /^sign in$/i }).first();
  if (
    (await signInTab.isVisible().catch(() => false)) &&
    (await signInTab.getAttribute("aria-selected").catch(() => null)) !== "true"
  ) {
    await signInTab.click();
  }
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
  await page.goto(`${baseUrl}/auth?next=${encodeURIComponent(targetPath)}`, {
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

async function readAccessToken(page) {
  return page.evaluate(() => {
    const keys = Object.keys(window.localStorage || {});
    for (const key of keys) {
      if (!/auth-token/i.test(key)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const candidates = [parsed, parsed?.currentSession, parsed?.session];
        for (const candidate of candidates) {
          if (candidate && typeof candidate.access_token === "string") {
            return candidate.access_token;
          }
        }
      } catch {
        continue;
      }
    }
    return null;
  });
}

async function apiRequest({ token, method, requestPath, body }) {
  const response = await fetch(`${DEFAULT_BASE_URL}${requestPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  return {
    ok: response.ok,
    status: response.status,
    contentType,
    payload,
    text,
  };
}

function summarizeApiResult(result) {
  const body = result.payload ? JSON.stringify(result.payload) : result.text.slice(0, 180);
  return `${result.status} ${result.contentType}: ${body}`;
}

function assertJsonApiResult(label, result, expectedStatus) {
  if (!result.contentType.toLowerCase().includes("application/json")) {
    throw new Error(`${label} returned non-JSON response: ${summarizeApiResult(result)}`);
  }
  if (typeof expectedStatus === "number" && result.status !== expectedStatus) {
    throw new Error(`${label} returned unexpected status: ${summarizeApiResult(result)}`);
  }
}

async function openAiStudioMediaPanel(page) {
  const panel = page.locator('section[aria-label="Media library panel"]').first();
  if (await panel.isVisible().catch(() => false)) return panel;

  const mediaButton = page.getByRole("button", { name: /^media$/i }).first();
  const expandPanelButton = page
    .getByRole("button", { name: /^expand media library panel$/i })
    .first();
  const retryProjectButton = page
    .getByRole("button", { name: /^retry (project|workspace) load$/i })
    .first();
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    if (await panel.isVisible().catch(() => false)) return panel;
    if (await retryProjectButton.isVisible().catch(() => false)) {
      throw new Error(
        "AI Studio did not finish loading: retry project/workspace state is visible."
      );
    }
    if (await expandPanelButton.isVisible().catch(() => false)) {
      await expandPanelButton.click({ timeout: 10_000 });
      await panel.waitFor({ timeout: 20_000 });
      return panel;
    }
    if (await mediaButton.isVisible().catch(() => false)) {
      await mediaButton.click({ timeout: 10_000 });
      await panel.waitFor({ timeout: 20_000 });
      return panel;
    }
    await page.waitForTimeout(500);
  }

  throw new Error("Timed out waiting for the AI Studio media panel to become ready.");
}

async function openElementsMediaPanel(page) {
  const panel = page.locator('section[aria-label="Elements media library panel"]').first();
  if (await panel.isVisible().catch(() => false)) return panel;

  const elementsHeading = page.getByRole("heading", { name: "Elements Library" }).first();
  const elementsButton = page.getByRole("button", { name: /^elements$/i }).first();
  const retryProjectButton = page
    .getByRole("button", { name: /^retry (project|workspace) load$/i })
    .first();
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    if (await panel.isVisible().catch(() => false)) return panel;
    if (await retryProjectButton.isVisible().catch(() => false)) {
      throw new Error(
        "AI Studio did not finish loading: retry project/workspace state is visible."
      );
    }
    if (await elementsHeading.isVisible().catch(() => false)) {
      await panel.waitFor({ timeout: 20_000 });
      return panel;
    }
    if (await elementsButton.isVisible().catch(() => false)) {
      await elementsButton.click({ timeout: 10_000 });
      await panel.waitFor({ timeout: 20_000 });
      return panel;
    }
    await page.waitForTimeout(500);
  }

  throw new Error("Timed out waiting for the Elements media panel to become ready.");
}

async function openMediaKindTab(page, panel, mediaKind) {
  const tabName = mediaKind === "video" ? /^videos$/i : /^images$/i;
  const targetTab = panel.getByRole("tab", { name: tabName }).first();
  await targetTab.waitFor({ timeout: 20_000 });
  await targetTab.click({ timeout: 10_000 });
  await page.waitForTimeout(800);
}

async function uploadPanelFixture(page, filePath) {
  const input = page.locator(".media-library-panel-file-input").first();
  await input.waitFor({ state: "attached", timeout: 20_000 });
  await input.setInputFiles(filePath);
}

async function verifyImageBrowseReady(page, filename, timeoutMs) {
  const image = page.getByAltText(filename).first();
  await image.waitFor({ timeout: timeoutMs });
  await image.evaluate(async (element, targetName) => {
    if (!(element instanceof HTMLImageElement)) {
      throw new Error("Expected persisted media preview to render as an image element.");
    }
    if (element.complete && element.naturalWidth > 0) return;
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        element.removeEventListener("load", handleLoad);
        element.removeEventListener("error", handleError);
      };
      const handleLoad = () => {
        cleanup();
        resolve(undefined);
      };
      const handleError = () => {
        cleanup();
        reject(new Error(`Image failed to load for ${targetName}.`));
      };
      element.addEventListener("load", handleLoad, { once: true });
      element.addEventListener("error", handleError, { once: true });
    });
    if (!(element.complete && element.naturalWidth > 0)) {
      throw new Error(`Image did not finish decoding for ${targetName}.`);
    }
  }, filename);
  const previewSrc = await image.getAttribute("src");
  if (!previewSrc || !previewSrc.trim()) {
    throw new Error(`Media preview for ${filename} did not expose a usable src.`);
  }
}

async function findMediaCardButton(page, filename, timeoutMs = 30_000, mediaKind = "image") {
  const namedButton = page
    .getByRole("button", {
      name: new RegExp(`^(Select|Deselect) media ${escapeForRegex(filename)}$`),
    })
    .first();
  if (await namedButton.isVisible({ timeout: Math.min(timeoutMs, 5_000) }).catch(() => false)) {
    return namedButton;
  }

  const image = page.getByAltText(filename).first();
  if (await image.isVisible({ timeout: Math.min(timeoutMs, 5_000) }).catch(() => false)) {
    const imageButton = image
      .locator(
        "xpath=ancestor::button[contains(concat(' ', normalize-space(@class), ' '), ' media-library-panel-media-card-button ')][1]"
      )
      .first();
    await imageButton.waitFor({ timeout: 5_000 });
    return imageButton;
  }

  if (mediaKind === "video") {
    throw new Error(`Video media card for ${filename} did not expose a target-specific label.`);
  }

  const fallbackButton = page.locator("button.media-library-panel-media-card-button").first();
  await fallbackButton.waitFor({ timeout: timeoutMs });
  return fallbackButton;
}

async function verifyVideoBrowseReady(page, filename, timeoutMs) {
  const mediaButton = await findMediaCardButton(page, filename, timeoutMs, "video");
  const preview = mediaButton.locator("video.media-thumb, img.media-thumb").first();
  await preview.waitFor({ timeout: timeoutMs });
  const previewTagName = await preview.evaluate((element) => element.tagName.toLowerCase());

  if (previewTagName === "video") {
    await preview.evaluate(async (element, targetName) => {
      if (!(element instanceof HTMLVideoElement)) {
        throw new Error("Expected persisted video preview to render as a video element.");
      }
      if (!element.currentSrc && !element.src) {
        throw new Error(`Video preview for ${targetName} did not expose a usable src.`);
      }
      if (element.readyState >= 1) return;
      await new Promise((resolve, reject) => {
        const cleanup = () => {
          element.removeEventListener("loadedmetadata", handleLoadedMetadata);
          element.removeEventListener("error", handleError);
        };
        const handleLoadedMetadata = () => {
          cleanup();
          resolve(undefined);
        };
        const handleError = () => {
          cleanup();
          reject(new Error(`Video preview failed to load metadata for ${targetName}.`));
        };
        element.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
        element.addEventListener("error", handleError, { once: true });
        element.load();
      });
    }, filename);
    return;
  }

  if (previewTagName === "img") {
    await preview.evaluate(async (element, targetName) => {
      if (!(element instanceof HTMLImageElement)) {
        throw new Error("Expected persisted video poster to render as an image element.");
      }
      if (!element.currentSrc && !element.src) {
        throw new Error(`Video poster for ${targetName} did not expose a usable src.`);
      }
      if (element.complete && element.naturalWidth > 0) return;
      await new Promise((resolve, reject) => {
        const cleanup = () => {
          element.removeEventListener("load", handleLoad);
          element.removeEventListener("error", handleError);
        };
        const handleLoad = () => {
          cleanup();
          resolve(undefined);
        };
        const handleError = () => {
          cleanup();
          reject(new Error(`Video poster failed to load for ${targetName}.`));
        };
        element.addEventListener("load", handleLoad, { once: true });
        element.addEventListener("error", handleError, { once: true });
      });
    }, filename);
    return;
  }

  throw new Error(`Video media card for ${filename} did not render a video or poster preview.`);
}

async function verifyBrowseReady(page, filename, mediaKind = "image", timeoutMs = 60_000) {
  if (mediaKind === "video") {
    await verifyVideoBrowseReady(page, filename, timeoutMs);
  } else {
    await verifyImageBrowseReady(page, filename, timeoutMs);
  }

  const downloadButton = page
    .getByRole("button", {
      name: new RegExp(
        `^(Download media ${escapeForRegex(filename)}|Download ${escapeForRegex(filename)})$`
      ),
    })
    .first();
  const mediaButton = await findMediaCardButton(page, filename, 30_000, mediaKind);
  await mediaButton.hover().catch(() => {});
  const downloadActionVisible = await downloadButton.isVisible().catch(() => false);
  return {
    visible: true,
    previewLoaded: true,
    browseReady: true,
    downloadActionVisible,
  };
}

async function deleteFixture(
  page,
  filename,
  mediaKind = "image",
  browseReadyTimeoutMs = 60_000,
  deleteVerifyTimeoutMs = 30_000
) {
  await runBrowseReadyCheck(page, filename, mediaKind, browseReadyTimeoutMs);
  const mediaButton = await findMediaCardButton(
    page,
    filename,
    Math.min(20_000, browseReadyTimeoutMs),
    mediaKind
  );
  await mediaButton.hover().catch(() => {});
  const actionDeleted = await deleteFixtureFromVisibleAction(page, filename);
  if (!actionDeleted) {
    return { attempted: false, succeeded: false };
  }
  await waitForMediaRowDeleted(page, filename, deleteVerifyTimeoutMs);
  return { attempted: true, succeeded: true };
}

async function deleteFixtureFromVisibleAction(page, filename) {
  const deleteButton = page
    .getByRole("button", {
      name: new RegExp(
        `^(Delete media ${escapeForRegex(filename)}|Delete ${escapeForRegex(filename)} from library)$`
      ),
    })
    .first();
  let deleteButtonVisible = await deleteButton.isVisible().catch(() => false);
  if (!deleteButtonVisible) {
    const mediaButtons = page.locator("button.media-library-panel-media-card-button");
    const mediaButtonCount = await mediaButtons.count().catch(() => 0);
    for (let index = 0; index < mediaButtonCount; index += 1) {
      await mediaButtons
        .nth(index)
        .hover()
        .catch(() => {});
      deleteButtonVisible = await deleteButton.isVisible().catch(() => false);
      if (deleteButtonVisible) break;
    }
  }
  if (!deleteButtonVisible) {
    return false;
  }
  await deleteButton.click({ timeout: 10_000, force: true });
  const dialog = page.getByRole("dialog", { name: "Delete this media?" }).first();
  await dialog.waitFor({ timeout: 20_000 });
  await dialog.getByRole("button", { name: /^delete$/i }).click({ timeout: 10_000 });
  await dialog.waitFor({ state: "hidden", timeout: 20_000 });
  await page.waitForTimeout(1000);
  return true;
}

async function waitForMediaRowDeleted(page, filename, timeoutMs = 30_000) {
  const token = await readAccessToken(page);
  if (!token) {
    if (filename.endsWith(".mp4")) {
      throw new Error(`Could not verify deleted video media without an access token: ${filename}`);
    }
    await page.waitForFunction(
      (targetName) => !document.querySelector(`img[alt="${targetName}"]`),
      filename,
      { timeout: timeoutMs }
    );
    return;
  }

  const startedAt = Date.now();
  let absentReadCount = 0;
  while (Date.now() - startedAt < timeoutMs) {
    const rows = await listAuditMediaRows({ token, filename });
    if (!rows.some((row) => row?.filename === filename)) {
      absentReadCount += 1;
      if (absentReadCount >= 3) return;
    } else {
      absentReadCount = 0;
    }
    await page.waitForTimeout(750);
  }
  throw new Error(`Deleted audit media still appeared in media list: ${filename}`);
}

async function cleanupAuditOwnedImageFixtures(page) {
  const result = {
    attempted: true,
    deleted: [],
    failed: [],
  };
  const token = await readAccessToken(page);
  if (token) {
    const rows = await listAuditMediaRows({
      token,
      filename: AUDIT_IMAGE_FILENAME_PREFIX,
      mediaKind: "images",
    }).catch(() => []);
    const filenames = Array.from(
      new Set(
        rows
          .map((row) => row?.filename)
          .filter(
            (filename) =>
              typeof filename === "string" && filename.startsWith(`${AUDIT_IMAGE_FILENAME_PREFIX}-`)
          )
      )
    );
    if (!filenames.length) return result;
    console.error(
      `[media-panel-persistence.audit] cleanup-only: image row fixtures=${filenames.length}`
    );

    const panel = await openTargetPanel(page);
    await openMediaKindTab(page, panel, "image");
    for (const filename of filenames) {
      try {
        console.error(`[media-panel-persistence.audit] cleanup-only: image delete ${filename}`);
        const cleanup = await deleteFixture(page, filename, "image", 10_000, 10_000);
        if (cleanup.succeeded) {
          result.deleted.push(filename);
        } else {
          result.failed.push(filename);
        }
      } catch {
        result.failed.push(filename);
      }
    }

    const remainingRows = await listAuditMediaRows({
      token,
      filename: AUDIT_IMAGE_FILENAME_PREFIX,
      mediaKind: "images",
    }).catch(() => []);
    const remainingFilenames = Array.from(
      new Set(
        remainingRows
          .map((row) => row?.filename)
          .filter(
            (filename) =>
              typeof filename === "string" && filename.startsWith(`${AUDIT_IMAGE_FILENAME_PREFIX}-`)
          )
      )
    );
    for (const filename of remainingFilenames) {
      if (!result.failed.includes(filename)) {
        result.failed.push(filename);
      }
    }

    return result;
  }

  const panel = await openTargetPanel(page);
  await openMediaKindTab(page, panel, "image");

  for (let pass = 0; pass < 5; pass += 1) {
    const filenames = await page
      .locator(`img.media-thumb[alt^="${AUDIT_IMAGE_FILENAME_PREFIX}-"]`)
      .evaluateAll((nodes) =>
        Array.from(new Set(nodes.map((node) => node.getAttribute("alt")).filter(Boolean)))
      )
      .catch(() => []);
    if (!filenames.length) break;

    for (const filename of filenames) {
      try {
        const cleanup = await deleteFixture(page, filename, "image");
        if (cleanup.succeeded) {
          result.deleted.push(filename);
        } else {
          result.failed.push(filename);
        }
      } catch {
        result.failed.push(filename);
      }
    }
  }

  return result;
}

async function cleanupAuditOwnedVideoFixtures(page) {
  const result = {
    attempted: true,
    deleted: [],
    failed: [],
  };
  const token = await readAccessToken(page);
  if (!token) {
    result.failed.push("missing-access-token");
    return result;
  }

  const rows = await listAuditMediaRows({
    token,
    filename: AUDIT_VIDEO_FILENAME_PREFIX,
    mediaKind: "videos",
  }).catch(() => []);
  const filenames = Array.from(
    new Set(
      rows
        .map((row) => row?.filename)
        .filter(
          (filename) =>
            typeof filename === "string" && filename.startsWith(`${AUDIT_VIDEO_FILENAME_PREFIX}-`)
        )
    )
  );
  if (!filenames.length) return result;
  console.error(
    `[media-panel-persistence.audit] cleanup-only: video row fixtures=${filenames.length}`
  );

  const panel = await openTargetPanel(page);
  await openMediaKindTab(page, panel, "video");
  for (const filename of filenames) {
    try {
      console.error(`[media-panel-persistence.audit] cleanup-only: video delete ${filename}`);
      await deleteFixture(page, filename, "video", 10_000, 10_000);
      result.deleted.push(filename);
    } catch {
      try {
        const actionDeleted = await deleteFixtureFromVisibleAction(page, filename);
        if (!actionDeleted) throw new Error("No visible delete action found.");
        await waitForMediaRowDeleted(page, filename);
        result.deleted.push(filename);
      } catch {
        result.failed.push(filename);
      }
    }
  }

  const remainingRows = await listAuditMediaRows({
    token,
    filename: AUDIT_VIDEO_FILENAME_PREFIX,
    mediaKind: "videos",
  }).catch(() => []);
  const remainingFilenames = Array.from(
    new Set(
      remainingRows
        .map((row) => row?.filename)
        .filter(
          (filename) =>
            typeof filename === "string" && filename.startsWith(`${AUDIT_VIDEO_FILENAME_PREFIX}-`)
        )
    )
  );
  for (const filename of remainingFilenames) {
    if (!result.failed.includes(filename)) {
      result.failed.push(filename);
    }
  }

  return result;
}

async function deleteAuditFolder(token, folderId) {
  if (!folderId) return;
  try {
    await apiRequest({
      token,
      method: "POST",
      requestPath: "/api/media/folders/delete",
      body: { folderId },
    });
  } catch {
    // best-effort production audit cleanup only
  }
}

async function listAuditMediaRows({ token, filename, folderId = "all_items", mediaKind = null }) {
  const result = await apiRequest({
    token,
    method: "POST",
    requestPath: "/api/media/list",
    body: {
      tab: null,
      mediaKind: mediaKind ?? (filename.endsWith(".mp4") ? "videos" : "images"),
      query: filename,
      cursor: null,
      limit: 10,
      surface: "media-library-panel",
      profile: "expanded",
      folderId,
    },
  });
  assertJsonApiResult(`Media list ${folderId}`, result, 200);
  return Array.isArray(result.payload?.rows) ? result.payload.rows : [];
}

async function waitForAuditMediaRow({
  page,
  token,
  filename,
  folderId = "all_items",
  mediaKind = null,
  timeoutMs = 30_000,
}) {
  const startedAt = Date.now();
  let latestRows = [];
  while (Date.now() - startedAt < timeoutMs) {
    latestRows = await listAuditMediaRows({ token, filename, folderId, mediaKind });
    const mediaRow = latestRows.find((row) => row?.filename === filename);
    if (mediaRow) return mediaRow;
    await page.waitForTimeout(750);
  }
  throw new Error(`Uploaded audit media row was not found for ${filename}.`);
}

async function verifyFolderMembershipRoundtrip({ page, filename }) {
  const token = await readAccessToken(page);
  if (!token) {
    throw new Error("Could not resolve audit access token from browser session.");
  }

  let folderId = null;
  const result = {
    attempted: true,
    folderCreated: false,
    mediaResolved: false,
    assignedVisibleInFolder: false,
    unassignedRemovedFromFolder: false,
    folderDeleted: false,
  };

  try {
    const mediaRow = await waitForAuditMediaRow({ page, token, filename });
    const mediaId = typeof mediaRow?.id === "string" ? mediaRow.id : "";
    if (!mediaId) {
      throw new Error(`Uploaded audit media row was not found for ${filename}.`);
    }
    result.mediaResolved = true;

    const createFolderResult = await apiRequest({
      token,
      method: "POST",
      requestPath: "/api/media/folders/create",
      body: {
        name: `Audit Membership ${Date.now()}`,
        parentFolderId: null,
      },
    });
    assertJsonApiResult("Media folder create", createFolderResult, 200);
    folderId = createFolderResult.payload?.folder?.id;
    if (!folderId) {
      throw new Error(`Media folder create failed: ${summarizeApiResult(createFolderResult)}`);
    }
    result.folderCreated = true;

    const assignResult = await apiRequest({
      token,
      method: "POST",
      requestPath: "/api/media/folders/membership-batch",
      body: {
        action: "assign",
        folderId,
        mediaIds: [mediaId],
        promptIds: [],
      },
    });
    assertJsonApiResult("Media folder membership assign", assignResult, 200);

    const assignedRows = await listAuditMediaRows({ token, filename, folderId });
    result.assignedVisibleInFolder = assignedRows.some((row) => row?.id === mediaId);
    if (!result.assignedVisibleInFolder) {
      throw new Error("Assigned audit media did not appear in the target folder.");
    }

    const unassignResult = await apiRequest({
      token,
      method: "POST",
      requestPath: "/api/media/folders/membership-batch",
      body: {
        action: "unassign",
        folderId,
        mediaIds: [mediaId],
        promptIds: [],
      },
    });
    assertJsonApiResult("Media folder membership unassign", unassignResult, 200);

    const unassignedRows = await listAuditMediaRows({ token, filename, folderId });
    result.unassignedRemovedFromFolder = !unassignedRows.some((row) => row?.id === mediaId);
    if (!result.unassignedRemovedFromFolder) {
      throw new Error("Unassigned audit media still appeared in the target folder.");
    }

    const deleteFolderResult = await apiRequest({
      token,
      method: "POST",
      requestPath: "/api/media/folders/delete",
      body: { folderId },
    });
    assertJsonApiResult("Media folder delete", deleteFolderResult, 200);
    result.folderDeleted = true;
    folderId = null;
    return result;
  } finally {
    if (folderId) {
      await deleteAuditFolder(token, folderId);
    }
  }
}

async function ensureQuickSlotInventoryVisible(page) {
  const quickSlotSurface = page.locator('[data-right-rail-drop-surface="quick-slot"]').first();
  if (await quickSlotSurface.isVisible().catch(() => false)) return quickSlotSurface;

  const quickSlotToggle = page.getByRole("button", { name: /^quick slot inventory$/i }).first();
  await quickSlotToggle.click({ timeout: 10_000 });
  await quickSlotSurface.waitFor({ timeout: 20_000 });
  return quickSlotSurface;
}

async function resolveQuickSlotCardCount(page) {
  return page.evaluate(() => {
    const section = document.querySelector('[data-right-rail-drop-surface="quick-slot"]');
    return section ? section.querySelectorAll(".reference-card").length : 0;
  });
}

async function cleanupInsertedQuickSlotReference(page, expectedMinimumCount) {
  const quickSlotSurface = await ensureQuickSlotInventoryVisible(page);
  const firstQuickSlotCard = quickSlotSurface.locator(".reference-card").first();
  if (!(await firstQuickSlotCard.isVisible().catch(() => false))) {
    return { attempted: false, succeeded: false };
  }
  await firstQuickSlotCard.hover().catch(() => {});
  const removeButton = firstQuickSlotCard
    .locator(
      'button[aria-label="Remove from curated"], .reference-card-actions button.reference-card-action-btn--danger'
    )
    .first();
  if ((await removeButton.count().catch(() => 0)) === 0) {
    return { attempted: false, succeeded: false };
  }
  await removeButton.click({ timeout: 10_000, force: true });
  await page.waitForFunction(
    ({ targetCount }) => {
      const section = document.querySelector('[data-right-rail-drop-surface="quick-slot"]');
      if (!section) return false;
      return section.querySelectorAll(".reference-card").length <= targetCount;
    },
    { targetCount: expectedMinimumCount },
    { timeout: 20_000 }
  );
  return { attempted: true, succeeded: true };
}

async function verifyQuickSlotReuseRoundtrip({ page, filename, mediaKind = "image" }) {
  const quickSlotSurface = await ensureQuickSlotInventoryVisible(page);
  await runBrowseReadyCheck(page, filename, mediaKind);

  const sourceCard = await findMediaCardButton(page, filename, 30_000, mediaKind);
  await sourceCard.waitFor({ timeout: 20_000 });
  const cardCountBefore = await resolveQuickSlotCardCount(page);

  await sourceCard.dragTo(quickSlotSurface, {
    targetPosition: { x: 24, y: 56 },
    timeout: 20_000,
  });

  await page.waitForFunction(
    ({ beforeCount, targetName }) => {
      const section = document.querySelector('[data-right-rail-drop-surface="quick-slot"]');
      if (!section) return false;
      const cards = Array.from(section.querySelectorAll(".reference-card"));
      if (cards.length <= beforeCount) return false;
      return cards.some((card) => {
        const text = card.textContent || "";
        const hasVisiblePreview = Boolean(
          card.querySelector(".reference-card-image, .reference-card-video, .reference-card-audio")
        );
        return text.includes(targetName) || hasVisiblePreview;
      });
    },
    { beforeCount: cardCountBefore, targetName: filename },
    { timeout: 30_000 }
  );

  const cardCountAfter = await resolveQuickSlotCardCount(page);
  const cleanup = await cleanupInsertedQuickSlotReference(page, cardCountBefore);
  return {
    attempted: true,
    targetVisible: true,
    cardCountBefore,
    cardCountAfter,
    insertedVisible: cardCountAfter > cardCountBefore,
    cleanup,
  };
}

async function ensureReferenceGridVisible(page) {
  const referenceGridSurface = page.locator('[data-right-rail-drop-surface="all-refs"]').first();
  if (await referenceGridSurface.isVisible().catch(() => false)) return referenceGridSurface;

  const referenceGridToggle = page.getByRole("button", { name: /^reference grid$/i }).first();
  await referenceGridToggle.click({ timeout: 10_000 });
  await referenceGridSurface.waitFor({ timeout: 20_000 });
  return referenceGridSurface;
}

async function resolveReferenceGridCardCount(page) {
  return page.evaluate(() => {
    const section = document.querySelector('[data-right-rail-drop-surface="all-refs"]');
    return section ? section.querySelectorAll(".reference-card").length : 0;
  });
}

async function verifyReferenceGridReuseRoundtrip({ page, filename, mediaKind = "image" }) {
  const referenceGridSurface = await ensureReferenceGridVisible(page);
  await referenceGridSurface.scrollIntoViewIfNeeded();
  await runBrowseReadyCheck(page, filename, mediaKind);

  const sourceCard = await findMediaCardButton(page, filename, 30_000, mediaKind);
  await sourceCard.waitFor({ timeout: 20_000 });
  const cardCountBefore = await resolveReferenceGridCardCount(page);

  await sourceCard.dragTo(referenceGridSurface, {
    targetPosition: { x: 48, y: 132 },
    timeout: 20_000,
  });

  await page.waitForFunction(
    ({ beforeCount, targetName }) => {
      const section = document.querySelector('[data-right-rail-drop-surface="all-refs"]');
      if (!section) return false;
      const cards = Array.from(section.querySelectorAll(".reference-card"));
      if (cards.length <= beforeCount) return false;
      return cards.some((card) => {
        const text = card.textContent || "";
        const hasVisiblePreview = Boolean(
          card.querySelector(".reference-card-image, .reference-card-video, .reference-card-audio")
        );
        return text.includes(targetName) || hasVisiblePreview;
      });
    },
    { beforeCount: cardCountBefore, targetName: filename },
    { timeout: 30_000 }
  );

  const cardCountAfter = await resolveReferenceGridCardCount(page);
  return {
    attempted: true,
    targetVisible: true,
    cardCountBefore,
    cardCountAfter,
    insertedVisible: cardCountAfter > cardCountBefore,
  };
}

async function ensureCanvasVisible(page) {
  const canvasViewport = page.getByTestId("canvas-viewport").first();
  if (await canvasViewport.isVisible().catch(() => false)) return canvasViewport;

  const canvasToggle = page.getByRole("button", { name: /^canvas$/i }).first();
  await canvasToggle.click({ timeout: 10_000 });
  await canvasViewport.waitFor({ timeout: 20_000 });
  return canvasViewport;
}

async function resolveCanvasItemCount(page) {
  return page.evaluate(() => {
    const viewport = document.querySelector('[data-testid="canvas-viewport"]');
    if (!viewport) return 0;
    const rawCount = viewport.getAttribute("data-canvas-total-item-count");
    const parsedCount = rawCount ? Number.parseInt(rawCount, 10) : Number.NaN;
    if (Number.isFinite(parsedCount)) return parsedCount;
    return viewport.querySelectorAll('[data-testid^="canvas-item-"]').length;
  });
}

async function verifyCanvasReuseRoundtrip({ page, filename, mediaKind = "image" }) {
  const canvasViewport = await ensureCanvasVisible(page);
  await runBrowseReadyCheck(page, filename, mediaKind);

  const sourceCard = await findMediaCardButton(page, filename, 30_000, mediaKind);
  await sourceCard.waitFor({ timeout: 20_000 });
  const itemCountBefore = await resolveCanvasItemCount(page);

  await sourceCard.dragTo(canvasViewport, {
    targetPosition: { x: 120, y: 120 },
    timeout: 20_000,
  });

  await page.waitForFunction(
    ({ beforeCount }) => {
      const viewport = document.querySelector('[data-testid="canvas-viewport"]');
      if (!viewport) return false;
      const rawCount = viewport.getAttribute("data-canvas-total-item-count");
      const parsedCount = rawCount ? Number.parseInt(rawCount, 10) : Number.NaN;
      const currentCount = Number.isFinite(parsedCount)
        ? parsedCount
        : viewport.querySelectorAll('[data-testid^="canvas-item-"]').length;
      return currentCount > beforeCount;
    },
    { beforeCount: itemCountBefore },
    { timeout: 30_000 }
  );

  const itemCountAfter = await resolveCanvasItemCount(page);
  return {
    attempted: true,
    targetVisible: true,
    itemCountBefore,
    itemCountAfter,
    insertedVisible: itemCountAfter > itemCountBefore,
  };
}

function createImageFixtureFile() {
  const filename = `${AUDIT_IMAGE_FILENAME_PREFIX}-${Date.now()}.png`;
  const fixturePath = path.join(os.tmpdir(), filename);
  fs.writeFileSync(fixturePath, Buffer.from(PNG_BYTES));
  return { filename, fixturePath, mediaKind: "image" };
}

function createVideoFixtureFile() {
  if (!fs.existsSync(VIDEO_FIXTURE_SOURCE_PATH)) {
    throw new Error(`Video audit fixture source is missing: ${VIDEO_FIXTURE_SOURCE_PATH}`);
  }
  const filename = `${AUDIT_VIDEO_FILENAME_PREFIX}-${Date.now()}.mp4`;
  const fixturePath = path.join(os.tmpdir(), filename);
  fs.copyFileSync(VIDEO_FIXTURE_SOURCE_PATH, fixturePath);
  return { filename, fixturePath, mediaKind: "video" };
}

async function runBrowseReadyCheck(page, filename, mediaKind = "image") {
  const panel = await openTargetPanel(page);
  await openMediaKindTab(page, panel, mediaKind);
  return await verifyBrowseReady(page, filename, mediaKind);
}

let targetSurface = normalizeSurface(
  process.env.PLAYWRIGHT_MEDIA_PANEL_SURFACE || readSurfaceArg(process.argv)
);

function normalizeSurface(rawSurface) {
  const normalized = (rawSurface || "").trim().toLowerCase();
  if (!normalized) return "ai-studio-panel";
  if (!SUPPORTED_SURFACES.has(normalized)) {
    throw new Error(
      `Unsupported surface: ${rawSurface || "<missing>"}. Expected one of ${Array.from(
        SUPPORTED_SURFACES
      ).join(", ")}.`
    );
  }
  return normalized;
}

async function openTargetPanel(page) {
  if (targetSurface === "elements-media-panel") {
    return await openElementsMediaPanel(page);
  }
  return await openAiStudioMediaPanel(page);
}

async function runAudit(browser, creds) {
  const fixture = createImageFixtureFile();
  const videoFixture = targetSurface === "ai-studio-panel" ? createVideoFixtureFile() : null;
  const result = {
    ok: false,
    generatedAt: new Date().toISOString(),
    surface: targetSurface,
    baseUrl: DEFAULT_BASE_URL,
    sampleCount: videoFixture ? 2 : 1,
    filename: fixture.filename,
    videoFilename: videoFixture?.filename ?? null,
    steps: {
      upload: {
        visible: false,
        previewLoaded: false,
        browseReady: false,
        downloadActionVisible: false,
      },
      reloadReopen: {
        visible: false,
        previewLoaded: false,
        browseReady: false,
        downloadActionVisible: false,
      },
      freshContextReopen: {
        visible: false,
        previewLoaded: false,
        browseReady: false,
        downloadActionVisible: false,
      },
      folderMembership: {
        attempted: false,
        folderCreated: false,
        mediaResolved: false,
        assignedVisibleInFolder: false,
        unassignedRemovedFromFolder: false,
        folderDeleted: false,
      },
      quickSlotReuse: {
        attempted: false,
        targetVisible: false,
        cardCountBefore: 0,
        cardCountAfter: 0,
        insertedVisible: false,
        cleanup: {
          attempted: false,
          succeeded: false,
        },
      },
      referenceGridReuse: {
        attempted: false,
        targetVisible: false,
        cardCountBefore: 0,
        cardCountAfter: 0,
        insertedVisible: false,
      },
      canvasReuse: {
        attempted: false,
        targetVisible: false,
        itemCountBefore: 0,
        itemCountAfter: 0,
        insertedVisible: false,
      },
    },
    videoSteps: {
      skipped: !videoFixture,
      skipReason: videoFixture
        ? null
        : "Video variant is only audited on the main AI Studio Media panel.",
      upload: {
        visible: false,
        previewLoaded: false,
        browseReady: false,
        downloadActionVisible: false,
      },
      reloadReopen: {
        visible: false,
        previewLoaded: false,
        browseReady: false,
        downloadActionVisible: false,
      },
      freshContextReopen: {
        visible: false,
        previewLoaded: false,
        browseReady: false,
        downloadActionVisible: false,
      },
      folderMembership: {
        attempted: false,
        folderCreated: false,
        mediaResolved: false,
        assignedVisibleInFolder: false,
        unassignedRemovedFromFolder: false,
        folderDeleted: false,
      },
      quickSlotReuse: {
        attempted: false,
        targetVisible: false,
        cardCountBefore: 0,
        cardCountAfter: 0,
        insertedVisible: false,
        cleanup: {
          attempted: false,
          succeeded: false,
        },
      },
      referenceGridReuse: {
        attempted: false,
        targetVisible: false,
        cardCountBefore: 0,
        cardCountAfter: 0,
        insertedVisible: false,
      },
      canvasReuse: {
        attempted: false,
        targetVisible: false,
        itemCountBefore: 0,
        itemCountAfter: 0,
        insertedVisible: false,
      },
    },
    metrics: {
      saveRoundtripFailureRate: 1,
      saveRoundtripMismatchRate: 1,
      saveBrowseReadyRatio: 0,
    },
    cleanup: {
      attempted: false,
      succeeded: false,
    },
    videoCleanup: {
      attempted: false,
      succeeded: false,
    },
    preflightCleanup: {
      attempted: false,
      deleted: [],
      failed: [],
      videoDeleted: [],
      videoFailed: [],
    },
  };

  const primaryContext = await browser.newContext({ viewport: { width: 1720, height: 980 } });
  const primaryPage = await primaryContext.newPage();

  try {
    await ensureSignedIn(primaryPage, DEFAULT_BASE_URL, "/ai-studio", creds.email, creds.password);
    await openTargetPanel(primaryPage);
    const imagePreflightCleanup = await cleanupAuditOwnedImageFixtures(primaryPage);
    const videoPreflightCleanup = await cleanupAuditOwnedVideoFixtures(primaryPage);
    result.preflightCleanup = {
      ...imagePreflightCleanup,
      videoDeleted: videoPreflightCleanup.deleted,
      videoFailed: videoPreflightCleanup.failed,
    };
    await uploadPanelFixture(primaryPage, fixture.fixturePath);
    result.steps.upload = await runBrowseReadyCheck(primaryPage, fixture.filename);
    result.steps.folderMembership = await verifyFolderMembershipRoundtrip({
      page: primaryPage,
      filename: fixture.filename,
    });
    result.steps.referenceGridReuse = await verifyReferenceGridReuseRoundtrip({
      page: primaryPage,
      filename: fixture.filename,
    });
    result.steps.quickSlotReuse = await verifyQuickSlotReuseRoundtrip({
      page: primaryPage,
      filename: fixture.filename,
    });
    result.steps.canvasReuse = await verifyCanvasReuseRoundtrip({
      page: primaryPage,
      filename: fixture.filename,
    });

    if (videoFixture) {
      await openTargetPanel(primaryPage);
      await uploadPanelFixture(primaryPage, videoFixture.fixturePath);
      result.videoSteps.upload = await runBrowseReadyCheck(
        primaryPage,
        videoFixture.filename,
        videoFixture.mediaKind
      );
      result.videoSteps.folderMembership = await verifyFolderMembershipRoundtrip({
        page: primaryPage,
        filename: videoFixture.filename,
      });
      result.videoSteps.referenceGridReuse = await verifyReferenceGridReuseRoundtrip({
        page: primaryPage,
        filename: videoFixture.filename,
        mediaKind: videoFixture.mediaKind,
      });
      result.videoSteps.quickSlotReuse = await verifyQuickSlotReuseRoundtrip({
        page: primaryPage,
        filename: videoFixture.filename,
        mediaKind: videoFixture.mediaKind,
      });
      result.videoSteps.canvasReuse = await verifyCanvasReuseRoundtrip({
        page: primaryPage,
        filename: videoFixture.filename,
        mediaKind: videoFixture.mediaKind,
      });
    }

    await primaryPage.reload({ waitUntil: "domcontentloaded", timeout: 45_000 });
    await satisfyMediaComplianceIfPresent(primaryPage);
    result.steps.reloadReopen = await runBrowseReadyCheck(primaryPage, fixture.filename);
    if (videoFixture) {
      result.videoSteps.reloadReopen = await runBrowseReadyCheck(
        primaryPage,
        videoFixture.filename,
        videoFixture.mediaKind
      );
    }

    const freshContext = await browser.newContext({ viewport: { width: 1720, height: 980 } });
    try {
      const freshPage = await freshContext.newPage();
      await ensureSignedIn(freshPage, DEFAULT_BASE_URL, "/ai-studio", creds.email, creds.password);
      result.steps.freshContextReopen = await runBrowseReadyCheck(freshPage, fixture.filename);
      if (videoFixture) {
        result.videoSteps.freshContextReopen = await runBrowseReadyCheck(
          freshPage,
          videoFixture.filename,
          videoFixture.mediaKind
        );
      }
    } finally {
      await freshContext.close();
    }

    await runBrowseReadyCheck(primaryPage, fixture.filename);
    result.cleanup = await deleteFixture(primaryPage, fixture.filename);
    if (videoFixture) {
      await runBrowseReadyCheck(primaryPage, videoFixture.filename, videoFixture.mediaKind);
      result.videoCleanup = await deleteFixture(
        primaryPage,
        videoFixture.filename,
        videoFixture.mediaKind
      );
    }

    const allSteps = [
      result.steps.upload,
      result.steps.reloadReopen,
      result.steps.freshContextReopen,
    ];
    const videoAllSteps = videoFixture
      ? [
          result.videoSteps.upload,
          result.videoSteps.reloadReopen,
          result.videoSteps.freshContextReopen,
        ]
      : [];
    const successfulSteps = allSteps.filter((step) => step.visible && step.browseReady).length;
    const successfulVideoSteps = videoAllSteps.filter(
      (step) => step.visible && step.browseReady
    ).length;
    result.metrics.saveRoundtripFailureRate = successfulSteps === allSteps.length ? 0 : 1;
    result.metrics.saveRoundtripMismatchRate = allSteps.every((step) => step.visible) ? 0 : 1;
    result.metrics.saveBrowseReadyRatio = Number((successfulSteps / allSteps.length).toFixed(4));
    const videoOk =
      !videoFixture ||
      (successfulVideoSteps === videoAllSteps.length &&
        result.videoSteps.folderMembership.folderDeleted &&
        result.videoSteps.folderMembership.assignedVisibleInFolder &&
        result.videoSteps.folderMembership.unassignedRemovedFromFolder &&
        result.videoSteps.referenceGridReuse.insertedVisible &&
        result.videoSteps.quickSlotReuse.insertedVisible &&
        result.videoSteps.canvasReuse.insertedVisible &&
        result.videoCleanup.attempted &&
        result.videoCleanup.succeeded);
    result.ok =
      successfulSteps === allSteps.length &&
      result.steps.folderMembership.folderDeleted &&
      result.steps.folderMembership.assignedVisibleInFolder &&
      result.steps.folderMembership.unassignedRemovedFromFolder &&
      result.steps.referenceGridReuse.insertedVisible &&
      result.steps.quickSlotReuse.insertedVisible &&
      result.steps.canvasReuse.insertedVisible &&
      result.cleanup.attempted &&
      result.cleanup.succeeded &&
      videoOk;
  } finally {
    if (result.steps.upload.visible && !result.cleanup.succeeded) {
      try {
        await runBrowseReadyCheck(primaryPage, fixture.filename);
        result.cleanup = await deleteFixture(primaryPage, fixture.filename);
      } catch {
        // best-effort cleanup; the failing assertion remains the primary audit signal
      }
    }
    if (videoFixture && result.videoSteps.upload.visible && !result.videoCleanup.succeeded) {
      try {
        await runBrowseReadyCheck(primaryPage, videoFixture.filename, videoFixture.mediaKind);
        result.videoCleanup = await deleteFixture(
          primaryPage,
          videoFixture.filename,
          videoFixture.mediaKind
        );
      } catch {
        // best-effort cleanup; the failing assertion remains the primary audit signal
      }
    }
    await primaryContext.close();
    try {
      fs.unlinkSync(fixture.fixturePath);
    } catch {
      // best-effort temp cleanup only
    }
    if (videoFixture) {
      try {
        fs.unlinkSync(videoFixture.fixturePath);
      } catch {
        // best-effort temp cleanup only
      }
    }
  }

  return result;
}

async function runCleanupOnly(browser, creds) {
  const context = await browser.newContext({ viewport: { width: 1720, height: 980 } });
  const page = await context.newPage();
  try {
    console.error("[media-panel-persistence.audit] cleanup-only: sign-in");
    await ensureSignedIn(page, DEFAULT_BASE_URL, "/ai-studio", creds.email, creds.password);
    console.error("[media-panel-persistence.audit] cleanup-only: open panel");
    await openTargetPanel(page);
    console.error("[media-panel-persistence.audit] cleanup-only: image fixtures");
    const imageCleanup = await cleanupAuditOwnedImageFixtures(page);
    console.error("[media-panel-persistence.audit] cleanup-only: video fixtures");
    const videoCleanup = await cleanupAuditOwnedVideoFixtures(page);
    console.error("[media-panel-persistence.audit] cleanup-only: complete");
    return {
      ok: imageCleanup.failed.length === 0 && videoCleanup.failed.length === 0,
      generatedAt: new Date().toISOString(),
      surface: targetSurface,
      baseUrl: DEFAULT_BASE_URL,
      cleanupOnly: true,
      imageCleanup,
      videoCleanup,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  const creds = loadAuditCredentials();
  targetSurface = normalizeSurface(targetSurface);
  if (!creds.email) {
    console.error("[media-panel-persistence.audit] PLAYWRIGHT_AUDIT_EMAIL is required.");
    process.exitCode = 1;
    return;
  }
  if (/@example\.com$/i.test(creds.email)) {
    console.error(
      "[media-panel-persistence.audit] PLAYWRIGHT_AUDIT_EMAIL cannot use @example.com. Use a dedicated real test account."
    );
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch({ headless: HEADLESS });
  try {
    const result = CLEANUP_ONLY
      ? await runCleanupOnly(browser, creds)
      : await runAudit(browser, creds);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error("[media-panel-persistence.audit] fatal:", error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
