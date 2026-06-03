/* global require, process, console, __dirname, fetch */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Built-in Pulse contract browser audit.
 * Signs in with the dedicated audit account, loads the live built-in Pulse catalog,
 * activates a real built-in from the Pulse Catalog surface, intercepts the Pulse route request,
 * and verifies the browser request stays on the built-in/server-authoritative contract.
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const DEFAULT_BASE_URL = (process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000").trim();
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== "false";
const TARGET_PRESET_ID = (process.env.PULSE_BUILTIN_PRESET_ID || "image").trim();

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

async function openPulseCatalog(page) {
  const catalogButton = page.getByRole("button", { name: "Pulse Catalog" }).first();
  const catalogRegion = page.getByRole("region", { name: "Pulse Catalog", exact: true }).first();
  await catalogButton.waitFor({ timeout: 20_000 });
  await catalogButton.click();
  await catalogRegion.waitFor({ timeout: 10_000 });
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
  await page.getByRole("button", { name: "Pulse Catalog" }).waitFor({ timeout: 20_000 });
}

async function verifyPulsePersistsOutsideCreate(page, activationMessageText) {
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
  const activationMessage = page.getByText(activationMessageText).first();

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

async function readBuiltInCatalog(page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/ai/create-pulse-builtins", {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const payload = await response.json().catch(() => null);
    return {
      ok: response.ok,
      status: response.status,
      payload,
    };
  });
}

