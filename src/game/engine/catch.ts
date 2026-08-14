import {
  ITEM_BY_ID,
  JUNK_TABLE,
  RARITY_WEIGHT,
  SPECIES_BY_ID,
  SPECIES_BY_ZONE,
  ZONE_BY_ID,
} from "@/game/data";
import type {
  CatchResult,
  FishInstance,
  GameState,
  MutationId,
  PendingCast,
  Rarity,
  Species,
  ZoneId,
} from "@/game/types";
import { fishValue } from "./economy";
import { addLog } from "./log";
import { getModifiers, grantXp, lvl } from "./modifiers";
import { trackQuest } from "./quests";
import { createRng, makeId, type Rng } from "./rng";
import { timeOfDay, weatherAt, WEATHER_LUCK } from "./world";

export const CAST_TIMEOUT_MS = 5200;

/** How much extra weight luck gives each rarity tier. */
const LUCK_TIER: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2.6,
  epic: 4.2,
  legendary: 6,
  mythic: 8,
};

const STAR_WEIGHTS = [55, 25, 13, 5.5, 1.5];

/**
 * Position of the tension bar at time t, as 0..1. A triangle wave keeps this
 * bit-identical between the browser and the server (no Math.sin, no drift), so
 * the server can verify the tap the player claims to have made.
 */
export function barPosition(barSeed: number, elapsedMs: number, sweepMs: number): number {
  const phase = (barSeed % 1000) / 1000;
  const u = ((elapsedMs / sweepMs + phase) % 1 + 1) % 1;
  return u < 0.5 ? u * 2 : 2 - u * 2;
}

/**
 * Finds the next moment the marker enters the timing zone. Used by the deck
 * cat while auto-fishing; the normal player control still resolves from the
 * actual tap time.
 */
export function nextBarHitMs(cast: PendingCast, fromMs = 0): number | null {
  const start = Math.max(0, Math.floor(fromMs));
  const half = cast.zoneWidth / 2;
  for (let elapsed = start; elapsed < cast.timeoutMs; elapsed += 8) {
    if (Math.abs(barPosition(cast.barSeed, elapsed, cast.sweepMs) - cast.zoneCenter) <= half) {
      return elapsed;
    }
  }
  return null;
}

export function contextLuck(state: GameState, zoneId: ZoneId, now: number): number {
  const mods = getModifiers(state);
  const tod = timeOfDay(now);
  const weather = weatherAt(now);
  const bait = state.equippedBaitId ? ITEM_BY_ID[state.equippedBaitId]?.bait : undefined;

  let luck = mods.luck + WEATHER_LUCK[weather];
  if (bait) {
    luck += bait.luck;
    if (bait.boostZones?.includes(zoneId)) luck += 0.12;
    if (bait.boostTime?.includes(tod)) luck += 0.1;
  }
  const lantern = lvl(state, "lantern");
  if (lantern > 0 && (tod === "night" || zoneId === "deep" || zoneId === "reef")) {
    luck += lantern * 0.08;
  }
  return luck;
}

function speciesWeight(
  species: Species,
  luck: number,
  now: number,
): number {
  const tod = timeOfDay(now);
  const weather = weatherAt(now);
  if (species.requireTime && !species.requireTime.includes(tod)) return 0;

  let weight = RARITY_WEIGHT[species.rarity] * (1 + luck * LUCK_TIER[species.rarity]);
  if (species.rarity === "common") weight /= 1 + luck * 0.6;
  if (species.boostTime?.includes(tod)) weight *= 2.2;
  if (species.boostWeather?.includes(weather)) weight *= 2.2;
  return weight;
}

function rollStars(rng: Rng, luck: number): number {
  const weights = STAR_WEIGHTS.map((w, i) => w * (1 + luck * i * 0.9));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return i + 1;
  }
  return 1;
}

function rollMutation(rng: Rng, chance: number): MutationId | null {
  if (!rng.chance(chance)) return null;
  const r = rng.next();
  if (r < 0.7) return "shiny";
  if (r < 0.94) return "albino";
  return "prismatic";
}

function rollSize(rng: Rng, species: Species, sizeMultiplier: number): number {
  const [min, max] = species.size;
  // Average of two rolls: most fish are mid-sized, monsters are memorable.
  const t = Math.pow((rng.next() + rng.next()) / 2, 0.85);
  const raw = (min + (max - min) * t) * sizeMultiplier;
  return Math.round(Math.min(max * 1.3, Math.max(min * 0.85, raw)) * 10) / 10;
}

