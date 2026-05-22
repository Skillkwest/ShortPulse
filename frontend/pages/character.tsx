/**
 * Deprecated standalone Character route.
 * Redirects into AI Studio, which now owns all active Character workflows.
 */
import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: "/ai-studio",
    permanent: false,
  },
});

export default function CharacterPageRedirect() {
  return null;
}
