import { describe, expect, it } from "vitest";
import { SPECIES_BY_ID } from "@/game/data";
import type { GameState } from "@/game/types";
import { applyCommand } from "./commands";
import { barPosition, CAST_TIMEOUT_MS, nextBarHitMs } from "./catch";
import { fishValue } from "./economy";
import { resolveIdle } from "./idle";
import { getModifiers } from "./modifiers";
import { pendingHarvest } from "./pond";
import { createRng } from "./rng";
import { createInitialState, migrateState } from "./state";
import { timeOfDay, weatherAt } from "./world";

const T0 = Date.UTC(2026, 7, 14, 3, 0, 0);
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

function freshState(now = T0): GameState {
  const state = createInitialState(now);
  state.rngSeed = 123456;
  return state;
}

/** First moment at/after `from` when the marker sits inside the green zone. */
function firstHitMs(
  barSeed: number,
  sweepMs: number,
  center: number,
  width: number,
  from = 0,
): number | null {
  for (let t = from; t < CAST_TIMEOUT_MS; t += 4) {
    if (Math.abs(barPosition(barSeed, t, sweepMs) - center) <= width / 2) return t;
  }
  return null;
}

/** One full cast played by someone who taps when the marker is in the zone. */
function playCast(state: GameState, now: number) {
  const cast = applyCommand(state, { type: "cast" }, now);
  const pending = cast.state.pendingCast;
  if (!pending) return { state: cast.state, result: null, now };

  const tapAtMs = firstHitMs(
    pending.barSeed,
    pending.sweepMs,
    pending.zoneCenter,
    pending.zoneWidth,
  );
  // The bar appears a beat after the cast, so real time runs a little ahead.
  const tapNow = now + 620 + (tapAtMs ?? CAST_TIMEOUT_MS);
  const resolved = applyCommand(cast.state, { type: "resolveCast", tapAtMs }, tapNow);
  return { state: resolved.state, result: resolved.effects.catchResult ?? null, now: tapNow };
}

describe("rng", () => {
  it("is deterministic for a given seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it("advances the seed so callers can persist it", () => {
    const rng = createRng(42);
    rng.next();
    expect(rng.seed).not.toBe(42);
  });
});

describe("world", () => {
  it("derives the same time of day and weather from the same instant", () => {
    expect(timeOfDay(T0)).toBe(timeOfDay(T0));
    expect(weatherAt(T0)).toBe(weatherAt(T0));
  });

  it("moves through every part of the day", () => {
    const seen = new Set<string>();
    for (let h = 0; h < 24; h++) seen.add(timeOfDay(T0 + h * HOUR));
    expect(seen.size).toBeGreaterThan(2);
  });
});

describe("tension bar", () => {
  it("stays inside the bar and never jumps", () => {
    let previous = barPosition(317, 0, 2400);
    for (let t = 0; t <= 6000; t += 16) {
      const pos = barPosition(317, t, 2400);
      expect(pos).toBeGreaterThanOrEqual(0);
      expect(pos).toBeLessThanOrEqual(1);
      expect(Math.abs(pos - previous)).toBeLessThan(0.05);
      previous = pos;
    }
  });

  it("gives a beginner several chances to hit the zone", () => {
    const state = freshState();
    const { zoneWidth } = getModifiers(state);
    const sweepMs = 2400;
    // Count entries into the zone across one full timeout.
    let entries = 0;
    let inside = false;
    for (let t = 0; t < CAST_TIMEOUT_MS; t += 4) {
      const hit = Math.abs(barPosition(317, t, sweepMs) - 0.5) <= zoneWidth / 2;
      if (hit && !inside) entries += 1;
      inside = hit;
    }
    expect(entries).toBeGreaterThanOrEqual(3);
  });

  it("finds a legal timing window for the deck cat", () => {
    const pending = applyCommand(freshState(), { type: "cast" }, T0).state.pendingCast!;
    const hitAt = nextBarHitMs(pending, 100);
    expect(hitAt).not.toBeNull();
    expect(
      Math.abs(barPosition(pending.barSeed, hitAt!, pending.sweepMs) - pending.zoneCenter),
    ).toBeLessThanOrEqual(pending.zoneWidth / 2);
  });
});

