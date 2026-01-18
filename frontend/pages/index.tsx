/**
 * Redirect root to the landing page to avoid 404s in local dev.
 */
import { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: "/landing",
      permanent: false,
    },
  };
};

export default function IndexRedirect() {
  return null;
}
