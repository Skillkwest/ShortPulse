import { describe, expect, it } from "vitest";
import { normalizeAdminGlobalStatsResponse } from "../adminGlobalStatsApi";

describe("adminGlobalStatsApi", () => {
  it("normalizes populated stats payloads", () => {
    const normalized = normalizeAdminGlobalStatsResponse({
      overview: {
        generateClicks: {
          total: 12,
          last24h: 3,
          last7d: 9,
        },
        acceptedGenerations: {
          total: 8,
          last24h: 2,
          last7d: 6,
        },
        successfulGenerations: {
          total: 6,
          last24h: 2,
          last7d: 5,
        },
        failedGenerations: {
          total: 2,
          last24h: 0,
          last7d: 1,
        },
        savedGenerations: {
          total: 4,
          last24h: 1,
          last7d: 3,
        },
        projectAttachedGenerations: {
          total: 5,
          last24h: 1,
          last7d: 4,
        },
        uniqueModels: 3,
      },
      models: [
        {
          modelId: "fal-ai/nano-banana-pro",
          generateClicks: {
            total: 7,
            last24h: 2,
            last7d: 6,
          },
          acceptedGenerations: {
            total: 5,
            last24h: 1,
            last7d: 4,
          },
          successfulGenerations: {
            total: 4,
            last24h: 1,
            last7d: 3,
          },
        },
      ],
      workflows: {
        byTool: [
          {
            toolKey: "create",
            generateClicks: {
              total: 6,
              last24h: 2,
              last7d: 5,
            },
          },
        ],
      },
      assets: {
        events: [
          {
            eventType: "generation_saved",
            count: {
              total: 4,
              last24h: 1,
              last7d: 3,
            },
          },
        ],
      },
      projects: {
        summary: {
          projectsCreated: {
            total: 2,
            last24h: 1,
            last7d: 2,
          },
        },
      },
      health: {
        degraded: true,
        reason: "migration missing",
        overviewSource: "legacy_fallback",
        modelsSource: "legacy_fallback",
        workflowsSource: "unavailable",
        assetsSource: "unavailable",
        projectsSource: "unavailable",
      },
      generatedAt: "2026-04-24T00:00:00.000Z",
    });

    expect(normalized.overview.generateClicks.total).toBe(12);
    expect(normalized.overview.acceptedGenerations.total).toBe(8);
    expect(normalized.overview.uniqueModels).toBe(3);
    expect(normalized.models[0]).toEqual(
      expect.objectContaining({
        modelId: "fal-ai/nano-banana-pro",
        generateClicks: expect.objectContaining({ total: 7 }),
        acceptedGenerations: expect.objectContaining({ total: 5 }),
        successfulGenerations: expect.objectContaining({ total: 4 }),
      })
    );
    expect(normalized.workflows.byTool[0]?.toolKey).toBe("create");
    expect(normalized.assets.events[0]?.eventType).toBe("generation_saved");
    expect(normalized.projects.summary.projectsCreated.total).toBe(2);
    expect(normalized.health).toEqual({
      degraded: true,
      reason: "migration missing",
      overviewSource: "legacy_fallback",
      modelsSource: "legacy_fallback",
      workflowsSource: "unavailable",
      assetsSource: "unavailable",
      projectsSource: "unavailable",
    });
    expect(normalized.generatedAt).toBe("2026-04-24T00:00:00.000Z");
  });

  it("falls back to safe defaults for sparse payloads", () => {
    const normalized = normalizeAdminGlobalStatsResponse({});

    expect(normalized.overview.generateClicks.total).toBe(0);
    expect(normalized.overview.acceptedGenerations.total).toBe(0);
    expect(normalized.models).toEqual([]);
    expect(normalized.workflows.byTool).toEqual([]);
    expect(normalized.assets.events).toEqual([]);
    expect(normalized.projects.leaderboard).toEqual([]);
    expect(normalized.health.degraded).toBe(false);
    expect(normalized.health.overviewSource).toBe("legacy_fallback");
    expect(normalized.health.modelsSource).toBe("unavailable");
    expect(normalized.generatedAt).toBeNull();
  });
});
