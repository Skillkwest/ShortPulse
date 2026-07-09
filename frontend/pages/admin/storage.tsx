/**
 * Admin storage route.
 * Parked while the admin storage workspace is deactivated.
 */
import type { GetServerSideProps } from "next";

export default function AdminStoragePage() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  notFound: true,
});
