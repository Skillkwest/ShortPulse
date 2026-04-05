/* global require, process, Buffer, console, __dirname */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Expert Edit coordinate parity audit runner.
 *
 * Purpose:
 * 1. Provide a browser-backed baseline capture path for CP-004 matrix slices.
 * 2. Exercise real pointer interactions under DPR profiles and 4:3 viewport.
 * 3. Emit machine-readable JSON evidence for docs packets.
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE_URL = (process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000").trim();
const PAN_TARGETS = [
  { x: 0, y: 0 },
  { x: 37, y: -19 },
  { x: -120, y: 80 },
];
const DPR_PROFILES = [1, 2, 3];
const TARGET_ZOOM = 4;

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
    if (!key) continue;
    if (process.env[key] != null && process.env[key] !== "") continue;
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
  const frontendRoot = path.resolve(__dirname, "..", "..", "..");
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

async function ensureExpertEditMarkupStage(page) {
  await page.goto(`${BASE_URL}/ai-studio`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });

  const maybeClickByName = async (nameRegex) => {
    const button = page.getByRole("button", { name: nameRegex }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      await page.waitForTimeout(250);
      return true;
    }
    return false;
  };

  if (!(await page.getByRole("button", { name: /expand inpaint controls/i }).first().isVisible().catch(() => false))) {
    await maybeClickByName(/^Edit$/i);
    await maybeClickByName(/^Image$/i);
  }

  const expandInpaint = page.getByRole("button", { name: /expand inpaint controls/i }).first();
  await expandInpaint.waitFor({ timeout: 20_000 });
  await expandInpaint.click();

  const rail = page.getByLabel("Inpaint action tools");
  await rail.waitFor({ timeout: 20_000 });
  await rail.getByRole("button", { name: /^markup$/i }).click();

  const primaryDropzone = page.getByLabel("Primary composition surface").first();
  await primaryDropzone.waitFor({ timeout: 20_000 });

  const fileInput = page.locator('input[type="file"][accept="image/*"]').first();
  if (await fileInput.isVisible().catch(() => true)) {
    await fileInput.setInputFiles({
      name: "cp004-audit-reference.png",
      mimeType: "image/png",
      buffer: PNG_BUFFER,
    });
    await page.waitForTimeout(300);
  }

  const penButton = page.getByRole("button", { name: /^pen$/i }).first();
  if (await penButton.isVisible().catch(() => false)) {
    await penButton.click();
  }

  return { primaryDropzone };
}

async function readViewportState(page) {
  return page.evaluate(() => {
    const doc = globalThis.document;
    const HTMLElementCtor = globalThis.HTMLElement;
    const stage = doc.querySelector('[aria-label="Primary composition surface"]');
    if (!(stage instanceof HTMLElementCtor)) {
      return null;
    }
    const stageRect = stage.getBoundingClientRect();
    const stageShell = doc.querySelector(".edit-expert-primary-stage-shell");
    const viewport = doc.querySelector(".edit-expert-markup-viewport");
    const viewportTransform = viewport instanceof HTMLElementCtor ? viewport.style.transform : "";
    const stageShellTransform =
      stageShell instanceof HTMLElementCtor ? stageShell.style.transform : "";
    const transform = viewportTransform.trim() || stageShellTransform.trim() || "";
    const match = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px,\s*0\)\s*scale\(([-\d.]+)\)/.exec(
      transform
    );
    return {
      transform,
      offsetX: Number(match?.[1] ?? "0"),
      offsetY: Number(match?.[2] ?? "0"),
      scale: Number(match?.[3] ?? "1"),
      stageRect: {
        left: stageRect.left,
        top: stageRect.top,
        width: stageRect.width,
        height: stageRect.height,
      },
    };
  });
}

async function clearMarkupStrokesIfAvailable(page) {
  const clearButton = page.getByRole("button", { name: /clear markup strokes/i }).first();
  if (await clearButton.isVisible().catch(() => false)) {
    await clearButton.click();
    await page.waitForTimeout(120);
  }
}

