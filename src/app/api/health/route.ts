import { NextResponse } from "next/server";
import { CONTENT_VERSION, SAVE_VERSION } from "@/game/data";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Health check and keep-alive. A daily Vercel Cron hit is enough to stop a free
 * Supabase project from pausing after a week without traffic.
 */
export async function GET() {
  const supabase = createAdminClient();
  let database: "ok" | "error" | "not_configured" = "not_configured";

  if (supabase) {
    const { error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });
    database = error ? "error" : "ok";
  }

  return NextResponse.json(
    {
      status: database === "error" ? "degraded" : "ok",
      database,
      contentVersion: CONTENT_VERSION,
      saveVersion: SAVE_VERSION,
      time: new Date().toISOString(),
    },
    { status: database === "error" ? 503 : 200, headers: { "cache-control": "no-store" } },
  );
}
