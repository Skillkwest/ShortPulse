/* global require, process, console, __dirname, window, document, fetch, URL, HTMLImageElement, HTMLVideoElement */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Project persistence browser audit.
 * Creates a project through the real API, saves a legacy-style orphan workspace snapshot,
 * verifies the server canonicalizes the saved snapshot, then reopens the project route and
 * asserts the UI does not render the orphan preview media.
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

const DEFAULT_BASE_URL = (
  process.env.PLAYWRIGHT_PROJECT_BASE_URL || "http://localhost:3000"
).trim();
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== "false";
const ORPHAN_PREVIEW_URL = "https://capture.invalid/project-orphan-preview.png";
const ORPHAN_LABEL = "Legacy orphan preview should not survive reopen";

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

function summarizeFailedResponses(baseUrl, failedResponses) {
  const origin = new URL(baseUrl).origin;
  const severeFailedResponses = failedResponses.filter((entry) => {
    if (entry.status >= 500) return true;
    return entry.url.startsWith(origin);
  });
  const warningFailedResponses = failedResponses.filter(
    (entry) => !severeFailedResponses.includes(entry)
  );
  return {
    severeFailedResponses,
    warningFailedResponses,
    ok: severeFailedResponses.length === 0,
  };
}

async function attachSurfaceObservers(page) {
  const consoleEntries = [];
  const pageErrors = [];
  const failedResponses = [];
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
  page.on("response", (response) => {
    const status = response.status();
    if (status < 400) return;
    failedResponses.push({
      status,
      url: response.url(),
      resourceType: response.request().resourceType(),
      method: response.request().method(),
    });
  });
  return { consoleEntries, pageErrors, failedResponses };
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
}

async function readAccessToken(page) {
  return page.evaluate(() => {
    const keys = Object.keys(window.localStorage || {});
    for (const key of keys) {
      if (!/auth-token/i.test(key)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const candidates = [parsed, parsed?.currentSession, parsed?.session];
        for (const candidate of candidates) {
          if (candidate && typeof candidate.access_token === "string") {
            return candidate.access_token;
          }
        }
      } catch {
        continue;
      }
    }
    return null;
  });
}

