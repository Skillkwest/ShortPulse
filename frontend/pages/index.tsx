/**
 * Root route gate.
 * Sends authenticated users to the dashboard and everyone else to the landing page.
 */
import { useRouter } from "next/router";
import { useEffect } from "react";
import { ensureSupabaseClient } from "../lib/supabaseClient";

/**
 * Resolve the best entry route for the current visitor.
 */
export default function IndexRedirect() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    try {
      const supabase = ensureSupabaseClient();
      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (!mounted) return;
          const destination = data.session ? "/dashboard" : "/landing";
          router.replace(destination);
        })
        .catch(() => {
          if (!mounted) return;
          router.replace("/landing");
        });
    } catch {
      if (mounted) {
        router.replace("/landing");
      }
    }

    return () => {
      mounted = false;
    };
  }, [router]);

  return null;
}