async function main() {
  const email = (process.env.PLAYWRIGHT_AUDIT_EMAIL || "").trim();
  if (!email) {
    console.error(
      "[pulse-builtin-contract.audit] PLAYWRIGHT_AUDIT_EMAIL is required. Refusing to auto-create test users."
    );
    process.exitCode = 1;
    return;
  }
  if (/@example\.com$/i.test(email)) {
    console.error(
      "[pulse-builtin-contract.audit] PLAYWRIGHT_AUDIT_EMAIL cannot use @example.com. Use a dedicated real test account."
    );
    process.exitCode = 1;
    return;
  }
  const password = (process.env.PLAYWRIGHT_AUDIT_PASSWORD || "").trim() || "AuditPass!12345";
  const userTurn = "Use a lone silhouetted rider as the subject.";

  const out = {
    ok: false,
    baseUrl: DEFAULT_BASE_URL,
    targetPresetId: TARGET_PRESET_ID,
    targetPresetLabel: null,
    auth: {
      reachedProtectedRoute: false,
    },
    catalogChecks: {
      routeOk: false,
      controlPlaneSource: false,
      degradedFalse: false,
      targetPresetFound: false,
      systemInstructionsHidden: false,
    },
    requestChecks: {
      activationSeen: false,
      followupSeen: false,
      runtimeModePulse: false,
      builtinSource: false,
      guidedPulseKind: false,
      targetPresetIdMatches: false,
      browserInstructionsHidden: false,
      guidedMetadataPresent: false,
      followupMessageMatches: false,
    },
    requestSummaries: [],
    ui: {
      activationMessageSeen: false,
      followupMessageSeen: false,
      persistsOnLeaveCreateVerified: false,
    },
    screenshots: {
      final: "/tmp/shortpulse-pulse-builtin-contract-final.png",
      failure: "/tmp/shortpulse-pulse-builtin-contract-failure.png",
    },
    errors: [],
  };

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
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
      out.requestChecks.builtinSource = pulseContext?.source === "builtin";
      out.requestChecks.guidedPulseKind = pulseContext?.pulseKind === "guided_workflow";
      out.requestChecks.targetPresetIdMatches = pulseContext?.presetId === TARGET_PRESET_ID;
      out.requestChecks.browserInstructionsHidden =
        typeof pulseContext?.instructions === "string" &&
        pulseContext.instructions.trim().length === 0;
      out.requestChecks.guidedMetadataPresent =
        pulseContext?.runtimeMode === "workflow_gpt" &&
        typeof pulseContext?.activationMode === "string" &&
        typeof pulseContext?.outputMode === "string" &&
        typeof pulseContext?.memoryPolicy === "string";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "needs_input",
          message: "BUILTIN-PULSE-MARKER: upload the anchor image first.",
          actions: null,
          workflowSession: {
            presetId: TARGET_PRESET_ID,
            status: "awaiting_input",
            currentStepIndex: 1,
            currentStepLabel: "Step 1 — Upload",
            currentStepPrompt: "Upload the anchor image first.",
            collectedInputs: [],
            lastArtifact: null,
            finalArtifactSource: null,
          },
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
          status: "needs_input",
          message: "BUILTIN-PULSE-MARKER: what motion should the camera use?",
          actions: null,
          workflowSession: {
            presetId: TARGET_PRESET_ID,
            status: "awaiting_input",
            currentStepIndex: 2,
            currentStepLabel: "Step 2 — Motion",
            currentStepPrompt: "What motion should the camera use?",
            collectedInputs: ["Use a lone silhouetted rider as the subject."],
            lastArtifact: null,
            finalArtifactSource: null,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "needs_input",
        message: "BUILTIN-PULSE-MARKER: extra turn acknowledged.",
        actions: null,
        workflowSession: {
          presetId: TARGET_PRESET_ID,
          status: "awaiting_input",
          currentStepIndex: 2,
          currentStepLabel: "Step 2 — Motion",
          currentStepPrompt: "What motion should the camera use?",
          collectedInputs: [],
          lastArtifact: null,
          finalArtifactSource: null,
        },
      }),
    });
  });

  try {
    await ensureSignedIn(page, DEFAULT_BASE_URL, "/ai-studio", email, password);
    out.auth.reachedProtectedRoute = true;

    await ensurePulseMode(page);
    const catalog = await readBuiltInCatalog(page);
    out.catalogChecks.routeOk = catalog.ok === true && catalog.status === 200;
    out.catalogChecks.controlPlaneSource = catalog.payload?.source === "control_plane";
    out.catalogChecks.degradedFalse = catalog.payload?.degraded === false;

    const targetPreset = Array.isArray(catalog.payload?.builtInDefinitions)
      ? catalog.payload.builtInDefinitions.find((entry) => entry?.presetId === TARGET_PRESET_ID)
      : null;
    out.catalogChecks.targetPresetFound = Boolean(targetPreset);
    out.catalogChecks.systemInstructionsHidden =
      targetPreset != null &&
      !Object.prototype.hasOwnProperty.call(targetPreset, "systemInstructions");
    out.targetPresetLabel =
      typeof targetPreset?.label === "string" && targetPreset.label.trim().length > 0
        ? targetPreset.label.trim()
        : null;

    if (!out.targetPresetLabel) {
      throw new Error(
        `Built-in preset ${TARGET_PRESET_ID} was not available from the live catalog.`
      );
    }

    await openPulseCatalog(page);
    await page.getByRole("button", { name: out.targetPresetLabel, exact: true }).click();
    await page
      .getByRole("region", { name: "Pulse Catalog", exact: true })
      .first()
      .waitFor({ state: "hidden", timeout: 10_000 });

    await page.getByText("BUILTIN-PULSE-MARKER: upload the anchor image first.").waitFor({
      timeout: 10_000,
    });
    out.ui.activationMessageSeen = true;

    const agentTextarea = page.locator('textarea[placeholder="Message the agent..."]').first();
    await agentTextarea.fill(userTurn);
    await page.getByRole("button", { name: "Send to agent" }).first().click();
    await page.getByText("BUILTIN-PULSE-MARKER: what motion should the camera use?").waitFor({
      timeout: 10_000,
    });
    out.ui.followupMessageSeen = true;
    out.ui.persistsOnLeaveCreateVerified = await verifyPulsePersistsOutsideCreate(
      page,
      "BUILTIN-PULSE-MARKER: upload the anchor image first."
    );

    await page.screenshot({ path: out.screenshots.final, fullPage: true });
    out.ok =
      out.auth.reachedProtectedRoute &&
      Object.values(out.catalogChecks).every(Boolean) &&
      Object.values(out.requestChecks).every(Boolean) &&
      out.ui.activationMessageSeen &&
      out.ui.followupMessageSeen &&
      out.ui.persistsOnLeaveCreateVerified;
  } catch (error) {
    out.errors.push(error instanceof Error ? error.message : String(error));
    await page.screenshot({ path: out.screenshots.failure, fullPage: true }).catch(() => {});
    out.ok = false;
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify(out, null, 2));
  if (!out.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    `[pulse-builtin-contract.audit] ${error instanceof Error ? error.stack || error.message : String(error)}`
  );
  process.exitCode = 1;
});
