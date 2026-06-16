import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";

const require = createRequire(new URL("../../frontend/package.json", import.meta.url));
const { chromium } = require("playwright");
const outputPath = join(dirname(fileURLToPath(import.meta.url)), "full-dashboard-mobile-scroll-after-showcase-rotation-summary.json");
const targetUrl = "http://127.0.0.1:3000/";

function summarizeFrames(frames) {
  const sorted = [...frames].sort((a, b) => a - b);
  const percentile = (value) => {
    if (sorted.length === 0) return 0;
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))];
  };

  return {
    count: sorted.length,
    p95: Number(percentile(0.95).toFixed(2)),
    p98: Number(percentile(0.98).toFixed(2)),
    max: Number((sorted[sorted.length - 1] ?? 0).toFixed(2)),
    over50: sorted.filter((duration) => duration > 50).length,
    over100: sorted.filter((duration) => duration > 100).length,
  };
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const client = await context.newCDPSession(page);
await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });

await page.addInitScript(() => {
  const state = {
    frameDeltas: [],
    lastFrameAt: 0,
    longTasks: [],
    rectReads: 0,
    videoLoadCalls: 0,
    videoPauseCalls: 0,
    videoPlayCalls: 0,
  };

  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function getBoundingClientRectWithProbe() {
    state.rectReads += 1;
    return originalGetBoundingClientRect.call(this);
  };

  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function playWithProbe() {
    state.videoPlayCalls += 1;
    return originalPlay.call(this);
  };

  const originalPause = HTMLMediaElement.prototype.pause;
  HTMLMediaElement.prototype.pause = function pauseWithProbe() {
    state.videoPauseCalls += 1;
    return originalPause.call(this);
  };

  const originalLoad = HTMLMediaElement.prototype.load;
  HTMLMediaElement.prototype.load = function loadWithProbe() {
    state.videoLoadCalls += 1;
    return originalLoad.call(this);
  };

  const observeFrames = (timestamp) => {
    if (state.lastFrameAt > 0) {
      state.frameDeltas.push(timestamp - state.lastFrameAt);
    }
    state.lastFrameAt = timestamp;
    requestAnimationFrame(observeFrames);
  };
  requestAnimationFrame(observeFrames);

  try {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        state.longTasks.push(entry.duration);
      });
    });
    observer.observe({ entryTypes: ["longtask"] });
  } catch {
    // Longtask timing is not available in every browser mode.
  }

  window.__dashboardPerfProbe = {
    read() {
      return { ...state };
    },
    reset() {
      state.frameDeltas = [];
      state.lastFrameAt = 0;
      state.longTasks = [];
      state.rectReads = 0;
      state.videoLoadCalls = 0;
      state.videoPauseCalls = 0;
      state.videoPlayCalls = 0;
    },
  };
});

await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1800);

const topState = await page.evaluate(() => ({
  heroSources: document.querySelectorAll(".public-home-hero-video source[src]").length,
  placeholder: Boolean(document.querySelector(".dashboard-tutorial-grid-placeholder")),
  showcaseTop: Math.round(document.querySelector(".public-home-showcase")?.getBoundingClientRect().top ?? -1),
  tutorialCards: document.querySelectorAll(".dashboard-tutorial-card").length,
  tutorialVideos: document.querySelectorAll("video[data-dashboard-tutorial-index]").length,
}));

await page.waitForTimeout(1800);
const beforeRotation = await page.evaluate(() => {
  const videos = [...document.querySelectorAll("video[data-dashboard-tutorial-index]")];
  return {
    playing: videos
      .filter((video) => !video.paused && !video.ended && video.readyState >= 2)
      .map((video) => Number(video.dataset.dashboardTutorialIndex)),
    sourced: videos
      .filter((video) => video.hasAttribute("src"))
      .map((video) => Number(video.dataset.dashboardTutorialIndex)),
  };
});

await page.waitForTimeout(5600);
const afterRotation = await page.evaluate(() => {
  const videos = [...document.querySelectorAll("video[data-dashboard-tutorial-index]")];
  return {
    playing: videos
      .filter((video) => !video.paused && !video.ended && video.readyState >= 2)
      .map((video) => Number(video.dataset.dashboardTutorialIndex)),
    sourced: videos
      .filter((video) => video.hasAttribute("src"))
      .map((video) => Number(video.dataset.dashboardTutorialIndex)),
  };
});

await page.evaluate(() => {
  window.scrollTo(0, 0);
  window.__dashboardPerfProbe.reset();
});
await page.waitForTimeout(120);

for (let step = 0; step < 30; step += 1) {
  await page.mouse.wheel(0, 220);
  await page.waitForTimeout(90);
}
await page.waitForTimeout(1800);

const scrollProbe = await page.evaluate(() => {
  const probe = window.__dashboardPerfProbe.read();
  const videos = [...document.querySelectorAll("video[data-dashboard-tutorial-index]")];
  return {
    ...probe,
    scrollY: Math.round(window.scrollY),
    playing: videos
      .filter((video) => !video.paused && !video.ended && video.readyState >= 2)
      .map((video) => Number(video.dataset.dashboardTutorialIndex)),
    sourced: videos
      .filter((video) => video.hasAttribute("src"))
      .map((video) => Number(video.dataset.dashboardTutorialIndex)),
    tutorialCards: document.querySelectorAll(".dashboard-tutorial-card").length,
    tutorialVideos: videos.length,
  };
});

const summary = {
  branchRule: "local codex/brother-dashboard-aesthetics only; production not touched",
  targetUrl,
  viewport: { width: 390, height: 844, isMobile: true, cpuThrottle: 4 },
  capturedAt: new Date().toISOString(),
  topState,
  beforeRotation,
  afterRotation,
  scroll: {
    ...summarizeFrames(scrollProbe.frameDeltas),
    longTaskCount: scrollProbe.longTasks.length,
    longTaskTotal: Number(scrollProbe.longTasks.reduce((sum, duration) => sum + duration, 0).toFixed(2)),
    playCalls: scrollProbe.videoPlayCalls,
    pauseCalls: scrollProbe.videoPauseCalls,
    loadCalls: scrollProbe.videoLoadCalls,
    rectReads: scrollProbe.rectReads,
    scrollY: scrollProbe.scrollY,
    playing: scrollProbe.playing,
    sourced: scrollProbe.sourced,
    tutorialCards: scrollProbe.tutorialCards,
    tutorialVideos: scrollProbe.tutorialVideos,
  },
};

await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));

await browser.close();
