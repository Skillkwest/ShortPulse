/**
 * Static generation timeout coverage for public ISR routes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPublicDashboardStaticProps } from "../../features/dashboard/routes/publicDashboardData";
import { getStaticProps as getPricingStaticProps } from "../../pages/pricing";

const loadBillingCatalogSnapshotMock = vi.hoisted(() => vi.fn());
const readActiveDashboardTutorialsMock = vi.hoisted(() => vi.fn());
const getSupabaseAdminMock = vi.hoisted(() => vi.fn());

vi.mock("../../features/pricing/components/PricingRoute", () => ({
  PricingRoute: () => null,
}));

vi.mock("../../lib/server/api/billingCatalog", () => ({
  loadBillingCatalogSnapshot: (...args: unknown[]) => loadBillingCatalogSnapshotMock(...args),
}));

vi.mock("../../lib/server/api/dashboardTutorials", () => ({
  readActiveDashboardTutorials: (...args: unknown[]) => readActiveDashboardTutorialsMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

describe("public static generation timeout guards", () => {
  beforeEach(() => {
    vi.stubEnv("SHORTPULSE_STATIC_GENERATION_DATA_TIMEOUT_MS", "10");
    vi.clearAllMocks();
    getSupabaseAdminMock.mockReturnValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns degraded pricing props when the billing catalog read hangs", async () => {
    loadBillingCatalogSnapshotMock.mockReturnValue(new Promise(() => {}));

    const staticPropsPromise = getPricingStaticProps({});

    await expect(staticPropsPromise).resolves.toEqual({
      props: {
        billingCatalog: {
          plans: [],
          packages: [],
          storageAddons: [],
        },
      },
      revalidate: 60,
    });
  });

  it("returns degraded dashboard props when build-time public data reads hang", async () => {
    loadBillingCatalogSnapshotMock.mockReturnValue(new Promise(() => {}));
    readActiveDashboardTutorialsMock.mockReturnValue(new Promise(() => {}));

    const staticPropsPromise = loadPublicDashboardStaticProps();

    await expect(staticPropsPromise).resolves.toEqual({
      billingCatalog: {
        plans: [],
        packages: [],
        storageAddons: [],
      },
      dashboardOffers: [],
      dashboardTutorials: [],
    });
  });
});
