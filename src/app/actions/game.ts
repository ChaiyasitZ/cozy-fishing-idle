"use server";

import { applyCommand, migrateState, sanitizeForClient, type Command } from "@/game/engine";
import type { GameState } from "@/game/types";
import type { GameSnapshot } from "@/lib/game/types";
import {
  loadProfileState,
  saveProfileState,
  shouldAudit,
  takeToken,
  writeAudit,
} from "@/lib/game/repo";
import { getSessionUser } from "@/lib/supabase/server";

/** Loads the cloud save and settles offline progress in one round trip. */
export async function loadGameAction(): Promise<GameSnapshot | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const now = Date.now();
  const loaded = await loadProfileState(user, now);
  if (!loaded) return null;

  const { state, effects } = applyCommand(loaded.state, { type: "tick" }, now);
  await saveProfileState(user.id, loaded.profile, state, {}, now);
  return { state: sanitizeForClient(state), effects };
}

/**
 * The only mutation endpoint. Server-authoritative: it reloads the save, runs
 * the same pure engine the client uses, and writes the result back.
 */
export async function runCommandAction(command: Command): Promise<GameSnapshot> {
  const user = await getSessionUser();
  if (!user) throw new Error("unauthenticated");
  if (!takeToken(user.id)) throw new Error("rate_limited");

  const now = Date.now();
  const loaded = await loadProfileState(user, now);
  if (!loaded) throw new Error("no_profile");

  const { state, effects } = applyCommand(loaded.state, command, now);

  const caught = effects.catchResult?.fish;
  await saveProfileState(
    user.id,
    loaded.profile,
    state,
    caught
      ? { caughtSize: caught.sizeCm, caughtSpecies: caught.speciesId, caughtCount: 1 }
      : {},
    now,
  );

  if (shouldAudit(command)) {
    await writeAudit(user.id, command.type, { level: state.level, coins: state.coins });
  }

  return { state: sanitizeForClient(state), effects };
}

/**
 * Called once after a guest signs in: if their local save is further along than
 * the (empty) cloud save, it wins. Never overwrites real cloud progress.
 */
export async function uploadGuestSaveAction(
  incoming: GameState,
): Promise<GameSnapshot | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const now = Date.now();
  const loaded = await loadProfileState(user, now);
  if (!loaded) return null;

  const local = migrateState(incoming, now);
  const cloudProgress = loaded.state.stats.totalCaught + loaded.state.stats.casts;
  const localProgress = local.stats.totalCaught + local.stats.casts;
  if (cloudProgress > localProgress) {
    const settled = applyCommand(loaded.state, { type: "tick" }, now);
    return { state: sanitizeForClient(settled.state), effects: settled.effects };
  }

  const merged = applyCommand(local, { type: "tick" }, now);
  await saveProfileState(user.id, loaded.profile, merged.state, {}, now);
  await writeAudit(user.id, "guest_save_uploaded", {
    caught: local.stats.totalCaught,
    level: local.level,
  });
  return { state: sanitizeForClient(merged.state), effects: merged.effects };
}