async function apiRequest({ token, method, path: requestPath, body }) {
  const response = await fetch(`${DEFAULT_BASE_URL}${requestPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  return {
    status: response.status,
    ok: response.ok,
    contentType,
    text,
    payload,
  };
}

function summarizeApiResult(result) {
  const body = result.payload ? JSON.stringify(result.payload) : result.text.slice(0, 180);
  return `${result.status} ${result.contentType}: ${body}`;
}

function assertJsonApiResult(label, result, expectedStatus) {
  if (!result.contentType.toLowerCase().includes("application/json")) {
    throw new Error(`${label} returned non-JSON response: ${summarizeApiResult(result)}`);
  }
  if (typeof expectedStatus === "number" && result.status !== expectedStatus) {
    throw new Error(`${label} returned unexpected status: ${summarizeApiResult(result)}`);
  }
}

function buildLegacyOrphanSnapshot() {
  const updatedAt = new Date().toISOString();
  return {
    schemaVersion: 2,
    sessionId: "00000000-0000-0000-0000-000000000111",
    updatedAt,
    workspace: {
      mode: "text",
      selectedTool: "create",
      prompt: "",
      standardPrompt: "",
      pulsePrompt: "",
      model: null,
      aspect: "9:16",
      selectedCharacterId: null,
      expertCreateMode: "standard",
      activePulsePresetId: null,
      referenceImageUrl: null,
      extraImageUrls: [null, null, null],
      editReferenceText: "",
      videoReferenceText: "",
      videoReferenceMode: "standard",
      videoDurationSeconds: 6,
      videoResolution: "1080p",
      imageResolution: "model_default",
      videoGenerateAudio: false,
      videoCameraFixed: false,
      videoAutoFix: false,
      klingNegativePrompt: "",
      klingCfgScale: 0.5,
      klingWorkflowMode: "single",
      seedance2InputMode: "text",
      seedance2ReferenceImageUrls: [],
      seedance2ReferenceVideoUrls: [],
      seedance2ReferenceAudioUrls: [],
      seedance2ReturnLastFrame: false,
      seedance2WebSearch: false,
      klingShotType: "customize",
      klingVoiceIds: ["", ""],
      klingMultiPrompts: [],
      klingElements: [],
      motionReferenceVideoUrl: null,
    },
    outputs: {
      active: [
        {
          id: "legacy-orphan-output",
          mode: "image",
          prompt: ORPHAN_LABEL,
          previewUrl: ORPHAN_PREVIEW_URL,
          resultUrls: [ORPHAN_PREVIEW_URL],
          status: "saved",
          timestamp: "legacy",
          mediaSource: "generated",
        },
      ],
      archived: [],
      activeOutputId: "legacy-orphan-output",
      curatedReferenceIds: ["legacy-orphan-output"],
      removedFromAllRefsIds: [],
    },
    agent: {
      messages: [],
      input: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: true,
      pulseWorkflowSession: null,
    },
    meta: {
      generatedAt: updatedAt,
      checksum: "fnv1a32:legacy-audit",
    },
  };
}

async function deleteProject(token, projectId) {
  try {
    await apiRequest({
      token,
      method: "DELETE",
      path: `/api/projects/${encodeURIComponent(projectId)}`,
    });
  } catch {
    // Best-effort cleanup only.
  }
}

async function main() {
  const email = (process.env.PLAYWRIGHT_AUDIT_EMAIL || "").trim();
  const password = (process.env.PLAYWRIGHT_AUDIT_PASSWORD || "").trim() || "AuditPass!12345";

  if (!email) {
    console.error("[project-persistence.audit] PLAYWRIGHT_AUDIT_EMAIL is required.");
    process.exitCode = 1;
    return;
  }
  if (/@example\.com$/i.test(email)) {
    console.error(
      "[project-persistence.audit] PLAYWRIGHT_AUDIT_EMAIL cannot use @example.com. Use a dedicated real test account."
    );
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: { width: 1720, height: 980 } });
  const page = await context.newPage();
  const observers = await attachSurfaceObservers(page);

  let token = null;
  let projectId = null;

  try {
    await ensureSignedIn(page, DEFAULT_BASE_URL, "/ai-studio", email, password);
    token = await readAccessToken(page);
    if (!token) {
      throw new Error("Could not resolve audit access token from browser session.");
    }

    const createResult = await apiRequest({
      token,
      method: "POST",
      path: "/api/projects/create",
      body: {
        title: "Project Persistence Audit",
      },
    });
    if (!createResult.ok || !createResult.payload?.project?.id) {
      throw new Error(`Project create failed: ${summarizeApiResult(createResult)}`);
    }
    assertJsonApiResult("Project create", createResult, 200);
    projectId = createResult.payload.project.id;

    const listResult = await apiRequest({
      token,
      method: "GET",
      path: "/api/projects?limit=all",
    });
    assertJsonApiResult("Project list", listResult, 200);
    const listedProjects = Array.isArray(listResult.payload?.projects)
      ? listResult.payload.projects
      : [];
    if (!listResult.ok || !listedProjects.some((project) => project?.id === projectId)) {
      throw new Error(
        `Project list did not include created project: ${summarizeApiResult(listResult)}`
      );
    }

    const readProjectResult = await apiRequest({
      token,
      method: "GET",
      path: `/api/projects/${encodeURIComponent(projectId)}`,
    });
    assertJsonApiResult("Project read", readProjectResult, 200);
    if (!readProjectResult.ok || readProjectResult.payload?.project?.id !== projectId) {
      throw new Error(`Project read failed: ${summarizeApiResult(readProjectResult)}`);
    }

    const invalidProjectResult = await apiRequest({
      token,
      method: "GET",
      path: "/api/projects/not-a-uuid",
    });
    assertJsonApiResult("Invalid project id", invalidProjectResult, 400);

    const unknownDynamicRouteResult = await apiRequest({
      token,
      method: "GET",
      path: `/api/projects/${encodeURIComponent(projectId)}/unknown`,
    });
    assertJsonApiResult("Unknown dynamic project route", unknownDynamicRouteResult, 404);

    const wrongMethodResult = await apiRequest({
      token,
      method: "PUT",
      path: `/api/projects/${encodeURIComponent(projectId)}`,
      body: { title: "Wrong method" },
    });
    assertJsonApiResult("Project wrong method", wrongMethodResult, 405);

    const folderListResult = await apiRequest({
      token,
      method: "GET",
      path: `/api/projects/${encodeURIComponent(projectId)}/media/folders/list`,
    });
    assertJsonApiResult("Project media folder list", folderListResult, 200);
    if (!folderListResult.ok || !Array.isArray(folderListResult.payload?.folders)) {
      throw new Error(`Project media folder list failed: ${summarizeApiResult(folderListResult)}`);
    }

    const folderCreateResult = await apiRequest({
      token,
      method: "POST",
      path: `/api/projects/${encodeURIComponent(projectId)}/media/folders/create`,
      body: {
        name: `Audit Folder ${Date.now()}`,
        parentFolderId: null,
      },
    });
    assertJsonApiResult("Project media folder create", folderCreateResult, 200);
    const folderId = folderCreateResult.payload?.folder?.id;
    if (!folderId) {
      throw new Error(
        `Project media folder create failed: ${summarizeApiResult(folderCreateResult)}`
      );
    }

    const folderRenameResult = await apiRequest({
      token,
      method: "POST",
      path: `/api/projects/${encodeURIComponent(projectId)}/media/folders/rename`,
      body: {
        folderId,
        name: `Renamed Audit Folder ${Date.now()}`,
      },
    });
    assertJsonApiResult("Project media folder rename", folderRenameResult, 200);

    const folderMoveResult = await apiRequest({
      token,
      method: "POST",
      path: `/api/projects/${encodeURIComponent(projectId)}/media/folders/move`,
      body: {
        folderId,
        parentFolderId: null,
      },
    });
    assertJsonApiResult("Project media folder move", folderMoveResult, 200);

    const invalidMembershipBatchResult = await apiRequest({
      token,
      method: "POST",
      path: `/api/projects/${encodeURIComponent(projectId)}/media/folders/membership-batch`,
      body: {},
    });
    assertJsonApiResult(
      "Project media folder membership validation",
      invalidMembershipBatchResult,
      400
    );

    const canvasSnapshot = {
      schemaVersion: 1,
      camera: { x: 0, y: 0, zoom: 1 },
      items: [],
    };
    const folderCanvasSaveResult = await apiRequest({
      token,
      method: "PUT",
      path: `/api/projects/${encodeURIComponent(projectId)}/media/folders/${encodeURIComponent(
        folderId
      )}/canvas`,
      body: {
        schemaVersion: 1,
        snapshot: canvasSnapshot,
      },
    });
    assertJsonApiResult("Project media folder canvas save", folderCanvasSaveResult, 200);

    const folderCanvasReadResult = await apiRequest({
      token,
      method: "GET",
      path: `/api/projects/${encodeURIComponent(projectId)}/media/folders/${encodeURIComponent(
        folderId
      )}/canvas`,
    });
    assertJsonApiResult("Project media folder canvas read", folderCanvasReadResult, 200);

    const legacySnapshot = buildLegacyOrphanSnapshot();
    const saveResult = await apiRequest({
      token,
      method: "PUT",
      path: `/api/projects/${encodeURIComponent(projectId)}/workspace`,
      body: {
        schemaVersion: legacySnapshot.schemaVersion,
        snapshot: legacySnapshot,
      },
    });
    assertJsonApiResult("Project workspace save", saveResult, 200);
    if (!saveResult.ok || !saveResult.payload?.workspace?.snapshot) {
      throw new Error(`Project workspace save failed: ${summarizeApiResult(saveResult)}`);
    }

    const readResult = await apiRequest({
      token,
      method: "GET",
      path: `/api/projects/${encodeURIComponent(projectId)}/workspace`,
    });
    assertJsonApiResult("Project workspace read", readResult, 200);
    if (!readResult.ok || !readResult.payload?.workspace?.snapshot) {
      throw new Error(`Project workspace read failed: ${summarizeApiResult(readResult)}`);
    }

    const folderDeleteResult = await apiRequest({
      token,
      method: "POST",
      path: `/api/projects/${encodeURIComponent(projectId)}/media/folders/delete`,
      body: {
        folderId,
      },
    });
    assertJsonApiResult("Project media folder delete", folderDeleteResult, 200);

    const persistedSnapshot = readResult.payload.workspace.snapshot;
    const persistedOutputs = persistedSnapshot?.outputs ?? {};
    const persistedActive = Array.isArray(persistedOutputs.active) ? persistedOutputs.active : [];
    const persistedArchived = Array.isArray(persistedOutputs.archived)
      ? persistedOutputs.archived
      : [];
    const persistedSnapshotJson = JSON.stringify(persistedSnapshot);
    if (persistedActive.length !== 0 || persistedArchived.length !== 0) {
      throw new Error(
        `Canonicalized project workspace still exposed persisted outputs: ${persistedSnapshotJson}`
      );
    }
    if (persistedSnapshotJson.includes(ORPHAN_PREVIEW_URL)) {
      throw new Error("Canonicalized project workspace still contains the orphan preview URL.");
    }

    await page.goto(`${DEFAULT_BASE_URL}/ai-studio?projectId=${encodeURIComponent(projectId)}`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.locator(".ai-studio-page").waitFor({ timeout: 20_000 });
    await page.waitForTimeout(2_500);

    const uiState = await page.evaluate(
      ({ orphanPreviewUrl, orphanLabel }) => {
        const orphanImageSources = Array.from(
          document.querySelectorAll(".reference-column .reference-card-image")
        )
          .map((node) => (node instanceof HTMLImageElement ? node.src : ""))
          .filter((src) => src.includes(orphanPreviewUrl));
        const orphanVideoSources = Array.from(
          document.querySelectorAll(".reference-column .reference-card-video")
        )
          .map((node) =>
            node instanceof HTMLVideoElement ? node.currentSrc || node.src || "" : ""
          )
          .filter((src) => src.includes(orphanPreviewUrl));
        const orphanTextVisible = (document.body?.textContent || "").includes(orphanLabel);

        return {
          orphanImageSources,
          orphanVideoSources,
          orphanTextVisible,
          referenceCardCount: document.querySelectorAll(".reference-column .reference-card").length,
        };
      },
      {
        orphanPreviewUrl: ORPHAN_PREVIEW_URL,
        orphanLabel: ORPHAN_LABEL,
      }
    );

    const severeSignals = summarizeSignals(observers.consoleEntries, observers.pageErrors);
    const failedResponseSummary = summarizeFailedResponses(
      DEFAULT_BASE_URL,
      observers.failedResponses
    );
    const result = {
      ok:
        severeSignals.ok &&
        failedResponseSummary.ok &&
        uiState.orphanImageSources.length === 0 &&
        uiState.orphanVideoSources.length === 0 &&
        !uiState.orphanTextVisible,
      baseUrl: DEFAULT_BASE_URL,
      projectId,
      persistedWorkspace: {
        activeCount: persistedActive.length,
        archivedCount: persistedArchived.length,
      },
      uiState,
      severeSignals,
      failedResponses: failedResponseSummary,
    };

    console.log(JSON.stringify(result, null, 2));

    if (!result.ok) {
      throw new Error("Project persistence audit detected leaked orphan project media.");
    }
  } finally {
    if (token && projectId) {
      await deleteProject(token, projectId);
    }
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error("[project-persistence.audit] failed:", error);
  process.exitCode = 1;
});
