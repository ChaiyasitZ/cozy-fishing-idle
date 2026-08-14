import { ITEM_BY_ID, SPECIES_BY_ID } from "@/game/data";
import type { GameState, PondFish } from "@/game/types";
import { fishValue } from "./economy";
import { addLog } from "./log";
import { getModifiers, grantXp } from "./modifiers";
import { trackQuest } from "./quests";
import { createRng, makeId } from "./rng";

const HOUR = 3600_000;
/** Water goes stale over three days without food. */
const FRESHNESS_DECAY_PER_MS = 1 / (72 * HOUR);
/** Uncollected pond income stops piling up after half a day. */
export const HARVEST_CAP_MS = 12 * HOUR;
export const BREED_COOLDOWN_MS = 6 * HOUR;

export function currentFreshness(state: GameState, now: number): number {
  const elapsed = Math.max(0, now - state.pond.lastFedAt);
  return Math.max(0, Math.min(1, state.pond.freshness - elapsed * FRESHNESS_DECAY_PER_MS));
}

export function isMature(fish: PondFish, now: number): boolean {
  return now >= fish.maturesAt;
}

export function growthProgress(fish: PondFish, now: number): number {
  const total = fish.maturesAt - fish.placedAt;
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, (now - fish.placedAt) / total));
}

/** Coins per hour a single mature fish produces right now. */
export function fishYield(state: GameState, fish: PondFish, now: number): number {
  const species = SPECIES_BY_ID[fish.speciesId];
  if (!species || !isMature(fish, now)) return 0;
  const freshness = currentFreshness(state, now);
  const stars = 1 + (fish.stars - 1) * 0.22;
  return species.yieldPerHour * stars * (0.35 + 0.65 * freshness) * (1 + state.prestige.blessing);
}

export function pendingHarvest(state: GameState, now: number) {
  let coins = 0;
  let pearls = 0;
  for (const fish of state.pond.fish) {
    if (!isMature(fish, now)) continue;
    const since = Math.min(HARVEST_CAP_MS, Math.max(0, now - Math.max(fish.lastHarvestAt, fish.maturesAt)));
    const hours = since / HOUR;
    coins += fishYield(state, fish, now) * hours;
    pearls += hours * fish.stars * 0.03;
  }
  return { coins: Math.floor(coins), pearls: Math.floor(pearls) };
}

export function stockFish(
  state: GameState,
  fishIds: string[],
  now = Date.now(),
): { state: GameState; moved: number } {
  const mods = getModifiers(state);
  const ids = new Set(fishIds);
  let moved = 0;

  const keep: typeof state.bag = [];
  for (const fish of state.bag) {
    if (!ids.has(fish.id) || state.pond.fish.length >= mods.pondSlots) {
      keep.push(fish);
      continue;
    }
    const species = SPECIES_BY_ID[fish.speciesId];
    const growMs = (species?.growHours ?? 4) * HOUR / mods.growthMultiplier;
    state.pond.fish.push({
      ...fish,
      placedAt: now,
      maturesAt: now + growMs,
      lastHarvestAt: now,
    });
    moved += 1;
  }
  state.bag = keep;

  if (moved > 0) {
    trackQuest(state, "stock", moved);
    addLog(state, "pond", `ปล่อยปลาลงบ่อ ${moved} ตัว`, `Stocked ${moved} fish in the pond.`, now);
  }
  return { state, moved };
}

export function feedPond(
  state: GameState,
  foodId: string,
  now = Date.now(),
): { state: GameState; ok: boolean } {
  const item = ITEM_BY_ID[foodId];
  if (!item?.food || (state.items[foodId] ?? 0) <= 0) return { state, ok: false };

  state.items[foodId] -= 1;
  if (state.items[foodId] <= 0) delete state.items[foodId];

  state.pond.freshness = Math.min(1, currentFreshness(state, now) + item.food.freshness);
  state.pond.lastFedAt = now;

  // Good food also speeds up everything still growing.
  if (item.food.growthMultiplier > 1) {
    for (const fish of state.pond.fish) {
      if (isMature(fish, now)) continue;
      const remaining = fish.maturesAt - now;
      fish.maturesAt = now + remaining / item.food.growthMultiplier;
    }
  }

  trackQuest(state, "feed", 1);
  grantXp(state, 6);
  addLog(state, "pond", `ให้${item.name.th}กับปลาในบ่อ`, `Fed the pond with ${item.name.en}.`, now);
  return { state, ok: true };
}

export function collectPond(
  state: GameState,
  now = Date.now(),
): { state: GameState; coins: number; pearls: number } {
  const { coins, pearls } = pendingHarvest(state, now);
  if (coins <= 0 && pearls <= 0) return { state, coins: 0, pearls: 0 };

  state.coins += coins;
  state.pearls += pearls;
  state.stats.coinsEarned += coins;
  for (const fish of state.pond.fish) {
    if (isMature(fish, now)) fish.lastHarvestAt = now;
  }
  trackQuest(state, "coins", coins);
  addLog(
    state,
    "pond",
    `เก็บผลผลิตจากบ่อ +${coins} เหรียญ${pearls > 0 ? ` +${pearls} ไข่มุก` : ""}`,
    `Collected ${coins} coins${pearls > 0 ? ` and ${pearls} pearls` : ""} from the pond.`,
    now,
  );
  return { state, coins, pearls };
}