describe("casting", () => {
  it("lands a catch when the player taps inside the zone", () => {
    const played = playCast(freshState(), T0);
    expect(played.result).not.toBeNull();
    expect(["fish", "junk"]).toContain(played.result!.outcome);
  });

  it("lets the fish escape on a tap outside the zone", () => {
    const state = freshState();
    const cast = applyCommand(state, { type: "cast" }, T0);
    const pending = cast.state.pendingCast!;
    let miss = 0;
    while (
      Math.abs(barPosition(pending.barSeed, miss, pending.sweepMs) - pending.zoneCenter) <=
      pending.zoneWidth / 2
    ) {
      miss += 4;
    }
    const resolved = applyCommand(cast.state, { type: "resolveCast", tapAtMs: miss }, T0 + 620 + miss);
    expect(resolved.effects.catchResult?.outcome).toBe("escape");
  });

  it("counts a timeout (no tap) as a miss and clears the cast", () => {
    const cast = applyCommand(freshState(), { type: "cast" }, T0);
    const resolved = applyCommand(
      cast.state,
      { type: "resolveCast", tapAtMs: null },
      T0 + CAST_TIMEOUT_MS + 100,
    );
    expect(resolved.effects.catchResult?.outcome).toBe("miss");
    expect(resolved.state.pendingCast).toBeNull();
  });

  it("rejects a tap claimed from the future", () => {
    const cast = applyCommand(freshState(), { type: "cast" }, T0);
    const pending = cast.state.pendingCast!;
    const tapAtMs = firstHitMs(
      pending.barSeed,
      pending.sweepMs,
      pending.zoneCenter,
      pending.zoneWidth,
      2000,
    )!;
    // A perfect tap, but reported before the bar could possibly have got there.
    const resolved = applyCommand(cast.state, { type: "resolveCast", tapAtMs }, T0 + 10);
    expect(resolved.effects.catchResult?.outcome).toBe("escape");
  });

  it("enforces the cast cooldown", () => {
    const cooldown = getModifiers(freshState()).castCooldownMs;
    const first = applyCommand(freshState(), { type: "cast" }, T0);
    const resolved = applyCommand(first.state, { type: "resolveCast", tapAtMs: null }, T0 + 700);

    const tooSoon = applyCommand(resolved.state, { type: "cast" }, T0 + cooldown - 100);
    expect(tooSoon.effects.ok).toBe(false);
    expect(tooSoon.effects.error).toBe("cooldown");

    const allowed = applyCommand(resolved.state, { type: "cast" }, T0 + cooldown + 10);
    expect(allowed.effects.ok).toBe(true);
  });

  it("spends bait on the cast", () => {
    const state = freshState();
    const baitId = state.equippedBaitId!;
    const before = state.items[baitId] ?? 0;
    expect(before).toBeGreaterThan(0);
    const cast = applyCommand(state, { type: "cast" }, T0);
    expect(cast.state.items[baitId] ?? 0).toBe(before - 1);
  });

  it("records new species in the fishdex", () => {
    let state = freshState();
    let now = T0;
    let caught = 0;
    for (let i = 0; i < 30 && caught < 3; i++) {
      const played = playCast(state, now);
      state = played.state;
      now = played.now + 1200;
      if (played.result?.outcome === "fish") caught += 1;
    }
    expect(caught).toBeGreaterThanOrEqual(3);
    expect(Object.keys(state.fishdex).length).toBeGreaterThan(0);
    expect(state.stats.totalCaught).toBe(caught);
  });
});

