/**
 * Public dashboard route data loader.
 * Centralizes the shared static props used by `/` and the anonymous `/dashboard` surface.
 */
import type { BillingCatalogSnapshot } from "../../billing/catalog";
import { loadBillingCatalogSnapshot } from "../../../lib/server/api/billingCatalog";
import {
  readActiveDashboardOffers,
  type DashboardOffer,
} from "../../../lib/server/api/dashboardOffers";
import {
  readActiveDashboardTutorials,
  type DashboardTutorial,
} from "../../../lib/server/api/dashboardTutorials";
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

const loadDashboardOffersSnapshot = async (): Promise<DashboardOffer[]> => {
  try {
    return await readActiveDashboardOffers(getSupabaseAdmin());
  } catch {
    return [];
  }
};

const loadDashboardTutorialsSnapshot = async (): Promise<DashboardTutorial[]> => {
  try {
    return await readActiveDashboardTutorials(getSupabaseAdmin());
  } catch {
    return [];
  }
};

/**
 * Loads the public billing catalog snapshot, logged-out dashboard offers, and tutorials.
 */
export const loadPublicDashboardStaticProps = async (): Promise<PublicDashboardStaticProps> => {
  const [billingCatalogResult, dashboardOffersResult, dashboardTutorialsResult] =
    await Promise.allSettled([
      loadBillingCatalogSnapshot(),
      loadDashboardOffersSnapshot(),
      loadDashboardTutorialsSnapshot(),
    ]);

  return {
    billingCatalog:
      billingCatalogResult.status === "fulfilled"
        ? billingCatalogResult.value
        : emptyBillingCatalogSnapshot(),
    dashboardOffers:
      dashboardOffersResult.status === "fulfilled" ? dashboardOffersResult.value : [],
    dashboardTutorials:
      dashboardTutorialsResult.status === "fulfilled" ? dashboardTutorialsResult.value : [],
  };
};