async function recenterStage(page, stageBox) {
  const centerX = stageBox.x + stageBox.width / 2;
  const centerY = stageBox.y + stageBox.height / 2;

  await page.mouse.click(centerX, centerY, { button: "right" });
  const recenterItem = page.getByRole("menuitem", { name: /^recenter$/i }).first();
  if (await recenterItem.isVisible().catch(() => false)) {
    await recenterItem.click();
    await page.waitForTimeout(120);
    return;
  }

  const moveButton = page.getByRole("button", { name: /^move$/i }).first();
  if (await moveButton.isVisible().catch(() => false)) {
    await moveButton.click();
    const centerButton = page.getByRole("button", { name: /center move action/i }).first();
    if (await centerButton.isVisible().catch(() => false)) {
      await centerButton.click();
      await page.waitForTimeout(120);
    }
    const markupButton = page.getByRole("button", { name: /^markup$/i }).first();
    if (await markupButton.isVisible().catch(() => false)) {
      await markupButton.click();
      await page.waitForTimeout(120);
    }
  }
}

async function zoomToTarget(page, stageBox, targetScale) {
  const centerX = stageBox.x + stageBox.width / 2;
  const centerY = stageBox.y + stageBox.height / 2;

  for (let i = 0; i < 35; i += 1) {
    const state = await readViewportState(page);
    if (!state) return state;
    if (state.scale >= targetScale - 0.02) return state;
    await page.mouse.move(centerX, centerY);
    await page.mouse.wheel(0, -220);
    await page.waitForTimeout(30);
  }
  return readViewportState(page);
}

async function panToTargetOffset(page, stageBox, target) {
  const centerX = stageBox.x + stageBox.width / 2;
  const centerY = stageBox.y + stageBox.height / 2;

  for (let i = 0; i < 14; i += 1) {
    const state = await readViewportState(page);
    if (!state) return null;
    const dx = target.x - state.offsetX;
    const dy = target.y - state.offsetY;
    if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) {
      return state;
    }

    const stepX = Math.max(-120, Math.min(120, dx));
    const stepY = Math.max(-120, Math.min(120, dy));
    await page.mouse.move(centerX, centerY);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(centerX + stepX, centerY + stepY, { steps: 4 });
    await page.mouse.up({ button: "middle" });
    await page.waitForTimeout(40);
  }
  return readViewportState(page);
}