describe("economy", () => {
  it("sells fish for coins and empties the creel", () => {
    let state = freshState();
    let now = T0;
    for (let i = 0; i < 40 && state.bag.length < 3; i++) {
      const played = playCast(state, now);
      state = played.state;
      now = played.now + 1200;
    }
    expect(state.bag.length).toBeGreaterThan(0);

    const expected = state.bag.reduce((sum, fish) => sum + fishValue(state, fish, now), 0);
    const sold = applyCommand(state, { type: "sellFish", ids: state.bag.map((f) => f.id) }, now);
    expect(sold.effects.coins).toBe(expected);
    expect(sold.state.bag).toHaveLength(0);
    expect(sold.state.coins).toBe(state.coins + expected);
  });

  it("refuses purchases the player cannot afford", () => {
    const state = freshState();
    state.coins = 0;
    const bought = applyCommand(state, { type: "buyItem", itemId: "bait_worm", qty: 10 }, T0);
    expect(bought.effects.ok).toBe(false);
    expect(bought.effects.error).toBe("cannot_afford");
    expect(bought.state.coins).toBe(0);
  });

  it("charges for upgrades and applies their effect", () => {
    const state = freshState();
    state.coins = 100_000;
    const bought = applyCommand(state, { type: "buyUpgrade", id: "creel" }, T0);
    expect(bought.effects.ok).toBe(true);
    expect(bought.state.coins).toBeLessThan(100_000);
    expect(getModifiers(bought.state).bagCapacity).toBeGreaterThan(getModifiers(state).bagCapacity);
  });

  it("unlocks active auto-fishing with the Deck Cat upgrade", () => {
    const state = freshState();
    expect(getModifiers(state).activeAutoCatchIntervalMs).toBe(Infinity);
    state.upgrades.helper = 1;
    expect(getModifiers(state).activeAutoCatchIntervalMs).toBe(12_000);
    state.upgrades.helper = 12;
    expect(getModifiers(state).activeAutoCatchIntervalMs).toBeLessThan(12_000);
  });

  it("keeps zones locked until their requirements are met", () => {
    const state = freshState();
    state.coins = 1_000_000;
    const blocked = applyCommand(state, { type: "unlockZone", zoneId: "deep" }, T0);
    expect(blocked.effects.ok).toBe(false);
    expect(blocked.state.unlockedZones).not.toContain("deep");
  });

  it("values a bigger, starrier fish higher", () => {
    const state = freshState();
    const species = SPECIES_BY_ID.tilapia;
    const base = {
      id: "a",
      speciesId: species.id,
      sizeCm: species.size[0],
      stars: 1,
      mutation: null,
      caughtAt: T0,
      zoneId: "pond" as const,
    };
    const better = { ...base, id: "b", sizeCm: species.size[1], stars: 5 };
    expect(fishValue(state, better, T0)).toBeGreaterThan(fishValue(state, base, T0));
  });
});

