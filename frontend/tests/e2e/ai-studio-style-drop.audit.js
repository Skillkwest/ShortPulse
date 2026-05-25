/* global require, process, console */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Lane C style-drop characterization audit runner.
 * Signs in to a dedicated account, seeds live Reference Grid items, performs real runtime drag/drop,
 * and prints one passing plus one failing packet summary for Reference Grid -> Styles.
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3100";
const AI_STUDIO_AUDIT_PATH = "/ai-studio?perfAuditRuntime=1";
const EMAIL = (process.env.PLAYWRIGHT_AUDIT_EMAIL || "").trim();
const PASSWORD = (process.env.PLAYWRIGHT_AUDIT_PASSWORD || "").trim() || "AuditPass!12345";
const BLOCKED_URL = "https://capture.invalid/c1-blocked-style.jpg";
const EXTRACT_SUCCESS_BODY = {
  stylePrompt: "cinematic portrait lighting, soft diffusion, polished editorial finish",
  styleTitle: "Cinematic Soft Diffusion",
  usage: {
    inputTokens: 1,
    outputTokens: 1,
  },
};
const TRANSFER_KEYS = [
  "text/reference-origin",
  "text/reference-version",
  "text/reference-id",
  "text/reference-output-id",
  "text/reference-media-id",
  "text/reference-image-index",
  "text/reference-source-surface",
  "text/reference-width",
  "text/reference-height",
  "text/reference-render-url",
  "text/reference-url",
  "text/plain",
  "text/prompt",
  "image/url",
  "text/uri-list",
];