/** Rolls one fish for a zone. Shared by casting and by the deck cat's offline work. */
export function rollFish(
  state: GameState,
  zoneId: ZoneId,
  rng: Rng,
  now: number,
  luck: number,
  sizeMultiplier: number,
): FishInstance | null {
  const pool = SPECIES_BY_ZONE[zoneId].filter((s) => speciesWeight(s, luck, now) > 0);
  if (pool.length === 0) return null;
  const species = rng.weighted(pool, (s) => speciesWeight(s, luck, now));
  return {
    id: makeId("f", rng.seed, Math.floor(now / 7)),
    speciesId: species.id,
    sizeCm: rollSize(rng, species, sizeMultiplier),
    stars: rollStars(rng, luck),
    mutation: rollMutation(rng, getModifiers(state).mutationChance),
    caughtAt: now,
    zoneId,
  };
}

export interface StartCastResult {
  state: GameState;
  cast: PendingCast | null;
  error?: "cooldown" | "pending" | "locked";
}

/**
 * Rolls the whole outcome up front and hides it in `pendingCast`; the minigame
 * only decides whether the player keeps it. This is what makes the reward
 * server-authoritative while the animation stays local and instant.
 */
export function startCast(state: GameState, now: number): StartCastResult {
  if (state.pendingCast) return { state, cast: null, error: "pending" };
  const mods = getModifiers(state);
  if (now - state.lastCastAt < mods.castCooldownMs) {
    return { state, cast: null, error: "cooldown" };
  }
  if (!state.unlockedZones.includes(state.zoneId)) {
    return { state, cast: null, error: "locked" };
  }

  const zone = ZONE_BY_ID[state.zoneId];
  const rng = createRng(state.rngSeed);

  // Bait is spent on the cast, not on the catch.
  let baitId: string | null = null;
  if (state.equippedBaitId && (state.items[state.equippedBaitId] ?? 0) > 0) {
    baitId = state.equippedBaitId;
    state.items[baitId] -= 1;
    if (state.items[baitId] <= 0) delete state.items[baitId];
  }

  const luck = contextLuck(state, state.zoneId, now);
  const isJunk = rng.chance(Math.max(0.02, zone.junkChance * (baitId ? 0.75 : 1.25)));

  let fish: FishInstance | null = null;
  let junkItemId: string | null = null;

  if (isJunk) {
    junkItemId = rng.weighted(JUNK_TABLE, (j) => j.weight).itemId;
  } else {
    fish = rollFish(state, state.zoneId, rng, now, luck, mods.sizeMultiplier);
  }

  const barSeed = rng.seed % 1000;
  const rarity = fish ? SPECIES_BY_ID[fish.speciesId].rarity : "common";
  // Rarer fish fight harder: faster bar, and the zone sits further from centre.
  const rarityRush =
    { common: 1, uncommon: 0.96, rare: 0.9, epic: 0.84, legendary: 0.78, mythic: 0.72 }[
      rarity
    ] ?? 1;

  const cast: PendingCast = {
    id: makeId("c", rng.seed, now % 100000),
    startedAt: now,
    barSeed,
    sweepMs: Math.round(zone.sweepSeconds * 1000 * mods.sweepMultiplier * rarityRush),
    zoneCenter: 0.28 + rng.next() * 0.44,
    zoneWidth: mods.zoneWidth * (isJunk ? 1.3 : 1),
    timeoutMs: CAST_TIMEOUT_MS,
    fish,
    junkItemId,
    baitId,
  };

  state.rngSeed = rng.seed;
  state.pendingCast = cast;
  state.lastCastAt = now;
  state.stats.casts += 1;
  return { state, cast };
}

export interface ResolveCastResult {
  state: GameState;
  result: CatchResult;
}

/**
 * `tapAtMs` is the elapsed time the client claims the player tapped at. The
 * server recomputes the bar from the stored seed, so a forged tap still has to
 * be a legal one; the worst a cheater gets is consistently good timing.
 */
