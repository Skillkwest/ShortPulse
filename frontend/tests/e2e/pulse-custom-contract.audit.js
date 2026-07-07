/* global require, process, console, __dirname */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Custom Pulse contract browser audit.
 * While custom Pulse creation is deferred, verifies the creation affordance stays hidden.
 * When PULSE_CUSTOM_CREATION_DEFERRED=false, runs the full minimal custom-Pulse contract audit.
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const DEFAULT_BASE_URL = (process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000").trim();
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== "false";
const CUSTOM_PULSE_CREATION_DEFERRED = process.env.PULSE_CUSTOM_CREATION_DEFERRED !== "false";
const normalizeWhitespace = (value) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

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

loadAuditEnv();

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

async function ensureSignedIn(page, baseUrl, targetPath, email, password) {
  await page.goto(`${baseUrl}/auth?next=${encodeURIComponent(targetPath)}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.waitForTimeout(1_000);

  if (page.url().includes("/auth")) {
    await signIn(page, email, password);
    const reached = await waitForNonAuthRoute(page, 20_000);
    if (!reached) {
      throw new Error(`Auth did not reach protected route for ${targetPath}`);
    }
  }

  await page.goto(`${baseUrl}${targetPath}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
}

async function getPulseCatalogRegion(page) {
  const currentRegion = page.getByRole("region", { name: "Pulses", exact: true }).first();
  const legacyRegion = page.getByRole("region", { name: "Pulse Catalog", exact: true }).first();
  if (await currentRegion.isVisible().catch(() => false)) return currentRegion;
  return legacyRegion;
}

async function openPulseCatalog(page) {
  const catalogRegion = await getPulseCatalogRegion(page);
  if (await catalogRegion.isVisible().catch(() => false)) return catalogRegion;

  const currentButton = page.getByRole("button", { name: /^more pulses$/i }).first();
  const legacyButton = page.getByRole("button", { name: "Pulse Catalog" }).first();
  const trigger = (await currentButton.isVisible().catch(() => false))
    ? currentButton
    : legacyButton;
  await trigger.waitFor({ timeout: 20_000 });
  await trigger.click();
  await Promise.any([
    page.getByRole("region", { name: "Pulses", exact: true }).first().waitFor({ timeout: 10_000 }),
    page
      .getByRole("region", { name: "Pulse Catalog", exact: true })
      .first()
      .waitFor({ timeout: 10_000 }),
  ]);
  return await getPulseCatalogRegion(page);
}

async function openPulseLibrary(page) {
  const inlineLibrary = page.locator('section[aria-label="Pulse Library"]').first();
  const dialogLibrary = page.locator('[role="dialog"][aria-label="Pulse Library"]').first();
  const libraryButton = page.getByRole("button", { name: /^pulse library$/i }).first();

  if (await inlineLibrary.isVisible().catch(() => false)) {
    return { root: inlineLibrary, isDialog: false };
  }
  if (await dialogLibrary.isVisible().catch(() => false)) {
    return { root: dialogLibrary, isDialog: true };
  }

  if (!(await libraryButton.isVisible().catch(() => false))) {
    await openPulseCatalog(page);
    if (await inlineLibrary.isVisible().catch(() => false)) {
      return { root: inlineLibrary, isDialog: false };
    }
  }

  await libraryButton.waitFor({ timeout: 10_000 });
  await libraryButton.click();
  await Promise.any([
    dialogLibrary.waitFor({ timeout: 10_000 }),
    inlineLibrary.waitFor({ timeout: 10_000 }),
  ]);

  if (await dialogLibrary.isVisible().catch(() => false)) {
    return { root: dialogLibrary, isDialog: true };
  }
  return { root: inlineLibrary, isDialog: false };
}

async function ensurePulseMode(page) {
  const createButton = page.locator('.ai-toolbar [data-tool-id="create"]').first();
  if (await createButton.isVisible().catch(() => false)) {
    await createButton.click();
    await page.waitForTimeout(300);
  }
  const pulseTab = page.getByRole("tab", { name: /^pulse$/i }).first();
  await pulseTab.waitFor({ timeout: 20_000 });
  if ((await pulseTab.getAttribute("aria-selected").catch(() => null)) !== "true") {
    await pulseTab.click();
  }
  await Promise.any([
    page.getByRole("region", { name: "Pulses", exact: true }).first().waitFor({ timeout: 20_000 }),
    page.getByRole("button", { name: "Pulse Catalog" }).waitFor({ timeout: 20_000 }),
    page
      .getByRole("button", { name: /^more pulses$/i })
      .first()
      .waitFor({ timeout: 20_000 }),
  ]);
}

async function verifyPulsePersistsOutsideCreate(page) {
  const presetsButton = page
    .locator(".toolbar-libraries button")
    .filter({ hasText: "Presets" })
    .first();
  await presetsButton.waitFor({ timeout: 10_000 });
  await presetsButton.click();
  await page
    .locator('section.merged-presets-library-panel[aria-label="Presets library"]')
    .first()
    .waitFor({ timeout: 10_000 });

  const createButton = page.locator('.ai-toolbar [data-tool-id="create"]').first();
  await createButton.waitFor({ timeout: 10_000 });
  await createButton.click();

  const standardTab = page.getByRole("tab", { name: /^standard$/i }).first();
  const pulseTab = page.getByRole("tab", { name: /^pulse$/i }).first();
  await standardTab.waitFor({ timeout: 10_000 });
  const deactivatePulseButton = page.getByRole("button", { name: /^deactivate pulse$/i }).first();
  const activationMessage = page.getByText("CUSTOM-PULSE-MARKER: activation acknowledged.").first();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const standardSelected = await standardTab.getAttribute("aria-selected").catch(() => null);
    const pulseSelected = await pulseTab.getAttribute("aria-selected").catch(() => null);
    const deactivatePulseVisible = await deactivatePulseButton.isVisible().catch(() => false);
    const activationMessageVisible = await activationMessage.isVisible().catch(() => false);

    if (
      standardSelected !== "true" &&
      pulseSelected === "true" &&
      deactivatePulseVisible &&
      activationMessageVisible
    ) {
      return true;
    }
    await page.waitForTimeout(200);
  }

  return false;
}

async function createCustomPulse(page, pulseLabel, systemInstructions) {
  const { root: libraryRoot, isDialog } = await openPulseLibrary(page);
  await libraryRoot.getByRole("button", { name: "Create new pulse" }).click();

  const createDialog = page.getByRole("dialog", { name: /create .* pulse preset/i });
  await createDialog.waitFor({ timeout: 10_000 });
  await createDialog.getByLabel("Preset Name").fill(pulseLabel);
  await createDialog.getByLabel("System Instructions").fill(systemInstructions);
  await createDialog.getByRole("button", { name: "Create" }).click();

  await libraryRoot
    .getByRole("button", { name: `Inspect pulse preset tile: ${pulseLabel}` })
    .waitFor({
      timeout: 10_000,
    });
  if (isDialog) {
    await page.getByRole("button", { name: "Close Pulse Library" }).click();
    await page
      .getByRole("dialog", { name: "Pulse Library" })
      .waitFor({ state: "hidden", timeout: 10_000 });
  }
}

async function verifyCustomPulseCreationDeferred(page) {
  const { root: libraryRoot, isDialog } = await openPulseLibrary(page);
  const createButton = libraryRoot.getByRole("button", { name: "Create new pulse" });
  const isCreateButtonVisible = await createButton.isVisible().catch(() => false);
  if (isDialog) {
    const closeButton = page.getByRole("button", { name: "Close Pulse Library" }).first();
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();
    }
  }
  return !isCreateButtonVisible;
}

