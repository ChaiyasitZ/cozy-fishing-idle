import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSecretKey, isSupabaseConfigured, SUPABASE_URL } from "./env";

let cached: SupabaseClient | null = null;

/**
 * Server-only client with the secret key. It bypasses RLS, so every query made
 * with it must scope rows by the user id verified from the session — the game's
 * whole write path depends on that discipline.
 */
export function createAdminClient(): SupabaseClient | null {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient must never run in the browser");
  }
  const secret = getSecretKey();
  if (!isSupabaseConfigured() || !secret) return null;
  if (cached) return cached;

  cached = createClient(SUPABASE_URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function hasCloudSaves(): boolean {
  return isSupabaseConfigured() && getSecretKey().length > 0;
}
