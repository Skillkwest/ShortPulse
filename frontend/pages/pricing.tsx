/**
 * Public pricing route entry point.
 * Loads the live billing catalog and delegates rendering to the pricing feature surface.
 */
import type { GetStaticProps, InferGetStaticPropsType } from "next";
import { PricingRoute } from "../features/pricing/components/PricingRoute";
import type { BillingCatalogSnapshot } from "../features/billing/catalog";
import { loadBillingCatalogSnapshot } from "../lib/server/api/billingCatalog";
import { withStaticGenerationDataTimeout } from "../lib/server/api/staticGenerationTimeout";

const emptyBillingCatalogSnapshot = (): BillingCatalogSnapshot => ({
  plans: [],
  packages: [],
  storageAddons: [],
});

/**
 * Loads the public billing catalog snapshot used by the pricing route.
 */
export const getStaticProps: GetStaticProps<{
  billingCatalog: BillingCatalogSnapshot;
}> = async () => {
  try {
    const billingCatalog = await withStaticGenerationDataTimeout(
      loadBillingCatalogSnapshot(),
      "pricing billing catalog"
    );
    return {
      props: { billingCatalog },
      revalidate: 60,
    };
  } catch {
    return {
      props: { billingCatalog: emptyBillingCatalogSnapshot() },
      revalidate: 60,
    };
  }
};

/**
 * Renders the public pricing route with the current billing catalog snapshot.
 */
export default function PricingPage({
  billingCatalog,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return <PricingRoute billingCatalog={billingCatalog} />;
}