async function cleanupCustomPulse(page, pulseLabel) {
  try {
    const { root: libraryRoot } = await openPulseLibrary(page);
    const deleteButton = libraryRoot.getByRole("button", {
      name: `Delete pulse preset: ${pulseLabel}`,
    });
    if (await deleteButton.isVisible().catch(() => false)) {
      await deleteButton.click();
      const confirmDelete = page.getByRole("button", { name: "Delete" }).last();
      await confirmDelete.click();
      await deleteButton.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
    }
    const closeButton = page.getByRole("button", { name: "Close Pulse Library" }).first();
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();
    }
  } catch {
    // Best-effort cleanup only.
  }
}

async function main() {
  const email = (process.env.PLAYWRIGHT_AUDIT_EMAIL || "").trim();
  if (!email) {
    console.error(
      "[pulse-custom-contract.audit] PLAYWRIGHT_AUDIT_EMAIL is required. Refusing to auto-create test users."
    );
    process.exitCode = 1;
    return;
  }
  if (/@example\.com$/i.test(email)) {
    console.error(
      "[pulse-custom-contract.audit] PLAYWRIGHT_AUDIT_EMAIL cannot use @example.com. Use a dedicated real test account."
    );
    process.exitCode = 1;
    return;
  }
  const password = (process.env.PLAYWRIGHT_AUDIT_PASSWORD || "").trim() || "AuditPass!12345";
  const runId = `${Date.now()}`;
  const pulseLabel = `Contract Pulse ${runId.slice(-6)}`;
  const systemInstructions =
    'Reply in exactly one sentence that begins with "CUSTOM-PULSE-MARKER:" and stay concise.';
  const userTurn = "Give me a quick reply.";
  const activationSeedFragments = [
    `Pulse "${pulseLabel}" was just activated.`,
    "Reply according to the active Pulse instructions.",
    "If the instructions define startup behavior, run it only on the first assistant turn of this session.",
  ];

  const out = {
    ok: false,
    baseUrl: DEFAULT_BASE_URL,
    pulseLabel,
    auth: {
      reachedProtectedRoute: false,
    },
    requestChecks: {
      activationSeen: false,
      followupSeen: false,
      customPulseKind: false,
      customSource: false,
      instructionsMatch: false,
      guidedMetadataAbsent: false,
      runtimeModePulse: false,
      activationSeedMatches: false,
      followupMessageMatches: false,
    },
    requestSummaries: [],
    ui: {
      activationMessageSeen: false,
      followupMessageSeen: false,
      persistsOnLeaveCreateVerified: false,
    },
    deferredCustomPulseCreation: {
      enabled: CUSTOM_PULSE_CREATION_DEFERRED,
      createButtonHidden: false,
    },
    screenshots: {
      final: "/tmp/shortpulse-pulse-custom-contract-final.png",
      failure: "/tmp/shortpulse-pulse-custom-contract-failure.png",
    },
    errors: [],
  };

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  let createdPreset = false;
  let pulseRequestCount = 0;

  await page.route("**/api/ai/studio-agent-pulse", async (route) => {
    pulseRequestCount += 1;
    const request = route.request();
    let parsedBody = null;
    try {
      parsedBody = request.postDataJSON();
    } catch {
      parsedBody = null;
    }

    const lastMessage =
      Array.isArray(parsedBody?.messages) && parsedBody.messages.length > 0
        ? parsedBody.messages[parsedBody.messages.length - 1]
        : null;
    const pulseContext = parsedBody?.context?.pulse ?? null;
    out.requestSummaries.push({
      count: pulseRequestCount,
      runtimeMode: parsedBody?.runtimeMode ?? null,
      lastMessage,
      pulseContext,
    });

    if (pulseRequestCount === 1) {
      out.requestChecks.activationSeen = true;
      out.requestChecks.runtimeModePulse = parsedBody?.runtimeMode === "pulse";
      const normalizedActivationSeed = normalizeWhitespace(lastMessage?.content);
      out.requestChecks.activationSeedMatches = activationSeedFragments.every((fragment) =>
        normalizedActivationSeed.includes(normalizeWhitespace(fragment))
      );
      out.requestChecks.customPulseKind = pulseContext?.pulseKind === "custom_gpt";
      out.requestChecks.customSource = pulseContext?.source === "custom";
      out.requestChecks.instructionsMatch = pulseContext?.instructions === systemInstructions;
      out.requestChecks.guidedMetadataAbsent =
        !("artifactTarget" in (pulseContext ?? {})) &&
        !("starterAssistantMessage" in (pulseContext ?? {})) &&
        !("workflowStageHints" in (pulseContext ?? {})) &&
        !("runtimeMode" in (pulseContext ?? {})) &&
        !("activationMode" in (pulseContext ?? {})) &&
        !("outputMode" in (pulseContext ?? {})) &&
        !("memoryPolicy" in (pulseContext ?? {}));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "CUSTOM-PULSE-MARKER: activation acknowledged.",
          actions: {},
        }),
      });
      return;
    }

    if (pulseRequestCount === 2) {
      out.requestChecks.followupSeen = true;
      out.requestChecks.followupMessageMatches = lastMessage?.content === userTurn;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "CUSTOM-PULSE-MARKER: follow-up acknowledged.",
          actions: {},
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "CUSTOM-PULSE-MARKER: extra turn acknowledged.",
        actions: {},
      }),
    });
  });

  try {
    await ensureSignedIn(page, DEFAULT_BASE_URL, "/ai-studio", email, password);
    out.auth.reachedProtectedRoute = true;

    await ensurePulseMode(page);
    if (CUSTOM_PULSE_CREATION_DEFERRED) {
      out.deferredCustomPulseCreation.createButtonHidden =
        await verifyCustomPulseCreationDeferred(page);
      await page.screenshot({ path: out.screenshots.final, fullPage: true });
      out.ok = out.auth.reachedProtectedRoute && out.deferredCustomPulseCreation.createButtonHidden;
      return;
    }

    await createCustomPulse(page, pulseLabel, systemInstructions);
    createdPreset = true;

    await ensurePulseMode(page);
    const pulseCatalog = await openPulseCatalog(page);
    await page.getByRole("button", { name: pulseLabel, exact: true }).click();
    await pulseCatalog.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => undefined);

    await page.getByText("CUSTOM-PULSE-MARKER: activation acknowledged.").waitFor({
      timeout: 10_000,
    });
    out.ui.activationMessageSeen = true;

    const agentTextarea = page.locator('textarea[placeholder="Message the agent..."]').first();
    await agentTextarea.fill(userTurn);
    await page.getByRole("button", { name: "Send to agent" }).first().click();
    await page.getByText("CUSTOM-PULSE-MARKER: follow-up acknowledged.").waitFor({
      timeout: 10_000,
    });
    out.ui.followupMessageSeen = true;
    out.ui.persistsOnLeaveCreateVerified = await verifyPulsePersistsOutsideCreate(page);

    await page.screenshot({ path: out.screenshots.final, fullPage: true });
    out.ok =
      out.auth.reachedProtectedRoute &&
      Object.values(out.requestChecks).every(Boolean) &&
      out.ui.activationMessageSeen &&
      out.ui.followupMessageSeen &&
      out.ui.persistsOnLeaveCreateVerified;
  } catch (error) {
    out.errors.push(error instanceof Error ? error.message : String(error));
    await page.screenshot({ path: out.screenshots.failure, fullPage: true }).catch(() => {});
    out.ok = false;
  } finally {
    if (createdPreset) {
      await cleanupCustomPulse(page, pulseLabel);
    }
    await browser.close();
  }

  console.log(JSON.stringify(out, null, 2));
  if (!out.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    `[pulse-custom-contract.audit] ${error instanceof Error ? error.stack || error.message : String(error)}`
  );
  process.exitCode = 1;
});
