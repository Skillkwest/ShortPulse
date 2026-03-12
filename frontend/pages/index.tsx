/**
 * Root route gate.
 * Sends all visitors to the dashboard entry route.
 */
import { useRouter } from "next/router";
import { useEffect } from "react";

/**
 * Route all root traffic through the dashboard auth gate.
 */
export default function IndexRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return null;
}
