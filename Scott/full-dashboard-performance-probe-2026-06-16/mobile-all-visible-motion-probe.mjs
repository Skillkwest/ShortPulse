import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../frontend/package.json", import.meta.url));
const { chromium } = require("playwright");

const outputPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "full-dashboard-mobile-all-visible-motion-summary.json"
);
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

async function readMotionState(page) {
  return page.evaluate(async () => {
    const readVisibleCards = () =>
      [...document.querySelectorAll(".dashboard-tutorial-card")].map((card, index) => {
        const rect = card.getBoundingClientRect();
        const video = card.querySelector("video[data-dashboard-tutorial-index]");
        return {
          index,
          bottom: Math.round(rect.bottom),
          currentTime: video ? Number(video.currentTime.toFixed(3)) : null,
          hasPoster: Boolean(card.querySelector("img.dashboard-tutorial-thumbnail-image")),
          playing: video?.dataset.playing === "true",
          readyState: video?.readyState ?? null,
          src: video?.currentSrc || video?.getAttribute("src") || "",
          top: Math.round(rect.top),
          visible: rect.bottom > 0 && rect.top < window.innerHeight,
        };
      });

    const before = readVisibleCards();
    await new Promise((resolve) => {
      setTimeout(resolve, 800);
    });
    const after = readVisibleCards();

    return {
      hero: (() => {
        const video = document.querySelector(".public-home-hero-video");
        return video
          ? {
              currentTime: Number(video.currentTime.toFixed(3)),
              paused: video.paused,
              readyState: video.readyState,
              src: video.currentSrc,
            }
          : null;
      })(),
      posters: document.querySelectorAll(".dashboard-tutorial-thumbnail-image").length,
      scrollY: Math.round(window.scrollY),
      visibleAfter: after.filter((card) => card.visible),
      visibleBefore: before.filter((card) => card.visible),
    };
  });
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
    videoLoadCalls: 0,
    videoPauseCalls: 0,
    videoPlayCalls: 0,
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

  window.__dashboardAllMotionProbe = {
    read() {
      return { ...state };
    },
    reset() {
      state.frameDeltas = [];
      state.lastFrameAt = 0;
      state.longTasks = [];
      state.videoLoadCalls = 0;
      state.videoPauseCalls = 0;
      state.videoPlayCalls = 0;
    },
  };
});

await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4300);

const topMotion = await readMotionState(page);

await page.evaluate(() => {
  window.__dashboardAllMotionProbe.reset();
  window.scrollTo(0, 140);
});
await page.waitForTimeout(1800);
const scrolledMotion = await readMotionState(page);

for (let step = 0; step < 22; step += 1) {
  await page.mouse.wheel(0, 140);
  await page.waitForTimeout(80);
}
await page.waitForTimeout(1400);

const probe = await page.evaluate(() => {
  const state = window.__dashboardAllMotionProbe.read();
  return {
    ...state,
    scrollY: Math.round(window.scrollY),
    visibleCards: [...document.querySelectorAll(".dashboard-tutorial-card")]
      .map((card, index) => {
        const rect = card.getBoundingClientRect();
        const video = card.querySelector("video[data-dashboard-tutorial-index]");
        return {
          index,
          bottom: Math.round(rect.bottom),
          currentTime: video ? Number(video.currentTime.toFixed(3)) : null,
          hasPoster: Boolean(card.querySelector("img.dashboard-tutorial-thumbnail-image")),
          playing: video?.dataset.playing === "true",
          readyState: video?.readyState ?? null,
          src: video?.currentSrc || video?.getAttribute("src") || "",
          top: Math.round(rect.top),
          visible: rect.bottom > 0 && rect.top < window.innerHeight,
        };
      })
      .filter((card) => card.visible),
  };
});

const summary = {
  branchRule: "local codex/brother-dashboard-aesthetics only; production not touched",
  capturedAt: new Date().toISOString(),
  targetUrl,
  viewport: { width: 390, height: 844, isMobile: true, cpuThrottle: 4 },
  topMotion,
  scrolledMotion,
  scroll: {
    ...summarizeFrames(probe.frameDeltas),
    loadCalls: probe.videoLoadCalls,
    longTaskCount: probe.longTasks.length,
    longTaskTotal: Number(probe.longTasks.reduce((sum, duration) => sum + duration, 0).toFixed(2)),
    pauseCalls: probe.videoPauseCalls,
    playCalls: probe.videoPlayCalls,
    scrollY: probe.scrollY,
    visibleCards: probe.visibleCards,
  },
};

await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));

await browser.close();
