import { routes, type VercelConfig } from "@vercel/config/v1";

/**
 * Singapore for both the functions and the Supabase project: the game does a
 * database round trip per action, so keeping compute next to the data is the
 * single biggest latency win for players in Thailand.
 */
export const config: VercelConfig = {
  framework: "nextjs",
  regions: ["sin1"],
  headers: [
    routes.cacheControl("/icons/(.*)", {
      public: true,
      maxAge: "7days",
      sMaxAge: "7days",
    }),
    routes.cacheControl("/manifest.webmanifest", { public: true, maxAge: "1hour" }),
    // Saves are per-player, so nothing in the health/keep-alive path may be shared.
    routes.cacheControl("/api/health", { noStore: true }),
  ],
  crons: [
    {
      // Keeps the free Supabase project from pausing after a quiet week.
      path: "/api/health",
      schedule: "0 3 * * *",
    },
  ],
};

export default config;