async function drawAndMeasurePointerToStroke(page, stageBox) {
  const targetClientX = stageBox.x + stageBox.width * 0.55;
  const targetClientY = stageBox.y + stageBox.height * 0.48;

  await page.mouse.move(targetClientX, targetClientY);
  await page.mouse.down({ button: "left" });
  await page.mouse.move(targetClientX + 1, targetClientY + 1, { steps: 2 });
  await page.mouse.up({ button: "left" });
  await page.waitForTimeout(120);

  return page.evaluate(({ targetClientX: cx, targetClientY: cy }) => {
    const doc = globalThis.document;
    const HTMLElementCtor = globalThis.HTMLElement;
    const SVGPolylineCtor = globalThis.SVGPolylineElement;
    const stage = doc.querySelector('[aria-label="Primary composition surface"]');
    if (!(stage instanceof HTMLElementCtor)) return { ok: false, reason: "missing_stage" };
    const stageRect = stage.getBoundingClientRect();

    const stageShell = doc.querySelector(".edit-expert-primary-stage-shell");
    const viewport = doc.querySelector(".edit-expert-markup-viewport");
    const transform =
      (viewport instanceof HTMLElementCtor ? viewport.style.transform : "").trim() ||
      (stageShell instanceof HTMLElementCtor ? stageShell.style.transform : "").trim() ||
      "translate3d(0px, 0px, 0) scale(1)";
    const match = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px,\s*0\)\s*scale\(([-\d.]+)\)/.exec(
      transform
    );
    const offsetX = Number(match?.[1] ?? "0");
    const offsetY = Number(match?.[2] ?? "0");
    const scale = Number(match?.[3] ?? "1");

    const polylines = Array.from(
      doc.querySelectorAll(".edit-expert-markup-strokes-overlay polyline")
    );
    const lastPolyline = polylines.at(-1);
    if (!(lastPolyline instanceof SVGPolylineCtor)) {
      return { ok: false, reason: "missing_polyline" };
    }
    const rawPoints = (lastPolyline.getAttribute("points") || "")
      .split(/\s+/)
      .map((pair) => pair.trim())
      .filter(Boolean);
    const tailPair = rawPoints.at(-1);
    if (!tailPair) {
      return { ok: false, reason: "missing_polyline_points" };
    }
    const [xRaw, yRaw] = tailPair.split(",");
    const scenePointX = Number.parseFloat(xRaw || "0");
    const scenePointY = Number.parseFloat(yRaw || "0");

    const targetX = cx - stageRect.left;
    const targetY = cy - stageRect.top;
    const paintedVisibleX = scenePointX * scale + offsetX;
    const paintedVisibleY = scenePointY * scale + offsetY;
    const dx = paintedVisibleX - targetX;
    const dy = paintedVisibleY - targetY;
    const errorPx = Math.sqrt(dx * dx + dy * dy);

    return {
      ok: true,
      scale,
      offsetX,
      offsetY,
      targetX,
      targetY,
      paintedVisibleX,
      paintedVisibleY,
      dx,
      dy,
      errorPx,
    };
  }, { targetClientX, targetClientY });
}

async function runProfile(browser, storageState, profile) {
  const context = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    deviceScaleFactor: profile,
    storageState,
  });
  const page = await context.newPage();

  const result = {
    dpr: profile,
    viewport: { width: 1200, height: 900 },
    stageAspectTarget: "4:3",
    startedAt: new Date().toISOString(),
    zoomTarget: TARGET_ZOOM,
    zoomReached: null,
    stageRect: null,
    panResults: [],
    errors: [],
  };

  try {
    const { primaryDropzone } = await ensureExpertEditMarkupStage(page);
    const stageBox = await primaryDropzone.boundingBox();
    if (!stageBox) {
      result.errors.push("missing_primary_dropzone_bounding_box");
      return result;
    }
    result.stageRect = {
      x: stageBox.x,
      y: stageBox.y,
      width: stageBox.width,
      height: stageBox.height,
      aspect: stageBox.height > 0 ? Number((stageBox.width / stageBox.height).toFixed(4)) : null,
    };

    await recenterStage(page, stageBox);
    const zoomState = await zoomToTarget(page, stageBox, TARGET_ZOOM);
    result.zoomReached = zoomState?.scale ?? null;

    for (const target of PAN_TARGETS) {
      await recenterStage(page, stageBox);
      const panState = await panToTargetOffset(page, stageBox, target);
      await clearMarkupStrokesIfAvailable(page);
      const draw = await drawAndMeasurePointerToStroke(page, stageBox);
      result.panResults.push({
        target,
        observed: panState
          ? {
              offsetX: Number((panState.offsetX || 0).toFixed(3)),
              offsetY: Number((panState.offsetY || 0).toFixed(3)),
              scale: Number((panState.scale || 0).toFixed(4)),
            }
          : null,
        draw,
      });
    }
  } catch (error) {
    result.errors.push(String(error?.message || error));
  } finally {
    await context.close();
  }

  return result;
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
      const profileResult = await runProfile(browser, storageState, dpr);
      output.profiles.push(profileResult);
    }

    output.ok = output.profiles.every(
      (profile) => (profile.errors?.length ?? 0) === 0 && Number.isFinite(profile.zoomReached ?? NaN)
    );
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    console.error("[expert-edit-coordinate-parity.audit] fatal:", error);
    process.exitCode = 1;
  } finally {
    await authContext.close();
    await browser.close();
  }
}

main();
