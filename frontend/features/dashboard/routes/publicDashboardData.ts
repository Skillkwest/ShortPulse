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
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

export type PublicDashboardStaticProps = {
  billingCatalog: BillingCatalogSnapshot;
  dashboardOffers: DashboardOffer[];
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

/**
 * Loads the public billing catalog snapshot and logged-out dashboard offers.
 */
export const loadPublicDashboardStaticProps = async (): Promise<PublicDashboardStaticProps> => {
  const [billingCatalogResult, dashboardOffersResult] = await Promise.allSettled([
    loadBillingCatalogSnapshot(),
    loadDashboardOffersSnapshot(),
  ]);

  return {
    billingCatalog:
      billingCatalogResult.status === "fulfilled"
        ? billingCatalogResult.value
        : emptyBillingCatalogSnapshot(),
    dashboardOffers:
      dashboardOffersResult.status === "fulfilled" ? dashboardOffersResult.value : [],
  };
};
