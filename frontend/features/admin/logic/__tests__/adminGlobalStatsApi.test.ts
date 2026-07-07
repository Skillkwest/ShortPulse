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
      generationBreakdown: {
        summary: {
          acceptedGenerations: { total: 8, last24h: 2, last7d: 6 },
          successfulGenerations: { total: 6, last24h: 2, last7d: 5 },
          failedGenerations: { total: 2, last24h: 0, last7d: 1 },
          imageGenerations: { total: 5, last24h: 1, last7d: 4 },
          videoGenerations: { total: 2, last24h: 1, last7d: 1 },
          audioGenerations: { total: 1, last24h: 0, last7d: 1 },
          unknownGenerations: { total: 0, last24h: 0, last7d: 0 },
          uniqueUsers: 2,
          uniqueModels: 3,
          lastGenerationAt: "2026-04-24T00:00:00.000Z",
        },
        users: [
          {
            userId: "user-1",
            email: "creator@example.com",
            acceptedGenerations: { total: 6, last24h: 2, last7d: 5 },
            imageGenerations: { total: 4, last24h: 1, last7d: 3 },
            videoGenerations: { total: 1, last24h: 1, last7d: 1 },
            audioGenerations: { total: 1, last24h: 0, last7d: 1 },
            uniqueModels: 2,
            lastGenerationAt: "2026-04-24T00:00:00.000Z",
          },
        ],
        modelMediaTypes: [
          {
            modelId: "fal-ai/nano-banana-pro",
            mediaType: "image",
            acceptedGenerations: { total: 5, last24h: 1, last7d: 4 },
            successfulGenerations: { total: 4, last24h: 1, last7d: 3 },
            uniqueUsers: 2,
            lastGenerationAt: "2026-04-24T00:00:00.000Z",
          },
        ],
      },
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
      growth: {
        marketing: {
          summary: {
            signups: { total: 10, last24h: 2, last7d: 6 },
            activatedUsers: { total: 6, last24h: 1, last7d: 4 },
            activationRatePct: { total: 60, last24h: 50, last7d: 66.7 },
            medianHours: {
              signupToGenerate: 1.2,
              signupToSuccess: 2.4,
              signupToActivation: 6.1,
              generateToActivation: 3.7,
            },
          },
          retention: {
            activated: {
              cohortSize: 6,
              eligibleD1: 6,
              retainedD1: 4,
              d1RatePct: 66.7,
              eligibleD7: 3,
              retainedD7: 2,
              d7RatePct: 66.7,
              eligibleD30: 1,
              retainedD30: 1,
              d30RatePct: 100,
            },
            nonActivated: {
              cohortSize: 4,
              eligibleD1: 4,
              retainedD1: 1,
              d1RatePct: 25,
              eligibleD7: 2,
              retainedD7: 0,
              d7RatePct: 0,
              eligibleD30: 1,
              retainedD30: 0,
              d30RatePct: 0,
            },
          },
          attribution: {
            sources: [
              {
                sourceKey: "google",
                signups: 4,
                activatedUsers: 3,
                activationRatePct: 75,
                pqlUsers: 2,
                paidUsers: 1,
              },
            ],
            campaigns: [
              {
                campaignKey: "spring_launch",
                signups: 4,
                activatedUsers: 3,
                activationRatePct: 75,
                pqlUsers: 2,
                paidUsers: 1,
              },
            ],
          },
        },
        sales: {
          summary: {
            pricingViewedUsers: { total: 5, last24h: 1, last7d: 4 },
            upgradeClickedUsers: { total: 4, last24h: 1, last7d: 3 },
            checkoutStartedUsers: { total: 3, last24h: 1, last7d: 2 },
            checkoutCompletedUsers: { total: 2, last24h: 1, last7d: 2 },
            paidConvertedUsers: { total: 1, last24h: 0, last7d: 1 },
            pqlUsers: { total: 2, last24h: 0, last7d: 1 },
            activatedToPqlRatePct: 33.3,
            pqlToPaidRatePct: 50,
          },
          highIntentUsers: [
            {
              userId: "user-1",
              email: "user@example.com",
              sourceKey: "google",
              campaignKey: "spring_launch",
              activatedAt: "2026-04-23T00:00:00.000Z",
              pqlScore: 3,
              isPql: true,
              savedOutputs: 4,
              successfulGenerations: 6,
              activeDays: 3,
              projectsCreated: 1,
              projectAttachedGenerations: 2,
              creditSpendCents: 120,
              pricingViewedAt: "2026-04-22T00:00:00.000Z",
              upgradeClickedAt: "2026-04-23T00:00:00.000Z",
              checkoutStartedAt: "2026-04-23T00:30:00.000Z",
              checkoutCompletedAt: "2026-04-23T00:40:00.000Z",
              paidConvertedAt: "2026-04-23T01:00:00.000Z",
            },
          ],
        },
        health: {
          degraded: true,
          reason: "growth migration missing",
          marketingSource: "unavailable",
          salesSource: "unavailable",
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
    expect(normalized.generationBreakdown.summary.imageGenerations.total).toBe(5);
    expect(normalized.generationBreakdown.users[0]).toEqual(
      expect.objectContaining({
        userId: "user-1",
        email: "creator@example.com",
        acceptedGenerations: expect.objectContaining({ total: 6 }),
        failedGenerations: expect.objectContaining({ total: 0 }),
      })
    );
    expect(normalized.generationBreakdown.modelMediaTypes[0]).toEqual(
      expect.objectContaining({
        modelId: "fal-ai/nano-banana-pro",
        mediaType: "image",
        uniqueUsers: 2,
      })
    );
    expect(normalized.workflows.byTool[0]?.toolKey).toBe("create");
    expect(normalized.assets.events[0]?.eventType).toBe("generation_saved");
    expect(normalized.projects.summary.projectsCreated.total).toBe(2);
    expect(normalized.growth.marketing.summary.signups.total).toBe(10);
    expect(normalized.growth.marketing.attribution.sources[0]?.sourceKey).toBe("google");
    expect(normalized.growth.sales.summary.checkoutStartedUsers.total).toBe(3);
    expect(normalized.growth.sales.highIntentUsers[0]?.email).toBe("user@example.com");
    expect(normalized.growth.health.reason).toBe("growth migration missing");
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
    expect(normalized.generationBreakdown.users).toEqual([]);
    expect(normalized.generationBreakdown.summary.acceptedGenerations.total).toBe(0);
    expect(normalized.workflows.byTool).toEqual([]);
    expect(normalized.assets.events).toEqual([]);
    expect(normalized.projects.leaderboard).toEqual([]);
    expect(normalized.growth.marketing.summary.signups.total).toBe(0);
    expect(normalized.growth.sales.highIntentUsers).toEqual([]);
    expect(normalized.growth.health.marketingSource).toBe("unavailable");
    expect(normalized.health.degraded).toBe(false);
    expect(normalized.health.overviewSource).toBe("legacy_fallback");
    expect(normalized.health.modelsSource).toBe("unavailable");
    expect(normalized.generatedAt).toBeNull();
  });
});
