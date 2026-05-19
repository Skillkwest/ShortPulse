/* global require, process, console, __dirname, HTMLImageElement, document, Buffer */
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
const AUDIT_FILENAME_PREFIX = "holomony-save-browse-audit";
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

async function openImagesTab(page, panel) {
  const imagesTab = panel.getByRole("tab", { name: /^images$/i }).first();
  await imagesTab.waitFor({ timeout: 20_000 });
  await imagesTab.click({ timeout: 10_000 });
  await page.waitForTimeout(800);
}

async function uploadPanelFixture(page, filePath) {
  const input = page.locator(".media-library-panel-file-input").first();
  await input.waitFor({ state: "attached", timeout: 20_000 });
  await input.setInputFiles(filePath);
}

async function verifyBrowseReady(page, filename, timeoutMs = 60_000) {
  const image = page.getByAltText(filename).first();
  const downloadButton = page
    .getByRole("button", {
      name: new RegExp(
        `^(Download media ${escapeForRegex(filename)}|Download ${escapeForRegex(filename)})$`
      ),
    })
    .first();
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
  await image.hover().catch(() => {});
  const downloadActionVisible = await downloadButton.isVisible().catch(() => false);
  return {
    visible: true,
    previewLoaded: true,
    browseReady: true,
    downloadActionVisible,
  };
}

async function deleteFixture(page, filename) {
  const image = page.getByAltText(filename).first();
  await image.waitFor({ timeout: 20_000 });
  await image.hover().catch(() => {});
  const deleteButton = page
    .getByRole("button", {
      name: new RegExp(
        `^(Delete media ${escapeForRegex(filename)}|Delete ${escapeForRegex(filename)} from library)$`
      ),
    })
    .first();
  const deleteButtonCount = await deleteButton.count().catch(() => 0);
  if (deleteButtonCount === 0) {
    return { attempted: false, succeeded: false };
  }
  await deleteButton.click({ timeout: 10_000, force: true });
  const dialog = page.getByRole("dialog", { name: "Delete this media?" }).first();
  await dialog.waitFor({ timeout: 20_000 });
  await dialog.getByRole("button", { name: /^delete$/i }).click({ timeout: 10_000 });
  await dialog.waitFor({ state: "hidden", timeout: 20_000 });
  await page.waitForTimeout(1000);
  await page.waitForFunction(
    (targetName) => !document.querySelector(`img[alt="${targetName}"]`),
    filename,
    { timeout: 30_000 }
  );
  return { attempted: true, succeeded: true };
}

function createFixtureFile() {
  const filename = `${AUDIT_FILENAME_PREFIX}-${Date.now()}.png`;
  const fixturePath = path.join(os.tmpdir(), filename);
  fs.writeFileSync(fixturePath, Buffer.from(PNG_BYTES));
  return { filename, fixturePath };
}

async function runBrowseReadyCheck(page, filename) {
  const panel = await openTargetPanel(page);
  await openImagesTab(page, panel);
  return await verifyBrowseReady(page, filename);
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
  const fixture = createFixtureFile();
  const result = {
    ok: false,
    generatedAt: new Date().toISOString(),
    surface: targetSurface,
    baseUrl: DEFAULT_BASE_URL,
    sampleCount: 1,
    filename: fixture.filename,
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
  };

  const primaryContext = await browser.newContext({ viewport: { width: 1720, height: 980 } });
  const primaryPage = await primaryContext.newPage();

  try {
    await ensureSignedIn(primaryPage, DEFAULT_BASE_URL, "/ai-studio", creds.email, creds.password);
    await openTargetPanel(primaryPage);
    await uploadPanelFixture(primaryPage, fixture.fixturePath);
    result.steps.upload = await runBrowseReadyCheck(primaryPage, fixture.filename);

    await primaryPage.reload({ waitUntil: "domcontentloaded", timeout: 45_000 });
    await satisfyMediaComplianceIfPresent(primaryPage);
    result.steps.reloadReopen = await runBrowseReadyCheck(primaryPage, fixture.filename);

    const freshContext = await browser.newContext({ viewport: { width: 1720, height: 980 } });
    try {
      const freshPage = await freshContext.newPage();
      await ensureSignedIn(freshPage, DEFAULT_BASE_URL, "/ai-studio", creds.email, creds.password);
      result.steps.freshContextReopen = await runBrowseReadyCheck(freshPage, fixture.filename);
    } finally {
      await freshContext.close();
    }

    await runBrowseReadyCheck(primaryPage, fixture.filename);
    result.cleanup = await deleteFixture(primaryPage, fixture.filename);

    const allSteps = Object.values(result.steps);
    const successfulSteps = allSteps.filter((step) => step.visible && step.browseReady).length;
    result.metrics.saveRoundtripFailureRate = successfulSteps === allSteps.length ? 0 : 1;
    result.metrics.saveRoundtripMismatchRate = allSteps.every((step) => step.visible) ? 0 : 1;
    result.metrics.saveBrowseReadyRatio = Number((successfulSteps / allSteps.length).toFixed(4));
    result.ok =
      successfulSteps === allSteps.length && result.cleanup.attempted && result.cleanup.succeeded;
  } finally {
    await primaryContext.close();
    try {
      fs.unlinkSync(fixture.fixturePath);
    } catch {
      // best-effort temp cleanup only
    }
  }

  return result;
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
    const result = await runAudit(browser, creds);
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