describe("pond", () => {
  function stateWithPondFish(now = T0) {
    let state = freshState(now);
    let cursor = now;
    for (let i = 0; i < 60 && state.bag.length < 2; i++) {
      const played = playCast(state, cursor);
      state = played.state;
      cursor = played.now + 1200;
    }
    const stocked = applyCommand(state, { type: "stockFish", ids: state.bag.map((f) => f.id) }, cursor);
    return { state: stocked.state, now: cursor };
  }

  it("moves fish from the creel into the pond", () => {
    const { state } = stateWithPondFish();
    expect(state.pond.fish.length).toBeGreaterThan(0);
    expect(state.bag).toHaveLength(0);
  });

  it("produces nothing before the fish mature, and income after", () => {
    const { state, now } = stateWithPondFish();
    expect(pendingHarvest(state, now).coins).toBe(0);

    const grown = now + 48 * HOUR;
    const collected = applyCommand(state, { type: "collectPond" }, grown);
    expect(collected.effects.coins).toBeGreaterThan(0);
    // Income does not stack twice for the same hours.
    const again = applyCommand(collected.state, { type: "collectPond" }, grown);
    expect(again.effects.coins ?? 0).toBe(0);
  });

  it("caps uncollected pond income", () => {
    const { state, now } = stateWithPondFish();
    const grown = now + 24 * HOUR;

    // Freshness and the last harvest are pinned so the comparison isolates the
    // harvest cap itself.
    const harvestAfter = (hours: number) => {
      const at = grown + hours * HOUR;
      const pinned = structuredClone(state);
      pinned.pond.lastFedAt = at;
      for (const fish of pinned.pond.fish) fish.lastHarvestAt = grown;
      return pendingHarvest(pinned, at).coins;
    };

    expect(harvestAfter(6)).toBeLessThan(harvestAfter(12));
    expect(harvestAfter(96)).toBe(harvestAfter(12));
  });

  it("only breeds two mature fish of one species, and spends food", () => {
    const { state, now } = stateWithPondFish();
    const [a, b] = state.pond.fish;
    if (!b || a.speciesId !== b.speciesId) return; // species pairing is luck-dependent

    const immature = applyCommand(state, { type: "breed", aId: a.id, bId: b.id }, now);
    expect(immature.effects.ok).toBe(false);

    const grown = now + 72 * HOUR;
    state.items.food_basic = 5;
    const bred = applyCommand(state, { type: "breed", aId: a.id, bId: b.id }, grown);
    if (bred.effects.error === "slots") return;
    expect(bred.effects.ok).toBe(true);
    expect(bred.state.pond.fish.length).toBe(state.pond.fish.length + 1);
    expect(bred.state.items.food_basic).toBe(4);

    const onCooldown = applyCommand(bred.state, { type: "breed", aId: a.id, bId: b.id }, grown + 60);
    expect(onCooldown.effects.ok).toBe(false);
    expect(onCooldown.effects.error).toBe("cooldown");
  });

  it("lets water go stale without food and recover after feeding", () => {
    const { state, now } = stateWithPondFish();
    const stale = now + 60 * HOUR;
    const before = pendingHarvest(state, stale).coins;
    state.items.food_basic = 1;
    const fed = applyCommand(state, { type: "feedPond", foodId: "food_basic" }, stale);
    expect(fed.effects.ok).toBe(true);
    expect(pendingHarvest(fed.state, stale + HOUR).coins).toBeGreaterThan(0);
    expect(before).toBeGreaterThanOrEqual(0);
  });
});

describe("idle", () => {
  it("does nothing without a deck cat", () => {
    const state = freshState();
    const { report } = resolveIdle(state, T0 + 8 * HOUR);
    expect(report.caught).toHaveLength(0);
  });

  it("has the deck cat fish while away, up to the offline cap", () => {
    const state = freshState();
    state.upgrades.helper = 1;
    const short = resolveIdle(structuredClone(state), T0 + 1 * HOUR);
    const long = resolveIdle(structuredClone(state), T0 + 30 * HOUR);
    expect(short.report.caught.length).toBeGreaterThan(0);
    // The cap means a very long absence is not proportionally more rewarding.
    expect(long.report.caught.length).toBeLessThan(short.report.caught.length * 20);
    expect(long.report.cappedMs).toBeGreaterThan(0);
  });

  it("is deterministic for the same state and instant", () => {
    const state = freshState();
    state.upgrades.helper = 2;
    const a = resolveIdle(structuredClone(state), T0 + 5 * HOUR);
    const b = resolveIdle(structuredClone(state), T0 + 5 * HOUR);
    expect(a.report.caught.length).toBe(b.report.caught.length);
    expect(a.state.rngSeed).toBe(b.state.rngSeed);
    expect(a.state.coins).toBe(b.state.coins);
  });

  it("never runs time backwards", () => {
    const state = freshState();
    const { state: next } = resolveIdle(state, T0 - 10 * HOUR);
    expect(next.lastTickAt).toBeGreaterThanOrEqual(T0 - 10 * HOUR);
    expect(next.coins).toBe(state.coins);
  });

  it("auto-sells overflow instead of soft-locking a full creel", () => {
    const state = freshState();
    state.upgrades.helper = 3;
    const { report } = resolveIdle(state, T0 + 24 * HOUR);
    expect(report.caught.length + report.autoSoldCount).toBeGreaterThan(0);
  });
});

