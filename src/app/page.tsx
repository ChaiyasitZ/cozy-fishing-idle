import { GameShell } from "@/components/game/GameShell";
import { loadGameAction } from "@/app/actions/game";
import { getSocialAction } from "@/app/actions/social";
import type { AccountInfo } from "@/lib/game/types";
import { hasCloudSaves } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/supabase/server";

/**
 * The save is per-player and offline progress is settled on load, so this page
 * must never be prerendered or cached.
 */
export const dynamic = "force-dynamic";

export default async function GamePage() {
  const cloudAvailable = hasCloudSaves();
  const user = cloudAvailable ? await getSessionUser() : null;

  const snapshot = user ? await loadGameAction() : null;
  const social = user && snapshot ? await getSocialAction() : null;

  const account: AccountInfo = {
    signedIn: !!user && !!snapshot,
    label: user?.email ?? (user?.isAnonymous ? "guest (cloud)" : null),
    isAnonymous: user?.isAnonymous ?? false,
    cloudAvailable,
  };

  return (
    <GameShell
      mode={snapshot ? "cloud" : "guest"}
      initialState={snapshot?.state ?? null}
      initialIdle={snapshot?.effects.idle ?? null}
      account={account}
      social={social}
    />
  );
}
