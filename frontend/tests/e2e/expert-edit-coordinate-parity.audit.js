/* global require, process, Buffer, console, __dirname */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Expert Edit launch-surface browser audit.
 *
 * Purpose:
 * 1. Verify the deployed/browser Expert Edit surface matches the active launch lock.
 * 2. Keep DPR coverage for the visible Standard-only edit stage.
 * 3. Avoid provider submit, generation, or server-mutating actions.
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE_URL = (process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000").trim();
const DPR_PROFILES = [1, 2, 3];
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7ZlJ0AAAAASUVORK5CYII=";
const PNG_BUFFER = Buffer.from(PNG_BASE64, "base64");

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

function loadAuditCredentials() {
  const frontendRoot = path.resolve(__dirname, "..", "..");
  const repoRoot = path.resolve(frontendRoot, "..");
  loadEnvFromFileIfNeeded(path.join(frontendRoot, ".env.local"));
  loadEnvFromFileIfNeeded(path.join(repoRoot, ".env.agent.local"));
  const email = (process.env.PLAYWRIGHT_AUDIT_EMAIL || "").trim();
  const password = (process.env.PLAYWRIGHT_AUDIT_PASSWORD || "").trim() || "AuditPass!12345";
  return { email, password };
}

async function signIn(page, email, password) {
  const signInTab = page.getByRole("tab", { name: /^Sign in$/i }).first();
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

async function ensureExpertEditLaunchSurface(page) {
  await page.goto(`${BASE_URL}/ai-studio`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });

  await page.locator(".ai-studio-page").waitFor({ timeout: 45_000 });
  const editButton = page.getByRole("button", { name: /^Edit$/i }).first();
  await editButton.waitFor({ timeout: 20_000 });
  await editButton.click();

  const primaryStage = page.getByLabel("Primary edit stage").first();
  await primaryStage.waitFor({ timeout: 20_000 });

  const fileInput = page.locator('input[type="file"][accept="image/*"]').first();
  if (await fileInput.count()) {
    await fileInput.setInputFiles({
      name: "expert-edit-launch-audit-reference.png",
      mimeType: "image/png",
      buffer: PNG_BUFFER,
    });
    await page.waitForTimeout(300);
  }

  return { primaryStage };
}

async function readLaunchSurfaceSnapshot(page) {
  return page.evaluate(() => {
    const doc = globalThis.document;
    const HTMLElementCtor = globalThis.HTMLElement;
    const ElementCtor = globalThis.Element;
    const visible = (element) => {
      if (!(element instanceof HTMLElementCtor)) return false;
      const style = globalThis.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const textOf = (element) =>
      (element.getAttribute("aria-label") || element.textContent || "").replace(/\s+/g, " ").trim();

    const primaryStage =
      doc.querySelector('[aria-label="Primary edit stage"]') ||
      doc.querySelector(".edit-expert-primary-stage-shell") ||
      doc.querySelector(".edit-expert-primary-column");
    const stageRect =
      primaryStage instanceof ElementCtor ? primaryStage.getBoundingClientRect() : null;
    const transformOverlay =
      doc.querySelector('[data-testid="edit-expert-transform-overlay-inline"]') ||
      doc.querySelector(".edit-expert-primary-layer-selection-overlay");
    const transformChromeLayer = doc.querySelector(".edit-expert-transform-chrome-layer");
    const renderClip = doc.querySelector(".edit-expert-stage-render-clip");
    const compositionSurface = doc.querySelector(".edit-expert-primary-composition-surface");
    const compositionRect =
      compositionSurface instanceof ElementCtor ? compositionSurface.getBoundingClientRect() : null;
    const transformHandleSnapshots = Array.from(
      doc.querySelectorAll(".edit-expert-primary-layer-selection-handle")
    ).map((handle) => {
      const rect = handle.getBoundingClientRect();
      const center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      const points = [
        center,
        { x: rect.left + 1, y: center.y },
        { x: rect.right - 1, y: center.y },
        { x: center.x, y: rect.top + 1 },
        { x: center.x, y: rect.bottom - 1 },
      ].filter(
        (point) =>
          point.x >= 0 &&
          point.y >= 0 &&
          point.x <= globalThis.innerWidth &&
          point.y <= globalThis.innerHeight
      );
      const hitPoints = points.filter((point) => {
        const hit = doc.elementFromPoint(point.x, point.y);
        return (
          hit === handle ||
          Boolean(hit?.closest?.(".edit-expert-primary-layer-selection-handle") === handle)
        );
      });
      const outsideCompositionPoints =
        compositionRect == null
          ? []
          : points.filter(
              (point) =>
                point.x < compositionRect.left ||
                point.x > compositionRect.right ||
                point.y < compositionRect.top ||
                point.y > compositionRect.bottom
            );
      const outsideCompositionHitPoints = outsideCompositionPoints.filter((point) => {
        const hit = doc.elementFromPoint(point.x, point.y);
        return (
          hit === handle ||
          Boolean(hit?.closest?.(".edit-expert-primary-layer-selection-handle") === handle)
        );
      });
      return {
        className: handle.className,
        rect: {
          left: Math.round(rect.left * 100) / 100,
          top: Math.round(rect.top * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
        },
        visible: visible(handle),
        hitPointCount: hitPoints.length,
        testedPointCount: points.length,
        outsideCompositionPointCount: outsideCompositionPoints.length,
        outsideCompositionHitPointCount: outsideCompositionHitPoints.length,
      };
    });
    const visibleButtons = Array.from(doc.querySelectorAll("button"))
      .filter(visible)
      .map(textOf)
      .filter(Boolean);
    const bodyText = doc.body.innerText.replace(/\s+/g, " ").trim();

    return {
      url: globalThis.location.href,
      hasAiStudioPage: Boolean(doc.querySelector(".ai-studio-page")),
      hasPrimaryEditStage: primaryStage instanceof ElementCtor,
      primaryStageSelector:
        primaryStage instanceof ElementCtor
          ? primaryStage.getAttribute("aria-label") ||
            primaryStage.className ||
            primaryStage.tagName
          : null,
      stageRect: stageRect
        ? {
            width: Math.round(stageRect.width * 100) / 100,
            height: Math.round(stageRect.height * 100) / 100,
            aspect:
              stageRect.height > 0
                ? Math.round((stageRect.width / stageRect.height) * 10000) / 10000
                : null,
          }
        : null,
      launchLock: {
        hidesSelectEditMode: !bodyText.includes("Select Edit Mode"),
        hidesGenerationModeTablist: !doc.querySelector(
          '[role="tablist"][aria-label*="generation" i]'
        ),
        hidesInpaintActionTools: !doc.querySelector('[aria-label="Inpaint action tools"]'),
      },
      controls: {
        hasGenerate: visibleButtons.some((label) => /^Generate$/i.test(label)),
        hasUndoMove: visibleButtons.some((label) => /undo move action/i.test(label)),
        hasRedoMove: visibleButtons.some((label) => /redo move action/i.test(label)),
        hasFlattenLayers: visibleButtons.some((label) => /flatten layers/i.test(label)),
        hasRemoveBackground: visibleButtons.some((label) => /remove background/i.test(label)),
      },
      transformChrome: {
        hasOverlay: transformOverlay instanceof ElementCtor,
        hasChromeLayer: transformChromeLayer instanceof ElementCtor,
        hasRenderClip: renderClip instanceof ElementCtor,
        overlayInsideRenderClip:
          transformOverlay instanceof ElementCtor
            ? Boolean(transformOverlay.closest(".edit-expert-stage-render-clip"))
            : null,
        overlayInsideCompositionSurface:
          transformOverlay instanceof ElementCtor
            ? Boolean(transformOverlay.closest(".edit-expert-primary-composition-surface"))
            : null,
        overlayInsideChromeCamera:
          transformOverlay instanceof ElementCtor
            ? Boolean(transformOverlay.closest(".edit-expert-stage-camera-layer--chrome"))
            : null,
        handleCount: transformHandleSnapshots.length,
        visibleHandleCount: transformHandleSnapshots.filter((handle) => handle.visible).length,
        hitVisibleHandleCount: transformHandleSnapshots.filter((handle) => handle.hitPointCount > 0)
          .length,
        outsideCompositionHitHandleCount: transformHandleSnapshots.filter(
          (handle) => handle.outsideCompositionHitPointCount > 0
        ).length,
        handles: transformHandleSnapshots,
      },
      visibleButtons: visibleButtons.slice(0, 60),
    };
  });
}

async function runProfile(browser, storageState, dpr) {
  const context = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    deviceScaleFactor: dpr,
    storageState,
  });
  const page = await context.newPage();
  const errors = [];

  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console:${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror:${error.message}`));

  try {
    await ensureExpertEditLaunchSurface(page);
    const snapshot = await readLaunchSurfaceSnapshot(page);
    const requiredSignals = [
      snapshot.hasAiStudioPage,
      snapshot.hasPrimaryEditStage,
      snapshot.stageRect?.width > 0,
      snapshot.stageRect?.height > 0,
      snapshot.launchLock.hidesSelectEditMode,
      snapshot.launchLock.hidesGenerationModeTablist,
      snapshot.launchLock.hidesInpaintActionTools,
      snapshot.controls.hasGenerate,
      snapshot.controls.hasUndoMove,
      snapshot.controls.hasRedoMove,
      snapshot.transformChrome.hasOverlay,
      snapshot.transformChrome.hasChromeLayer,
      snapshot.transformChrome.hasRenderClip,
      snapshot.transformChrome.overlayInsideRenderClip === false,
      snapshot.transformChrome.overlayInsideCompositionSurface === false,
      snapshot.transformChrome.overlayInsideChromeCamera,
      snapshot.transformChrome.handleCount === 4,
      snapshot.transformChrome.visibleHandleCount === 4,
      snapshot.transformChrome.hitVisibleHandleCount === 4,
      snapshot.transformChrome.outsideCompositionHitHandleCount > 0,
    ];
    return {
      dpr,
      viewport: { width: 1200, height: 900 },
      ok: requiredSignals.every(Boolean) && errors.length === 0,
      errors,
      snapshot,
    };
  } catch (error) {
    return {
      dpr,
      viewport: { width: 1200, height: 900 },
      ok: false,
      errors: [...errors, String(error?.message || error)],
      snapshot: null,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  const creds = loadAuditCredentials();
  if (!creds.email) {
    console.error(
      "[expert-edit-coordinate-parity.audit] PLAYWRIGHT_AUDIT_EMAIL is required (env or frontend/.env.local)."
    );
    process.exitCode = 1;
    return;
  }
  if (/@example\.com$/i.test(creds.email)) {
    console.error(
      "[expert-edit-coordinate-parity.audit] PLAYWRIGHT_AUDIT_EMAIL cannot use @example.com. Use a dedicated real test account."
    );
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const authContext = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const authPage = await authContext.newPage();
  const output = {
    ok: false,
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    auth: {
      reachedProtectedRoute: false,
      blockedReason: null,
    },
    profiles: [],
  };

  try {
    await authPage.goto(`${BASE_URL}/auth?next=/ai-studio`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await authPage.waitForTimeout(800);

    if (authPage.url().includes("/auth")) {
      await signIn(authPage, creds.email, creds.password);
      const reached = await waitForNonAuthRoute(authPage, 20_000);
      if (!reached) {
        output.auth.blockedReason = "auth_blocked_or_confirmation_required";
        console.log(JSON.stringify(output, null, 2));
        process.exitCode = 1;
        return;
      }
    }

    output.auth.reachedProtectedRoute = true;
    const storageState = await authContext.storageState();

    for (const dpr of DPR_PROFILES) {
      output.profiles.push(await runProfile(browser, storageState, dpr));
    }

    output.ok = output.profiles.every((profile) => profile.ok);
    console.log(JSON.stringify(output, null, 2));
    if (!output.ok) process.exitCode = 1;
  } catch (error) {
    console.error("[expert-edit-coordinate-parity.audit] fatal:", error);
    process.exitCode = 1;
  } finally {
    await authContext.close();
    await browser.close();
  }
}

main();
