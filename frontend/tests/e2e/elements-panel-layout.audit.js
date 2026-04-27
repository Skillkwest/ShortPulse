/* global require, process, console, __dirname, window, document, HTMLElement, setTimeout */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Elements panel layout browser audit.
 * Signs in to AI Studio, opens the Elements panel, stages a local unsaved element draft,
 * and verifies the restored editor layout contract in a real browser runtime.
 */
const fs = require("node:fs");
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

const BASE_URL = (process.env.PLAYWRIGHT_ELEMENTS_BASE_URL || "http://localhost:3000").trim();
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

function summarizeSignals(consoleEntries, pageErrors) {
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
    ok: severeConsole.length === 0 && severePageErrors.length === 0,
  };
}

async function attachSurfaceObservers(page) {
  const consoleEntries = [];
  const pageErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (shouldIgnoreConsole(text)) return;
    consoleEntries.push({
      type: message.type(),
      text,
    });
  });
  page.on("pageerror", (error) => {
    pageErrors.push({
      text: String(error?.message || error),
    });
  });
  return { consoleEntries, pageErrors };
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

async function openElementsPanel(page) {
  const elementsHeading = page.getByRole("heading", { name: "Elements Library" }).first();
  if (await elementsHeading.isVisible().catch(() => false)) return;

  const elementsButton = page.getByRole("button", { name: /^elements$/i }).first();
  const retryProjectButton = page
    .getByRole("button", { name: /^retry (project|workspace) load$/i })
    .first();
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    if (await elementsHeading.isVisible().catch(() => false)) return;

    if (await retryProjectButton.isVisible().catch(() => false)) {
      throw new Error("AI Studio did not finish loading: retry project/workspace state is visible.");
    }

    if (await elementsButton.isVisible().catch(() => false)) {
      await elementsButton.click({ timeout: 10_000 });
      await elementsHeading.waitFor({ timeout: 20_000 });
      return;
    }

    await page.waitForTimeout(500);
  }

  throw new Error("Timed out waiting for the Elements panel to become ready.");
}

async function createLocalDraft(page) {
  const createButton = page.getByRole("button", { name: "+ Create" }).first();
  await createButton.waitFor({ timeout: 20_000 });
  await createButton.click({ timeout: 10_000 });
  await page.getByLabel("Element editor").waitFor({ timeout: 20_000 });
  await page.getByText("Detail Shot").waitFor({ timeout: 20_000 });
}

async function readElementsLayoutSnapshot(page) {
  return page.evaluate(() => {
    const editor = document.querySelector("[aria-label='Element editor']");
    const referencesTitle = Array.from(
      document.querySelectorAll(".elements-editor-column-panel .input-label")
    ).find((node) => node.textContent?.trim() === "References");
    const descriptionTitle = Array.from(
      document.querySelectorAll(".elements-editor-column-panel .input-label")
    ).find((node) => node.textContent?.trim() === "Description:");
    const referenceCards = Array.from(document.querySelectorAll(".elements-reference-card"));
    const detailShotLabel = Array.from(document.querySelectorAll(".elements-reference-empty-hint"))
      .map((node) => node.textContent?.trim())
      .includes("Detail Shot");
    const counterInsideDescription = Boolean(
      document.querySelector(".elements-description-text-container .elements-description-count")
    );
    const chipViewport = document.querySelector(".elements-manage-chip-container");
    const chipList = document.querySelector(".elements-manage-list");

    if (!(editor instanceof HTMLElement)) {
      throw new Error("Elements editor did not render.");
    }
    if (!(referencesTitle instanceof HTMLElement) || !(descriptionTitle instanceof HTMLElement)) {
      throw new Error("Required editor headings are missing.");
    }
    if (!(chipViewport instanceof HTMLElement) || !(chipList instanceof HTMLElement)) {
      throw new Error("Chip grid surface is missing.");
    }

    const viewportRect = chipViewport.getBoundingClientRect();
    const listStyle = window.getComputedStyle(chipList);
    const rowRects = Array.from(chipList.querySelectorAll(".elements-list-card")).map((node) =>
      node.getBoundingClientRect()
    );
    const firstRowTop = rowRects.length > 0 ? Math.min(...rowRects.map((rect) => rect.top)) : null;
    const firstRowRects =
      firstRowTop == null
        ? []
        : rowRects.filter((rect) => Math.abs(rect.top - firstRowTop) <= 2).sort((a, b) => a.left - b.left);
    const firstRowMetrics =
      firstRowRects.length > 0
        ? {
            leftGap: Number((firstRowRects[0].left - viewportRect.left).toFixed(2)),
            rightGap: Number((viewportRect.right - firstRowRects.at(-1).right).toFixed(2)),
            width: Number((firstRowRects.at(-1).right - firstRowRects[0].left).toFixed(2)),
          }
        : null;

    return {
      referenceCount: referenceCards.length,
      detailShotLabel,
      referencesAboveDescription:
        referencesTitle.getBoundingClientRect().top < descriptionTitle.getBoundingClientRect().top,
      counterInsideDescription,
      hasEditorInnerPanel: Boolean(document.querySelector(".elements-editor-column-panel")),
      chipGrid: {
        justifyContent: listStyle.justifyContent,
        viewportWidth: Number(viewportRect.width.toFixed(2)),
        listWidth: Number(chipList.getBoundingClientRect().width.toFixed(2)),
        firstRowMetrics,
      },
    };
  });
}

