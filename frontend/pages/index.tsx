/**
 * Root public dashboard/home route.
 * Serves the logged-out dashboard surface without the session-aware dashboard bundle.
 */
import type { GetStaticProps, InferGetStaticPropsType } from "next";
import { PublicDashboardRoute } from "../features/dashboard/routes/PublicDashboardRoute";
import {
  loadPublicDashboardStaticProps,
  type PublicDashboardStaticProps,
} from "../features/dashboard/routes/publicDashboardData";

/**
 * Loads the public dashboard/home static props for the root route.
 */
export const getStaticProps: GetStaticProps<PublicDashboardStaticProps> = async () => {
  return {
    props: await loadPublicDashboardStaticProps(),
    revalidate: 60,
  };
};

/**
 * Renders the public dashboard/home surface at the root route.
 */
export default function IndexPage({
  billingCatalog,
  dashboardOffers,
  dashboardTutorials,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <PublicDashboardRoute
      billingCatalog={billingCatalog}
      dashboardOffers={dashboardOffers}
      dashboardTutorials={dashboardTutorials}
    />
  );
}
