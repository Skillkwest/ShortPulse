/**
 * Minimal API client that automatically attaches the Supabase JWT to backend requests.
 */
import { ensureSupabaseClient } from "./supabaseClient";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export async function apiFetch(path: string, init?: RequestInit) {
  const supabase = ensureSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("No Supabase session found; redirect to /auth before calling protected APIs.");
  }

  const headers = new Headers(init?.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", headers.get("Content-Type") || "application/json");

  const response = await fetch(`${apiBase}${path}`, { ...init, headers });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`API request failed (${response.status}): ${message}`);
  }
  return response;
}