export function resolveCast(
  state: GameState,
  tapAtMs: number | null,
  now: number,
): ResolveCastResult {
  const empty: CatchResult = {
    outcome: "miss",
    fish: null,
    junkItemId: null,
    accuracy: 0,
    perfect: false,
    bagFull: false,
    autoSoldFor: 0,
    newSpecies: false,
    levelUps: 0,
  };
  const cast = state.pendingCast;
  if (!cast) return { state, result: empty };

  state.pendingCast = null;
  const mods = getModifiers(state);
  const elapsedReal = now - cast.startedAt;

  let accuracy = 0;
  let outcome: CatchResult["outcome"] = "miss";

  if (tapAtMs !== null) {
    const tap = Math.max(0, Math.min(cast.timeoutMs, tapAtMs));
    // The bar only starts after the cast, so a real tap is always behind the
    // wall clock; anything ahead of it was made up. The small tolerance is for
    // timer rounding, and the upper bound rejects taps replayed much later.
    const plausible = tap <= elapsedReal + 150 && elapsedReal - tap < 6000;
    if (plausible) {
      const pos = barPosition(cast.barSeed, tap, cast.sweepMs);
      const half = cast.zoneWidth / 2;
      const distance = Math.abs(pos - cast.zoneCenter);
      if (distance <= half) {
        accuracy = 1 - distance / half;
        outcome = cast.fish ? "fish" : "junk";
      } else {
        outcome = "escape";
      }
    } else {
      outcome = "escape";
    }
  }

  const perfect = outcome !== "miss" && outcome !== "escape" && accuracy >= 0.82;
  const result: CatchResult = { ...empty, outcome, accuracy, perfect };

  if (outcome === "escape" || outcome === "miss") {
    state.stats.escapes += 1;
    const sp = cast.fish ? SPECIES_BY_ID[cast.fish.speciesId] : null;
    addLog(
      state,
      "catch",
      sp ? `${sp.name.th} หลุดไป...` : "เบ็ดว่างเปล่า",
      sp ? `The ${sp.name.en} got away...` : "Nothing on the hook.",
      now,
    );
    return { state, result };
  }

  if (outcome === "junk" && cast.junkItemId) {
    state.items[cast.junkItemId] = (state.items[cast.junkItemId] ?? 0) + 1;
    const item = ITEM_BY_ID[cast.junkItemId];
    result.junkItemId = cast.junkItemId;
    addLog(
      state,
      "catch",
      `เก็บ${item.name.th}ขึ้นมาได้`,
      `Fished out ${item.name.en}.`,
      now,
    );
    grantXp(state, 2);
    return { state, result };
  }

  if (!cast.fish) return { state, result };

  const rng = createRng(state.rngSeed);
  const fish: FishInstance = { ...cast.fish, caughtAt: now };
  fish.sizeCm = Math.round(fish.sizeCm * (1 + accuracy * 0.06) * 10) / 10;
  if (perfect) {
    state.stats.perfectCasts += 1;
    fish.sizeCm = Math.round(fish.sizeCm * 1.08 * 10) / 10;
    if (fish.stars < 5 && rng.chance(0.45)) fish.stars += 1;
  }
  state.rngSeed = rng.seed;

  const species = SPECIES_BY_ID[fish.speciesId];
  const dex = state.fishdex[fish.speciesId];
  result.newSpecies = !dex;
  state.fishdex[fish.speciesId] = {
    count: (dex?.count ?? 0) + 1,
    maxSize: Math.max(dex?.maxSize ?? 0, fish.sizeCm),
    bestStars: Math.max(dex?.bestStars ?? 0, fish.stars),
    firstAt: dex?.firstAt ?? now,
  };

  state.stats.totalCaught += 1;
  if (fish.mutation) state.stats.mutations += 1;
  if (!state.stats.biggest || fish.sizeCm > state.stats.biggest.sizeCm) {
    state.stats.biggest = { speciesId: fish.speciesId, sizeCm: fish.sizeCm };
  }

  // A full creel auto-sells the smallest catch so idle players never soft-lock.
  if (state.bag.length >= mods.bagCapacity) {
    result.bagFull = true;
    const value = fishValue(state, fish);
    state.coins += value;
    state.stats.coinsEarned += value;
    result.autoSoldFor = value;
    trackQuest(state, "coins", value);
  } else {
    state.bag.push(fish);
  }

  result.fish = fish;
  trackQuest(state, "catch", 1);
  if (["rare", "epic", "legendary", "mythic"].includes(species.rarity)) {
    trackQuest(state, "rare", 1);
  }
  if (["epic", "legendary", "mythic"].includes(species.rarity)) {
    trackQuest(state, "epic", 1);
  }

  const xp = { common: 4, uncommon: 8, rare: 18, epic: 45, legendary: 120, mythic: 400 }[
    species.rarity
  ];
  result.levelUps = grantXp(state, xp * (1 + fish.stars * 0.15));

  addLog(
    state,
    "catch",
    `ได้ ${species.name.th} ${fish.sizeCm} ซม. ${"★".repeat(fish.stars)}`,
    `Caught ${species.name.en} — ${fish.sizeCm}cm ${"★".repeat(fish.stars)}`,
    now,
  );
  return { state, result };
}
