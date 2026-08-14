import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  isSupabaseConfigured,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "./env";

/**
 * Session-scoped client for Server Components, Server Actions and Route
 * Handlers. Reads are subject to RLS, which is exactly what we want here.
 */
export async function createServerSupabase() {
  if (!isSupabaseConfigured()) return null;
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't write cookies; proxy.ts refreshes instead.
        }
      },
    },
  });
}

export interface SessionUser {
  id: string;
  email: string | null;
  isAnonymous: boolean;
}

/**
 * Verified identity for the current request. Uses getClaims(), which checks the
 * JWT signature, rather than trusting whatever the cookie says.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const claims = data.claims as {
    sub: string;
    email?: string;
    is_anonymous?: boolean;
  };
  return {
    id: claims.sub,
    email: claims.email ?? null,
    isAnonymous: claims.is_anonymous === true,
  };
}