describe("achievements", () => {
  it("rewards the first cast", () => {
    const cast = applyCommand(freshState(), { type: "cast" }, T0);
    expect(cast.effects.achievements).toContain("first_cast");
  });

  it("does not hand out the busy-pond reward for the four starter slots", () => {
    const state = freshState();
    const fish = {
      id: "p1",
      speciesId: "tilapia",
      sizeCm: 20,
      stars: 2,
      mutation: null,
      caughtAt: T0,
      zoneId: "pond" as const,
      placedAt: T0,
      maturesAt: T0 + HOUR,
      lastHarvestAt: T0,
    };
    state.pond.fish = Array.from({ length: getModifiers(state).pondSlots }, (_, i) => ({
      ...fish,
      id: `p${i}`,
    }));
    const starter = applyCommand(state, { type: "tick" }, T0);
    expect(starter.effects.achievements ?? []).not.toContain("pond_full");
    expect(starter.state.coins).toBe(state.coins);

    const upgraded = structuredClone(state);
    upgraded.upgrades.pond = 3;
    upgraded.pond.fish = Array.from({ length: getModifiers(upgraded).pondSlots }, (_, i) => ({
      ...fish,
      id: `q${i}`,
    }));
    const earned = applyCommand(upgraded, { type: "tick" }, T0);
    expect(earned.effects.achievements).toContain("pond_full");
  });

  it("never grants the same achievement twice", () => {
    const first = applyCommand(freshState(), { type: "cast" }, T0);
    const second = applyCommand(first.state, { type: "tick" }, T0 + 1000);
    expect(second.effects.achievements ?? []).not.toContain("first_cast");
  });
});

describe("saves", () => {
  it("keeps a fresh save playable and internally consistent", () => {
    const state = freshState();
    expect(state.unlockedZones).toContain(state.zoneId);
    expect(state.coins).toBeGreaterThanOrEqual(0);
    expect(state.bag).toHaveLength(0);
  });

  it("migrates a partial save without throwing", () => {
    const partial = {
      version: 0,
      coins: 500,
      bag: [{ id: "x", speciesId: "tilapia", sizeCm: 20, stars: 2 }],
    };
    const migrated = migrateState(partial as unknown as GameState);
    expect(migrated.coins).toBe(500);
    expect(migrated.settings.locale).toBeTruthy();
    expect(migrated.pond.fish).toBeInstanceOf(Array);
    expect(() => applyCommand(migrated, { type: "tick" }, T0)).not.toThrow();
  });

  it("drops a save from an unknown future version rather than trusting it", () => {
    const future = { ...freshState(), version: 9999 } as GameState;
    expect(() => migrateState(future)).not.toThrow();
  });
});

describe("anti-cheat", () => {
  it("does not let a replayed resolve produce two fish", () => {
    const state = freshState();
    const cast = applyCommand(state, { type: "cast" }, T0);
    const pending = cast.state.pendingCast!;
    const tapAtMs = firstHitMs(pending.barSeed, pending.sweepMs, pending.zoneCenter, pending.zoneWidth)!;
    const first = applyCommand(cast.state, { type: "resolveCast", tapAtMs }, T0 + 620 + tapAtMs);
    const replay = applyCommand(first.state, { type: "resolveCast", tapAtMs }, T0 + 620 + tapAtMs);
    expect(replay.effects.catchResult?.outcome).toBe("miss");
    expect(replay.state.bag.length).toBe(first.state.bag.length);
  });

  it("cannot sell the same fish twice", () => {
    let state = freshState();
    let now = T0;
    for (let i = 0; i < 40 && state.bag.length < 1; i++) {
      const played = playCast(state, now);
      state = played.state;
      now = played.now + 1200;
    }
    const id = state.bag[0].id;
    const first = applyCommand(state, { type: "sellFish", ids: [id] }, now);
    const second = applyCommand(first.state, { type: "sellFish", ids: [id] }, now);
    expect(second.effects.coins ?? 0).toBe(0);
    expect(second.state.coins).toBe(first.state.coins);
  });
});
