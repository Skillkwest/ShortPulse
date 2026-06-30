/**
 * Public dashboard route data loader.
 * Centralizes the shared static props used by `/` and the anonymous `/dashboard` surface.
 */
import type { BillingCatalogSnapshot } from "../../billing/catalog";
import { loadBillingCatalogSnapshot } from "../../../lib/server/api/billingCatalog";
import type { DashboardOffer } from "../../../lib/server/api/dashboardOffers";
import {
  readActiveDashboardTutorials,
  type DashboardTutorial,
} from "../../../lib/server/api/dashboardTutorials";
import { withStaticGenerationDataTimeout } from "../../../lib/server/api/staticGenerationTimeout";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

export type PublicDashboardStaticProps = {
  billingCatalog: BillingCatalogSnapshot;
  dashboardOffers: DashboardOffer[];
  dashboardTutorials: DashboardTutorial[];
};

export const emptyBillingCatalogSnapshot = (): BillingCatalogSnapshot => ({
  plans: [],
  packages: [],
  storageAddons: [],
});

const loadDashboardTutorialsSnapshot = async (): Promise<DashboardTutorial[]> => {
  try {
    return await readActiveDashboardTutorials(getSupabaseAdmin(), undefined, {
      usePublicDeliveryUrls: true,
    });
  } catch {
    return [];
  }
};

/**
 * Loads the public billing catalog and tutorial snapshots.
 * Dashboard offers are intentionally hidden for the July 7 launch window.
 */
export const loadPublicDashboardStaticProps = async (): Promise<PublicDashboardStaticProps> => {
  const [billingCatalogResult, dashboardTutorialsResult] = await Promise.allSettled([
    withStaticGenerationDataTimeout(loadBillingCatalogSnapshot(), "dashboard billing catalog"),
    withStaticGenerationDataTimeout(loadDashboardTutorialsSnapshot(), "dashboard tutorials"),
  ]);

  return {
    billingCatalog:
      billingCatalogResult.status === "fulfilled"
        ? billingCatalogResult.value
        : emptyBillingCatalogSnapshot(),
    dashboardOffers: [],
    dashboardTutorials:
      dashboardTutorialsResult.status === "fulfilled" ? dashboardTutorialsResult.value : [],
  };
};
