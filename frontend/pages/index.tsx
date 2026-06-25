/**
 * Root dashboard/home route.
 * Reuses the session-aware dashboard shell so public CTAs do not render over stored auth.
 */
import type { GetStaticProps, InferGetStaticPropsType } from "next";
import {
  loadPublicDashboardStaticProps,
  type PublicDashboardStaticProps,
} from "../features/dashboard/routes/publicDashboardData";
import DashboardPage from "./dashboard";

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
 * Renders the root dashboard/home surface with the canonical dashboard session bootstrap.
 */
export default function IndexPage(props: InferGetStaticPropsType<typeof getStaticProps>) {
  return <DashboardPage {...props} />;
}