async function signIn(page) {
  const signInTab = page.getByRole("tab", { name: /^Sign in$/i }).first();
  if (
    (await signInTab.isVisible().catch(() => false)) &&
    (await signInTab.getAttribute("aria-selected").catch(() => null)) !== "true"
  ) {
    await signInTab.click();
  }
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
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

async function ensureAiStudioPanels(page) {
  const maybeClick = async (name) => {
    const button = page.getByRole("button", { name }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      await page.waitForTimeout(250);
    }
  };

  const stylesPanel = page.getByRole("region", { name: "Styles library" }).first();
  if (!(await stylesPanel.isVisible().catch(() => false))) {
    await maybeClick(/^Styles$/i);
  }
  const referenceCard = page.locator(".reference-card").first();
  if (!(await referenceCard.isVisible().catch(() => false))) {
    await maybeClick(/^Reference Grid$/i);
  }

  await stylesPanel.waitFor({ timeout: 10_000 });
  await referenceCard.waitFor({ timeout: 10_000 });
}

async function runScenario(page, scenarioName, seedItem) {
  const captured = {
    telemetryRequests: [],
    serverCopyRequests: [],
    serverCopyResponses: [],
  };

  const onRequest = (request) => {
    const url = request.url();
    if (url.endsWith("/api/log/client-error")) {
      const payload = request.postDataJSON?.() ?? null;
      if (payload?.source === "telemetry.ai_studio.style_extraction") {
        captured.telemetryRequests.push(payload);
      }
      return;
    }
    if (url.endsWith("/api/media/copy-from-url")) {
      captured.serverCopyRequests.push({
        method: request.method(),
        payload: request.postDataJSON?.() ?? null,
      });
    }
  };
  const onResponse = async (response) => {
    const url = response.url();
    if (!url.endsWith("/api/media/copy-from-url")) return;
    let body = null;
    try {
      body = await response.json();
    } catch {
      try {
        body = await response.text();
      } catch {
        body = null;
      }
    }
    captured.serverCopyResponses.push({
      status: response.status(),
      body,
    });
  };

  page.on("request", onRequest);
  page.on("response", onResponse);

  try {
    await page.evaluate(
      ({ item }) => {
        globalThis.__shortpulseAiStudioPerf.seedReferenceGridItems([item]);
      },
      { item: seedItem }
    );

    await ensureAiStudioPanels(page);

    const packet = await page.evaluate(
      ({ transferKeys }) => {
        const doc = globalThis.document;
        const HTMLElementCtor = globalThis.HTMLElement;
        const DataTransferCtor = globalThis.DataTransfer;
        const DragEventCtor = globalThis.DragEvent;
        const card = doc.querySelector(".reference-card");
        const stylesPanel = doc.querySelector("[aria-label='Styles library']");
        if (!(card instanceof HTMLElementCtor) || !(stylesPanel instanceof HTMLElementCtor)) {
          throw new Error("Required style-drop surfaces are not present.");
        }

        const transfer = new DataTransferCtor();
        const dragStartEvent = new DragEventCtor("dragstart", {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        });
        card.dispatchEvent(dragStartEvent);

        const payload = {};
        for (const key of transferKeys) {
          payload[key] = transfer.getData(key);
        }

        stylesPanel.dispatchEvent(
          new DragEventCtor("dragenter", {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer,
          })
        );
        stylesPanel.dispatchEvent(
          new DragEventCtor("dragover", {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer,
          })
        );
        stylesPanel.dispatchEvent(
          new DragEventCtor("drop", {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer,
          })
        );

        return {
          transferTypes: Array.from(transfer.types || []),
          payload,
        };
      },
      { transferKeys: TRANSFER_KEYS }
    );

    await page.waitForTimeout(5_000);

    const ui = await page.evaluate(() => ({
      dropErrorText:
        globalThis.document.querySelector(".styles-library-drop-error")?.textContent?.trim() ??
        null,
      processingVisible: Boolean(
        globalThis.document.querySelector(".styles-library-processing-tile")
      ),
      processingStatus:
        globalThis.document
          .querySelector(".styles-library-drop-status-processing")
          ?.textContent?.trim() ?? null,
      tileCount: globalThis.document.querySelectorAll(".styles-library-tile").length,
    }));

    const telemetry = captured.telemetryRequests.at(-1) ?? null;
    const serverCopyRequest = captured.serverCopyRequests.at(-1) ?? null;
    const serverCopyResponse = captured.serverCopyResponses.at(-1) ?? null;

    return {
      scenario: scenarioName,
      capturedAt: new Date().toISOString(),
      transfer: packet,
      telemetry: telemetry
        ? {
            message: telemetry.message,
            metadata: telemetry.metadata,
          }
        : null,
      serverCopy: {
        attempted: captured.serverCopyRequests.length > 0,
        request: serverCopyRequest,
        response: serverCopyResponse,
      },
      ui,
    };
  } finally {
    page.off("request", onRequest);
    page.off("response", onResponse);
  }
}

async function main() {
  if (!EMAIL) {
    console.error("[ai-studio-style-drop.audit] PLAYWRIGHT_AUDIT_EMAIL is required.");
    process.exitCode = 1;
    return;
  }
  if (/@example\.com$/i.test(EMAIL)) {
    console.error(
      "[ai-studio-style-drop.audit] PLAYWRIGHT_AUDIT_EMAIL cannot use @example.com. Use a dedicated real test account."
    );
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1720, height: 980 } });
  const page = await context.newPage();

  await context.route("**/api/ai/extract-style", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "x-shortpulse-style-attempt-count": "1",
        "x-shortpulse-style-probe-ms": "1",
        "x-shortpulse-style-openai-ms": "1",
        "x-shortpulse-style-model-used": "lane-c-audit-stub",
      },
      body: JSON.stringify(EXTRACT_SUCCESS_BODY),
    });
  });
  await context.route("**/c1-blocked-style.jpg", async (route) => {
    await route.abort("failed");
  });

  const result = {
    ok: false,
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    auth: {
      reachedProtectedRoute: false,
      blockedReason: null,
    },
    packets: [],
  };

  try {
    await page.goto(`${BASE_URL}/auth?next=${encodeURIComponent(AI_STUDIO_AUDIT_PATH)}`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.waitForTimeout(1000);

    if (page.url().includes("/auth")) {
      await signIn(page);
      const reached = await waitForNonAuthRoute(page, 20_000);
      if (!reached) {
        result.auth.blockedReason = "auth_blocked_or_confirmation_required";
        console.log(JSON.stringify(result, null, 2));
        process.exitCode = 1;
        return;
      }
    }

    result.auth.reachedProtectedRoute = true;

    await page.goto(`${BASE_URL}${AI_STUDIO_AUDIT_PATH}`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.waitForFunction(
      () => typeof globalThis.__shortpulseAiStudioPerf?.seedReferenceGridItems === "function",
      { timeout: 45_000 }
    );

    const passingPacket = await runScenario(page, "passing_internal_data_url", {
      id: "lane-c-pass-1",
      prompt: "lane c passing prompt",
      mode: "image",
      previewUrl:
        "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%230f6fff'/%3E%3Ccircle cx='32' cy='32' r='18' fill='%23ffffff' fill-opacity='0.32'/%3E%3C/svg%3E",
      previewStoragePath: null,
      fullStoragePath: null,
      savedMediaIds: null,
      mediaSource: "generated",
    });

    const failingPacket = await runScenario(page, "failing_external_blocked_source", {
      id: "lane-c-fail-1",
      prompt: "lane c failing prompt",
      mode: "image",
      previewUrl: BLOCKED_URL,
      previewStoragePath: null,
      fullStoragePath: null,
      savedMediaIds: null,
      mediaSource: "generated",
    });

    result.packets.push(passingPacket, failingPacket);
    result.ok = true;
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("[ai-studio-style-drop.audit] fatal:", error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
