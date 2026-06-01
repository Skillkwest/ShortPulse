/* global require, process, console, HTMLElement, MouseEvent, document */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Character Manager save/reopen audit runner.
 * Creates a disposable character with a reference image, verifies it survives
 * an AI Studio reload, and deletes the audit fixture.
 */
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3100";
const EMAIL = (process.env.PLAYWRIGHT_AUDIT_EMAIL || "").trim();
const PASSWORD = (process.env.PLAYWRIGHT_AUDIT_PASSWORD || "").trim() || "AuditPass!12345";
const REFERENCE_IMAGE_PATH =
  process.env.PLAYWRIGHT_CHARACTER_AUDIT_IMAGE ||
  path.join(process.cwd(), "public", "brand-logo.png");
const AUDIT_CHARACTER_PREFIX = "Copperknot Audit";

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

async function openCharacterPanel(page) {
  if (
    await page
      .locator(".character-panel-root")
      .isVisible()
      .catch(() => false)
  ) {
    return;
  }
  const characterTool = page
    .locator(".toolbar-item-secondary")
    .filter({ hasText: /^Characters$/ })
    .first();
  await characterTool.click();
  await page.locator(".character-panel-root").waitFor({ timeout: 30_000 });
}

async function startNewCharacter(page) {
  const panel = page.locator(".character-panel-root");
  const createButton = panel.getByRole("button", { name: /^Create$/ }).first();
  await createButton.click();

  const discardButton = page.getByRole("button", { name: /^Discard Draft$/ });
  if (await discardButton.isVisible().catch(() => false)) {
    await discardButton.click();
  }

  const nameInput = panel.locator("#character-panel-name");
  await nameInput.waitFor({ timeout: 15_000 });
  await nameInput.fill(`${AUDIT_CHARACTER_PREFIX} ${Date.now()}`);
  return await nameInput.inputValue();
}

async function attachPortraitReference(page) {
  const panel = page.locator(".character-panel-root");
  const portraitCard = panel.locator(".character-character-sheet-card").first();
  await portraitCard.click();
  await panel.getByTestId("character-sheet-upload-input").setInputFiles(REFERENCE_IMAGE_PATH);
  await panel.locator(".character-character-sheet-card.is-filled").first().waitFor({
    timeout: 30_000,
  });
}

async function saveCharacter(page) {
  const panel = page.locator(".character-panel-root");
  await panel.getByRole("button", { name: /^Save$/ }).click();
  await page.getByLabel(/Character saved/i).waitFor({ timeout: 45_000 });
}

async function openCharacterLibrary(page) {
  if (
    await page
      .getByRole("dialog", { name: /^Character library$/ })
      .isVisible()
      .catch(() => false)
  ) {
    return;
  }
  const panel = page.locator(".character-panel-root");
  await panel.getByRole("button", { name: /^Characters$/ }).click();
  await page.getByRole("dialog", { name: /^Character library$/ }).waitFor({ timeout: 30_000 });
}

async function closeCharacterLibrary(page) {
  const dialog = page.getByRole("dialog", { name: /^Character library$/ });
  if (!(await dialog.isVisible().catch(() => false))) {
    return;
  }
  await dialog.getByLabel("Close character library").click();
  await dialog.waitFor({ state: "hidden", timeout: 15_000 });
}

async function findSavedCharacterCard(page, characterName) {
  return page.locator(".ai-character-picker-card--character").filter({ hasText: characterName });
}

async function clickDom(locator) {
  await locator.evaluate((element) => {
    if (element instanceof HTMLElement) {
      element.click();
      return;
    }
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

async function waitForCharacterAbsent(page, characterName) {
  await page.waitForFunction(
    (name) =>
      Array.from(document.querySelectorAll(".ai-character-picker-card--character")).every(
        (element) => !element.textContent?.includes(name)
      ),
    characterName,
    { timeout: 30_000 }
  );
}

async function deleteAuditCharacter(page, characterName) {
  await openCharacterLibrary(page);
  const card = await findSavedCharacterCard(page, characterName);
  if ((await card.count()) === 0) {
    return false;
  }

  await clickDom(card.first().getByLabel(`Delete ${characterName}`));
  await clickDom(page.getByRole("button", { name: /^Delete$/ }));
  await waitForCharacterAbsent(page, characterName);
  return true;
}

async function cleanupPriorAuditCharacters(page) {
  await openCharacterLibrary(page);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const auditCard = page
      .locator(".ai-character-picker-card--character")
      .filter({ hasText: AUDIT_CHARACTER_PREFIX })
      .first();
    if ((await auditCard.count()) === 0) {
      break;
    }
    const characterName =
      (await auditCard.locator(".ai-character-list-name").textContent())?.trim() ??
      AUDIT_CHARACTER_PREFIX;
    await clickDom(auditCard.locator(".ai-character-picker-card-delete-btn"));
    await clickDom(page.getByRole("button", { name: /^Delete$/ }));
    await waitForCharacterAbsent(page, characterName);
  }
  await closeCharacterLibrary(page);
}

async function runAudit(page) {
  await openCharacterPanel(page);
  await cleanupPriorAuditCharacters(page);
  const characterName = await startNewCharacter(page);
  await attachPortraitReference(page);
  await saveCharacter(page);

  await openCharacterLibrary(page);
  const preReloadCard = await findSavedCharacterCard(page, characterName);
  if ((await preReloadCard.count()) === 0) {
    throw new Error(`Saved character "${characterName}" did not appear before reload.`);
  }

  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".ai-studio-page").waitFor({ timeout: 30_000 });
  await openCharacterPanel(page);
  await openCharacterLibrary(page);

  const postReloadCard = await findSavedCharacterCard(page, characterName);
  if ((await postReloadCard.count()) === 0) {
    throw new Error(`Saved character "${characterName}" did not survive reload/reopen.`);
  }

  const deleted = await deleteAuditCharacter(page, characterName);
  if (!deleted) {
    throw new Error(`Saved character "${characterName}" passed continuity but cleanup failed.`);
  }

  console.log(
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        characterName,
        referenceImagePath: REFERENCE_IMAGE_PATH,
        createdWithReference: true,
        appearedBeforeReload: true,
        appearedAfterReload: true,
        cleanupDeleted: true,
        cleanupMethod: "dom-click",
        cleanupPointerClickFinding:
          "Character Library delete confirmation is visible but normal Playwright pointer clicks are intercepted by the library card layer.",
      },
      null,
      2
    )
  );
}

async function main() {
  if (!EMAIL) {
    console.error("[character-manager-save-reopen.audit] PLAYWRIGHT_AUDIT_EMAIL is required.");
    process.exitCode = 1;
    return;
  }
  if (/@example\.com$/i.test(EMAIL)) {
    console.error(
      "[character-manager-save-reopen.audit] PLAYWRIGHT_AUDIT_EMAIL cannot use @example.com. Use a dedicated real test account."
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
    `[character-manager-save-reopen.audit] ${String(error?.stack || error?.message || error)}`
  );
  process.exitCode = 1;
});
