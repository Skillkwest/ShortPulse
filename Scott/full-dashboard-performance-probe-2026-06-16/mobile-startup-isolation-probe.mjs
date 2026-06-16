import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";

const require = createRequire(new URL("../../frontend/package.json", import.meta.url));
const { chromium } = require("playwright");

const outputPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "full-dashboard-mobile-startup-isolation-summary.json"
);
const targetUrl = "http://127.0.0.1:3000/";

const scenarios = [
  {
    label: "baseline",
  },
  {
    label: "block-images-and-media",
    blockResourceTypes: new Set(["image", "media"]),
  },
  {
    label: "hide-showcase-and-orbit",
    style: `
      .public-home-showcase,
      .public-home-orbit {
        display: none !important;
      }
    `,
  },
  {
    label: "pause-css-animations",
    style: `
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
      }
    `,
  },
  {
    label: "hide-model-marquee",
    style: `
      .public-home-models {
        display: none !important;
      }
    `,
  },
];

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

async function runScenario(browser, scenario) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const client = await context.newCDPSession(await context.newPage());
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await context.close();

  const throttledContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await throttledContext.newPage();
  const throttledClient = await throttledContext.newCDPSession(page);
  await throttledClient.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  if (scenario.blockResourceTypes) {
    await page.route("**/*", async (route) => {
      const request = route.request();
      if (scenario.blockResourceTypes.has(request.resourceType())) {
        await route.abort();
        return;
      }
      await route.continue();
    });
  }

  await page.addInitScript((styleText) => {
    const state = {
      frameDeltas: [],
      lastFrameAt: 0,
      longTasks: [],
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
          state.longTasks.push({
            duration: entry.duration,
            name: entry.name,
            startTime: entry.startTime,
          });
        });
      });
      observer.observe({ entryTypes: ["longtask"] });
    } catch {
      // Longtask timing is not available in every browser mode.
    }

    window.__dashboardStartupProbe = {
      read() {
        return { ...state };
      },
    };

    if (styleText) {
      const installStyle = () => {
        if (document.querySelector("style[data-dashboard-startup-probe='true']")) return;
        const style = document.createElement("style");
        style.dataset.dashboardStartupProbe = "true";
        style.textContent = styleText;
        (document.head || document.documentElement).appendChild(style);
      };
      if (document.documentElement) {
        installStyle();
      } else {
        document.addEventListener("DOMContentLoaded", installStyle, { once: true });
      }
    }
  }, scenario.style ?? "");

  const startedAt = Date.now();
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  const domContentLoadedMs = Date.now() - startedAt;
  await page.waitForTimeout(2600);

  const probe = await page.evaluate(() => {
    const state = window.__dashboardStartupProbe.read();
    const resources = performance
      .getEntriesByType("resource")
      .map((entry) => ({
        duration: entry.duration,
        initiatorType: entry.initiatorType,
        name: entry.name,
        transferSize: entry.transferSize,
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 12);

    return {
      ...state,
      dom: {
        heroSources: document.querySelectorAll(".public-home-hero-video source[src]").length,
        modelLogos: document.querySelectorAll(".public-home-model-logo").length,
        nodeCount: document.querySelectorAll("*").length,
        orbitPills: document.querySelectorAll(".public-home-tool-pill").length,
        showcaseCards: document.querySelectorAll(".dashboard-tutorial-card").length,
        tutorialVideos: document.querySelectorAll("video[data-dashboard-tutorial-index]").length,
      },
      resources,
    };
  });

  await throttledContext.close();

  return {
    label: scenario.label,
    domContentLoadedMs,
    ...summarizeFrames(probe.frameDeltas),
    longTaskCount: probe.longTasks.length,
    longTaskTotal: Number(probe.longTasks.reduce((sum, task) => sum + task.duration, 0).toFixed(2)),
    topLongTasks: probe.longTasks
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 8)
      .map((task) => ({
        duration: Number(task.duration.toFixed(2)),
        name: task.name,
        startTime: Number(task.startTime.toFixed(2)),
      })),
    dom: probe.dom,
    resources: probe.resources.map((resource) => ({
      duration: Number(resource.duration.toFixed(2)),
      initiatorType: resource.initiatorType,
      name: resource.name.replace(locationOriginPattern(), ""),
      transferSize: resource.transferSize,
    })),
  };
}

function locationOriginPattern() {
  return /^https?:\/\/127\.0\.0\.1:3000/;
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
for (const scenario of scenarios) {
  results.push(await runScenario(browser, scenario));
}
await browser.close();

const summary = {
  branchRule: "local codex/brother-dashboard-aesthetics only; production not touched",
  targetUrl,
  capturedAt: new Date().toISOString(),
  viewport: { width: 390, height: 844, isMobile: true, cpuThrottle: 4 },
  results,
};

await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