function assertLayoutSnapshot(snapshot) {
  if (!snapshot.hasEditorInnerPanel) {
    throw new Error("Elements editor inner panel wrapper is missing.");
  }
  if (snapshot.referenceCount !== 3) {
    throw new Error(`Expected 3 reference cards, received ${snapshot.referenceCount}.`);
  }
  if (!snapshot.detailShotLabel) {
    throw new Error("Detail Shot slot label is missing.");
  }
  if (!snapshot.referencesAboveDescription) {
    throw new Error("References no longer renders above Description.");
  }
  if (!snapshot.counterInsideDescription) {
    throw new Error("Description counter is no longer inside the textarea container.");
  }
  if (snapshot.chipGrid.justifyContent !== "center") {
    throw new Error(
      `Chip grid justify-content regressed to ${snapshot.chipGrid.justifyContent}.`
    );
  }
  const firstRow = snapshot.chipGrid.firstRowMetrics;
  if (
    firstRow &&
    firstRow.width < snapshot.chipGrid.viewportWidth - 24 &&
    Math.abs(firstRow.leftGap - firstRow.rightGap) > 8
  ) {
    throw new Error(
      `Chip grid first-row centering drifted: left gap ${firstRow.leftGap}px vs right gap ${firstRow.rightGap}px.`
    );
  }
}

async function main() {
  const creds = loadAuditCredentials();
  if (!creds.email) {
    console.error("[elements-panel-layout.audit] PLAYWRIGHT_AUDIT_EMAIL is required.");
    process.exitCode = 1;
    return;
  }
  if (/@example\.com$/i.test(creds.email)) {
    console.error(
      "[elements-panel-layout.audit] PLAYWRIGHT_AUDIT_EMAIL cannot use @example.com. Use a dedicated real test account."
    );
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: { width: 1720, height: 980 } });
  const page = await context.newPage();
  const observers = await attachSurfaceObservers(page);

  try {
    await ensureSignedIn(page, BASE_URL, "/ai-studio", creds.email, creds.password);
    await openElementsPanel(page);
    await createLocalDraft(page);
    const snapshot = await readElementsLayoutSnapshot(page);
    assertLayoutSnapshot(snapshot);

    const severeSignals = summarizeSignals(observers.consoleEntries, observers.pageErrors);
    if (!severeSignals.ok) {
      throw new Error(
        `Severe runtime signals detected: ${JSON.stringify(severeSignals, null, 2)}`
      );
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          auditedAt: new Date().toISOString(),
          baseUrl: BASE_URL,
          finalUrl: page.url(),
          snapshot,
        },
        null,
        2
      )
    );
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error("[elements-panel-layout.audit] failed:", error);
  process.exitCode = 1;
});
