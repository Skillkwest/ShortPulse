/* global require, process, console */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Character Mode model-picker audit runner.
 * Signs in to a dedicated account, selects a character in AI Studio Create,
 * opens the model modal, and verifies Character Mode stays on the image-edit lane.
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3100";
const EMAIL = (process.env.PLAYWRIGHT_AUDIT_EMAIL || "").trim();
const PASSWORD = (process.env.PLAYWRIGHT_AUDIT_PASSWORD || "").trim() || "AuditPass!12345";

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

async function ensureSignedIn(page) {
  await page.goto(`${BASE_URL}/auth?next=/ai-studio`, {
    waitUntil: "domcontentloaded",
  });

  if (page.url().includes("/auth")) {
    await signIn(page);
  }

  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 30_000 });
  await page.goto(`${BASE_URL}/ai-studio`, {
    waitUntil: "networkidle",
  });
  await page.locator(".ai-studio-page").waitFor({ timeout: 30_000 });
}

async function ensureCreateStandard(page) {
  const createButton = page.getByRole("button", { name: /^Create$/i }).first();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (
      await page
        .locator(".ai-character-mode-toggle")
        .isVisible()
        .catch(() => false)
    ) {
      break;
    }
    if (await createButton.isVisible().catch(() => false)) {
      await createButton.click({ force: true });
    }
    await page.waitForTimeout(1_000);
  }
  const standardToggle = page.getByRole("button", { name: /^Standard$/i }).first();
  if (await standardToggle.isVisible().catch(() => false)) {
    await standardToggle.click();
  }
}

async function selectFirstCharacter(page) {
  await page.locator(".ai-character-mode-toggle").waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: /enable character mode/i }).click();
  await page.getByRole("button", { name: /open character picker/i }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: /open character picker/i }).click();
  await page.getByRole("dialog", { name: /choose character/i }).waitFor({ timeout: 15_000 });

  const characterButtons = page.locator(".ai-character-list-select-btn");
  const characterCount = await characterButtons.count();
  if (characterCount === 0) {
    throw new Error("No character profiles are available for the Character Mode audit account.");
  }
  await characterButtons.first().click();
}

async function runAudit(page) {
  await ensureCreateStandard(page);
  await selectFirstCharacter(page);
  await page.getByRole("button", { name: /open model picker/i }).click();

  const modal = page.locator(".model-picker-modal");
  await modal.waitFor({ timeout: 15_000 });

  const title = (await modal.locator(".model-modal-title").textContent())?.trim() ?? "";
  const chipTitles = (await modal.locator(".model-chip-title").allTextContents()).map((value) =>
    value.trim()
  );

  const result = {
    capturedAt: new Date().toISOString(),
    title,
    chipCount: chipTitles.length,
    chipTitles,
    textToImageChipVisible: chipTitles.some((value) => /flux\.?2 lite/i.test(value)),
    hasSeedreamChip: chipTitles.some((value) => /seedream 4\.5/i.test(value)),
    hasNanoBananaChip: chipTitles.some((value) => /nano banana 2/i.test(value)),
  };

  if (result.title !== "Character Mode") {
    throw new Error(`Expected Character Mode modal title, received: ${result.title || "<empty>"}`);
  }
  if (result.chipCount === 0) {
    throw new Error("Character Mode model picker rendered no visible model chips.");
  }
  if (result.textToImageChipVisible) {
    throw new Error("Character Mode model picker exposed a text-only Create chip.");
  }
  if (!result.hasSeedreamChip || !result.hasNanoBananaChip) {
    throw new Error(
      `Expected Character Mode model chips were missing. Chips: ${result.chipTitles.join(", ")}`
    );
  }

  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  if (!EMAIL) {
    console.error(
      "[ai-studio-character-mode-model-picker.audit] PLAYWRIGHT_AUDIT_EMAIL is required."
    );
    process.exitCode = 1;
    return;
  }
  if (/@example\.com$/i.test(EMAIL)) {
    console.error(
      "[ai-studio-character-mode-model-picker.audit] PLAYWRIGHT_AUDIT_EMAIL cannot use @example.com. Use a dedicated real test account."
    );
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

  try {
    await ensureSignedIn(page);
    await runAudit(page);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(
    `[ai-studio-character-mode-model-picker.audit] ${String(
      error?.stack || error?.message || error
    )}`
  );
  process.exitCode = 1;
});