export function sellPondFish(
  state: GameState,
  fishId: string,
  now = Date.now(),
): { state: GameState; coins: number } {
  const index = state.pond.fish.findIndex((f) => f.id === fishId);
  if (index < 0) return { state, coins: 0 };
  const fish = state.pond.fish[index];
  // Grown fish are worth more than when they were caught.
  const maturity = isMature(fish, now) ? 1.6 : 1 + 0.6 * growthProgress(fish, now);
  const coins = Math.round(fishValue(state, fish, now) * maturity);

  state.pond.fish.splice(index, 1);
  state.coins += coins;
  state.stats.coinsEarned += coins;
  state.stats.totalSold += 1;
  trackQuest(state, "sell", 1);
  trackQuest(state, "coins", coins);
  addLog(state, "sell", `ขายปลาจากบ่อ +${coins} เหรียญ`, `Sold a pond fish for ${coins} coins.`, now);
  return { state, coins };
}

export function moveToBag(
  state: GameState,
  fishId: string,
  now = Date.now(),
): { state: GameState; ok: boolean } {
  const mods = getModifiers(state);
  if (state.bag.length >= mods.bagCapacity) return { state, ok: false };
  const index = state.pond.fish.findIndex((f) => f.id === fishId);
  if (index < 0) return { state, ok: false };
  const [fish] = state.pond.fish.splice(index, 1);
  state.bag.push({
    id: fish.id,
    speciesId: fish.speciesId,
    sizeCm: fish.sizeCm,
    stars: fish.stars,
    mutation: fish.mutation,
    caughtAt: fish.caughtAt,
    zoneId: fish.zoneId,
  });
  addLog(state, "pond", "ย้ายปลาขึ้นกระเป๋า", "Moved a fish to your creel.", now);
  return { state, ok: true };
}

export interface BreedResult {
  state: GameState;
  ok: boolean;
  reason?: "slots" | "cooldown" | "immature" | "species" | "food" | "missing";
  child?: PondFish;
}

export function breedFish(
  state: GameState,
  aId: string,
  bId: string,
  now = Date.now(),
): BreedResult {
  const mods = getModifiers(state);
  const a = state.pond.fish.find((f) => f.id === aId);
  const b = state.pond.fish.find((f) => f.id === bId);
  if (!a || !b || a.id === b.id) return { state, ok: false, reason: "missing" };
  if (a.speciesId !== b.speciesId) return { state, ok: false, reason: "species" };

  const species = SPECIES_BY_ID[a.speciesId];
  if (!species?.breedable) return { state, ok: false, reason: "species" };
  if (!isMature(a, now) || !isMature(b, now)) return { state, ok: false, reason: "immature" };
  if (
    now - (a.lastBredAt ?? 0) < BREED_COOLDOWN_MS ||
    now - (b.lastBredAt ?? 0) < BREED_COOLDOWN_MS
  ) {
    return { state, ok: false, reason: "cooldown" };
  }
  if (state.pond.fish.length >= mods.pondSlots) return { state, ok: false, reason: "slots" };

  const foodId = (state.items.food_premium ?? 0) > 0 ? "food_premium" : "food_basic";
  if ((state.items[foodId] ?? 0) <= 0) return { state, ok: false, reason: "food" };
  state.items[foodId] -= 1;
  if (state.items[foodId] <= 0) delete state.items[foodId];

  const rng = createRng(state.rngSeed);
  const bestStars = Math.max(a.stars, b.stars);
  let stars = bestStars;
  if (stars < 5 && rng.chance(0.4 + (foodId === "food_premium" ? 0.15 : 0))) stars += 1;

  let mutation = a.mutation ?? b.mutation ?? null;
  if (rng.chance(mods.mutationChance * 4)) {
    const r = rng.next();
    mutation = r < 0.6 ? "shiny" : r < 0.92 ? "albino" : "prismatic";
  }

  const parentSize = (a.sizeCm + b.sizeCm) / 2;
  const child: PondFish = {
    id: makeId("fry", rng.seed, now % 100000),
    speciesId: a.speciesId,
    sizeCm: Math.round(parentSize * (0.55 + rng.next() * 0.25) * 10) / 10,
    stars,
    mutation,
    caughtAt: now,
    zoneId: a.zoneId,
    placedAt: now,
    maturesAt: now + (species.growHours * HOUR * 1.4) / mods.growthMultiplier,
    lastHarvestAt: now,
  };
  state.rngSeed = rng.seed;

  a.lastBredAt = now;
  b.lastBredAt = now;
  state.pond.fish.push(child);
  state.stats.bred += 1;
  if (mutation) state.stats.mutations += 1;
  trackQuest(state, "breed", 1);
  grantXp(state, 30 + stars * 10);
  addLog(
    state,
    "pond",
    `ได้ลูก${species.name.th} ${"★".repeat(stars)}${mutation ? " กลายพันธุ์!" : ""}`,
    `Bred a ${species.name.en} fry ${"★".repeat(stars)}${mutation ? " — a mutation!" : ""}`,
    now,
  );
  return { state, ok: true, child };
}
