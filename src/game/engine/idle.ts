import { SPECIES_BY_ID } from "@/game/data";
import type { FishInstance, GameState, IdleReport } from "@/game/types";
import { contextLuck, rollFish } from "./catch";
import { fishValue } from "./economy";
import { addLog } from "./log";
import { getModifiers, grantXp } from "./modifiers";
import { currentFreshness, isMature, pendingHarvest } from "./pond";
import { refreshQuests, trackQuest } from "./quests";
import { createRng } from "./rng";

/** Hard ceiling on simulated catches so a long absence can't blow up a save. */
const MAX_OFFLINE_CATCHES = 240;

/**
 * The single source of truth for "what happened while I was away". Called on
 * load and before every action, on the server when signed in. Deterministic:
 * the same state and timestamp always produce the same result.
 */
export function resolveIdle(
  state: GameState,
  now = Date.now(),
): { state: GameState; report: IdleReport } {
  const mods = getModifiers(state);
  const elapsed = Math.max(0, now - state.lastTickAt);
  const capped = Math.min(elapsed, mods.offlineCapMs);

  const report: IdleReport = {
    elapsedMs: elapsed,
    cappedMs: capped,
    caught: [],
    autoSoldCount: 0,
    autoSoldCoins: 0,
    pondCoins: 0,
    pondPearls: 0,
    matured: 0,
    eggs: 0,
  };

  if (elapsed < 1000) {
    state.lastTickAt = now;
    refreshQuests(state, now);
    return { state, report };
  }

  // The deck cat keeps fishing while you're gone, with less luck than you.
  if (Number.isFinite(mods.autoCatchIntervalMs)) {
    const rolls = Math.min(
      MAX_OFFLINE_CATCHES,
      Math.floor(capped / mods.autoCatchIntervalMs),
    );
    if (rolls > 0) {
      const rng = createRng(state.rngSeed);
      const luck = contextLuck(state, state.zoneId, now) * 0.5;
      const caught: FishInstance[] = [];

      for (let i = 0; i < rolls; i++) {
        const at = state.lastTickAt + i * mods.autoCatchIntervalMs;
        const fish = rollFish(state, state.zoneId, rng, at, luck, mods.sizeMultiplier * 0.94);
        if (!fish) continue;

        const dex = state.fishdex[fish.speciesId];
        state.fishdex[fish.speciesId] = {
          count: (dex?.count ?? 0) + 1,
          maxSize: Math.max(dex?.maxSize ?? 0, fish.sizeCm),
          bestStars: Math.max(dex?.bestStars ?? 0, fish.stars),
          firstAt: dex?.firstAt ?? at,
        };
        state.stats.totalCaught += 1;
        if (!state.stats.biggest || fish.sizeCm > state.stats.biggest.sizeCm) {
          state.stats.biggest = { speciesId: fish.speciesId, sizeCm: fish.sizeCm };
        }
        trackQuest(state, "catch", 1);

        const rarity = SPECIES_BY_ID[fish.speciesId]?.rarity;
        if (rarity && ["rare", "epic", "legendary", "mythic"].includes(rarity)) {
          trackQuest(state, "rare", 1);
        }
        if (rarity && ["epic", "legendary", "mythic"].includes(rarity)) {
          trackQuest(state, "epic", 1);
        }

        if (state.bag.length < mods.bagCapacity) {
          state.bag.push(fish);
          caught.push(fish);
        } else {
          const value = fishValue(state, fish, now);
          state.coins += value;
          state.stats.coinsEarned += value;
          state.stats.totalSold += 1;
          report.autoSoldCount += 1;
          report.autoSoldCoins += value;
          trackQuest(state, "coins", value);
        }
        grantXp(state, 3);
      }

      state.rngSeed = rng.seed;
      report.caught = caught;
    }
  }

  // Pond income is not auto-collected — it waits for the player to come back.
  const waiting = pendingHarvest(state, now);
  report.pondCoins = waiting.coins;
  report.pondPearls = waiting.pearls;
  report.matured = state.pond.fish.filter((f) => isMature(f, now)).length;

  // Persist the decayed freshness so the anchor moves forward with the clock.
  state.pond.freshness = currentFreshness(state, now);
  state.pond.lastFedAt = now;

  refreshQuests(state, now);
  state.lastTickAt = now;

  const gained = report.caught.length + report.autoSoldCount;
  if (gained > 0) {
    addLog(
      state,
      "idle",
      `แมวลูกเรือตกปลาให้ ${gained} ตัวระหว่างคุณไม่อยู่`,
      `The deck cat landed ${gained} fish while you were away.`,
      now,
    );
  }
  return { state, report };
}

/** Human-readable "you were away for..." used by the welcome-back card. */
export function formatDuration(ms: number, locale: "th" | "en"): string {
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (locale === "th") {
    if (days > 0) return `${days} วัน ${hours % 24} ชม.`;
    if (hours > 0) return `${hours} ชม. ${mins % 60} นาที`;
    return `${mins} นาที`;
  }
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}
