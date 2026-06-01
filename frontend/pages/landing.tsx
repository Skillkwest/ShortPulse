/**
 * Legacy landing-route alias.
 * Keeps historic `/landing` links working by serving the public dashboard/home surface.
 */
import type { GetStaticProps, InferGetStaticPropsType } from "next";
import { PublicDashboardRoute } from "../features/dashboard/routes/PublicDashboardRoute";
import {
  loadPublicDashboardStaticProps,
  type PublicDashboardStaticProps,
} from "../features/dashboard/routes/publicDashboardData";

/**
 * Loads the public dashboard/home static props for the legacy landing route.
 */
export const getStaticProps: GetStaticProps<PublicDashboardStaticProps> = async () => {
  return {
    props: await loadPublicDashboardStaticProps(),
    revalidate: 60,
  };
};

/**
 * Renders the legacy landing route as the shared public dashboard/home surface.
 */
export default function LandingPage({
  billingCatalog,
  dashboardOffers,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return <PublicDashboardRoute billingCatalog={billingCatalog} dashboardOffers={dashboardOffers} />;
}
