/* global require, process, Buffer, console */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Character pipeline E2E audit runner.
 * Executes auth -> Character Manager create -> AI Studio character-mode submit and prints JSON findings.
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7ZlJ0AAAAASUVORK5CYII=";
const PNG_BUFFER = Buffer.from(PNG_BASE64, "base64");

async function maybeText(locator) {
  try {
    const text = await locator.first().textContent({ timeout: 1000 });
    return (text || "").trim();
  } catch {
    return "";
  }
}

async function waitForNonAuthRoute(page, timeoutMs) {
  try {
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function signIn(page, email, password) {
  const signInTab = page.getByRole("button", { name: /^Sign in$/i }).first();
  if (await signInTab.isVisible().catch(() => false)) {
    await signInTab.click();
  }
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /^Sign in$/i }).click();
}

async function main() {
  const runId = Date.now();
  const forcedEmail = (process.env.PLAYWRIGHT_AUDIT_EMAIL || "").trim();
  if (!forcedEmail) {
    console.error(
      "[character-pipeline.audit] PLAYWRIGHT_AUDIT_EMAIL is required. Refusing to auto-create test users."
    );
    process.exitCode = 1;
    return;
  }
  if (/@example\.com$/i.test(forcedEmail)) {
    console.error(
      "[character-pipeline.audit] PLAYWRIGHT_AUDIT_EMAIL cannot use @example.com. Use a dedicated real test account."
    );
    process.exitCode = 1;
    return;
  }
  const email = forcedEmail;
  const password = (process.env.PLAYWRIGHT_AUDIT_PASSWORD || "").trim() || "AuditPass!12345";
  const characterName = `Audit Character ${String(runId).slice(-6)}`;
  const characterDescription =
    "Athletic brunette with amber eyes, cinematic portrait lighting, confident expression, and consistent facial structure.";

  const out = {
    ok: false,
    baseUrl: BASE_URL,
    auth: {
      reachedProtectedRoute: false,
      blockedReason: null,
    },
    character: {
      referencesUploaded: 0,
      sheetFilledCount: 0,
    },
    aiStudio: {
      createToolOpened: false,
      beginnerModeDisabledForCharacterStep: false,
      characterPickerOpened: false,
      characterSelected: false,
      promptSentToAgent: false,
      generateClicked: false,
      processingVisible: false,
      latestUiError: null,
      latestUiNotice: null,
      generationIssueCard: null,
      seedreamSubmitStatus: null,
    },
    network: [],
    finalUrl: null,
    screenshots: {
      character: "/tmp/shortpulse-audit-character.png",
      aiStudio: "/tmp/shortpulse-audit-ai-studio.png",
      exception: null,
    },
    notes: [],
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();

  page.on("response", async (response) => {
    try {
      const url = response.url();
      if (!url.startsWith(BASE_URL) || !url.includes("/api/")) return;
      const keep =
        url.includes("/api/ai/studio-agent") ||
        url.includes("/api/fal/seedream-edit-submit") ||
        url.includes("/api/fal/seedream-status") ||
        url.includes("/api/upload-image") ||
        url.includes("/api/billing/") ||
        url.includes("/api/kei/");
      if (!keep) return;
      out.network.push({
        url: url.replace(BASE_URL, ""),
        status: response.status(),
      });
    } catch {
      // Ignore observer errors to keep audit flow resilient.
    }
  });

  try {
    await page.goto(`${BASE_URL}/auth?next=/character`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(1200);

    if (page.url().includes("/auth")) {
      await signIn(page, email, password);

      const reached = await waitForNonAuthRoute(page, 12000);
      if (!reached) {
        const info = await maybeText(page.locator(".auth-info"));
        const error = await maybeText(page.locator(".auth-error"));
        if (info) out.notes.push(`auth_info=${info}`);
        if (error) out.notes.push(`auth_error=${error}`);

        if (info.toLowerCase().includes("check your email")) {
          out.auth.blockedReason = "email_confirmation_required";
          out.finalUrl = page.url();
          out.ok = false;
          console.log(JSON.stringify(out, null, 2));
          return;
        }

        out.finalUrl = page.url();
        out.ok = false;
        console.log(JSON.stringify(out, null, 2));
        return;
      }
    }

    out.auth.reachedProtectedRoute = true;

    await page.goto(`${BASE_URL}/character`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator("#character-manager-name").waitFor({ timeout: 20000 });
    await page.locator("#character-manager-name").fill(characterName);
    await page.locator("#character-manager-description").fill(characterDescription);
    await page.waitForTimeout(800);

    const multiInput = page.locator('input[type="file"][multiple]').first();
    await multiInput.setInputFiles([
      { name: "audit-ref-1.png", mimeType: "image/png", buffer: PNG_BUFFER },
      { name: "audit-ref-2.png", mimeType: "image/png", buffer: PNG_BUFFER },
    ]);

    await page.waitForTimeout(1800);
    out.character.referencesUploaded = await page.locator(".character-reference-upload-card").count();
    if (out.character.referencesUploaded > 0) {
      await page.dragAndDrop(
        ".character-reference-upload-card >> nth=0",
        ".character-character-sheet-card >> nth=0"
      );
      await page.waitForTimeout(800);
    }
    out.character.sheetFilledCount = await page
      .locator(".character-character-sheet-card.is-filled")
      .count();
    await page.screenshot({ path: out.screenshots.character, fullPage: true });

    await page.goto(`${BASE_URL}/ai-studio`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);

    const createButton = page.getByRole("button", { name: /Create/i }).first();
    if (await createButton.isVisible().catch(() => false)) {
      await createButton.click();
      out.aiStudio.createToolOpened = true;
    }

    const initialPicker = page.getByRole("button", { name: /Open character picker/i }).first();
    if (!(await initialPicker.isVisible().catch(() => false))) {
      const disableBeginner = page
        .getByRole("button", { name: /Disable beginner mode/i })
        .first();
      if (await disableBeginner.isVisible().catch(() => false)) {
        await disableBeginner.click();
        out.aiStudio.beginnerModeDisabledForCharacterStep = true;
        await page.waitForTimeout(600);
      }
    }

    const pickerButton = page.getByRole("button", { name: /Open character picker/i }).first();
    if (await pickerButton.isVisible().catch(() => false)) {
      const disabled = await pickerButton.isDisabled().catch(() => true);
      if (!disabled) {
        await pickerButton.click();
        out.aiStudio.characterPickerOpened = true;
        await page.waitForTimeout(400);
        const modal = page.locator(".character-picker-modal");
        if (await modal.isVisible().catch(() => false)) {
          const exactCharacter = modal
            .getByRole("button", { name: new RegExp(characterName, "i") })
            .first();
          if (await exactCharacter.isVisible().catch(() => false)) {
            await exactCharacter.click();
            out.aiStudio.characterSelected = true;
          } else {
            const fallbackCharacter = modal.locator(".character-list-select-btn").first();
            if (await fallbackCharacter.isVisible().catch(() => false)) {
              await fallbackCharacter.click();
              out.aiStudio.characterSelected = true;
            }
          }
        }
      } else {
        out.notes.push("character_picker_disabled");
      }
    } else {
      out.notes.push("character_picker_not_visible");
    }

    const agentTextarea = page.locator('textarea[placeholder="Message the agent..."]').first();
    if (await agentTextarea.isVisible().catch(() => false)) {
      await agentTextarea.fill(
        "Create a cinematic portrait of this character in a neon-lit city alley at night, sharp focus."
      );
      const sendButton = page.getByRole("button", { name: /Send to agent/i }).first();
      if (await sendButton.isVisible().catch(() => false)) {
        await sendButton.click();
        out.aiStudio.promptSentToAgent = true;
      }
      await page.waitForTimeout(4500);
    } else {
      out.notes.push("agent_textarea_not_visible");
    }

    const submitResponsePromise = page
      .waitForResponse((response) => response.url().includes("/api/fal/seedream-edit-submit"), {
        timeout: 35000,
      })
      .catch(() => null);

    const generateButtons = page.getByRole("button", { name: /^Generate/i });
    if ((await generateButtons.count()) > 0) {
      await generateButtons.first().click();
      out.aiStudio.generateClicked = true;
    } else {
      out.notes.push("generate_button_not_found");
    }

    const submitResponse = await submitResponsePromise;
    out.aiStudio.seedreamSubmitStatus = submitResponse ? submitResponse.status() : null;
    await page.waitForTimeout(5000);

    out.aiStudio.processingVisible = await page
      .locator("text=Processing")
      .first()
      .isVisible()
      .catch(() => false);
    out.aiStudio.latestUiError =
      (await maybeText(page.locator("[role='alert'] .tiny"))) ||
      (await maybeText(page.locator(".ai-error-card-message"))) ||
      null;
    out.aiStudio.latestUiNotice = (await maybeText(page.locator("[role='status'] .tiny"))) || null;
    out.aiStudio.generationIssueCard =
      (await maybeText(page.locator(".ai-error-card-message").first())) || null;

    await page.screenshot({ path: out.screenshots.aiStudio, fullPage: true });

    if (!out.aiStudio.seedreamSubmitStatus) {
      out.notes.push("seedream_submit_missing");
      out.ok = false;
    } else if (out.aiStudio.seedreamSubmitStatus >= 500) {
      out.notes.push(`seedream_submit_server_error_${out.aiStudio.seedreamSubmitStatus}`);
      out.ok = false;
    } else {
      out.ok = true;
    }

    out.finalUrl = page.url();
    console.log(JSON.stringify(out, null, 2));
    if (!out.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    out.finalUrl = page.url();
    out.ok = false;
    out.notes.push(`exception=${String(error)}`);
    try {
      out.screenshots.exception = "/tmp/shortpulse-audit-exception.png";
      await page.screenshot({ path: out.screenshots.exception, fullPage: true });
    } catch {
      // Ignore screenshot failures in exception path.
    }
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
