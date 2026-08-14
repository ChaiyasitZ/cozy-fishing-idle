import { CONTENT_VERSION, SAVE_VERSION } from "@/game/data";
import type { GameState, Locale } from "@/game/types";
import { addLog } from "./log";
import { rollDailyQuests, rollWeeklyQuests } from "./quests";
import { randomSeed } from "./rng";
import { dailyKey, weeklyKey } from "./world";

export function clone<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);
}

export function createInitialState(now = Date.now(), locale: Locale = "th"): GameState {
  const state: GameState = {
    saveVersion: SAVE_VERSION,
    contentVersion: CONTENT_VERSION,
    createdAt: now,
    lastTickAt: now,
    lastCastAt: 0,
    rngSeed: randomSeed(),

    coins: 60,
    pearls: 0,
    xp: 0,
    level: 1,
    skillPoints: 0,

    prestige: { count: 0, blessing: 0 },

    zoneId: "pond",
    unlockedZones: ["pond"],

    bag: [],
    pond: { fish: [], lastFedAt: now, freshness: 1 },

    items: { bait_worm: 12, food_basic: 3 },
    equippedBaitId: "bait_worm",

    upgrades: {},
    skills: {},

    fishdex: {},
    quests: {
      dailyKey: dailyKey(now),
      weeklyKey: weeklyKey(now),
      daily: rollDailyQuests(dailyKey(now)),
      weekly: rollWeeklyQuests(),
    },

    achievements: [],
    stats: {
      totalCaught: 0,
      totalSold: 0,
      coinsEarned: 0,
      casts: 0,
      perfectCasts: 0,
      escapes: 0,
      bred: 0,
      mutations: 0,
      giftsSent: 0,
      visits: 0,
      dailiesCompleted: 0,
      biggest: null,
    },
    pendingCast: null,
    log: [],
    settings: {
      locale,
      sound: true,
      music: false,
      theme: "system",
      reducedMotion: false,
    },
  };

  addLog(
    state,
    "system",
    "คุณยายฝากบ่อหลังบ้านไว้ให้ ลองเหวี่ยงเบ็ดดูสิ",
    "Grandma left you her pond. Try a cast.",
    now,
  );
  return state;
}

/**
 * Brings an older save up to the current shape. Unknown/older fields are filled
 * from a fresh state rather than dropped, so a content update never wipes a save.
 */
export function migrateState(input: unknown, now = Date.now()): GameState {
  const fresh = createInitialState(now);
  if (!input || typeof input !== "object") return fresh;

  const raw = input as Partial<GameState> & Record<string, unknown>;
  const merged: GameState = {
    ...fresh,
    ...raw,
    prestige: { ...fresh.prestige, ...(raw.prestige ?? {}) },
    pond: { ...fresh.pond, ...(raw.pond ?? {}) },
    quests: { ...fresh.quests, ...(raw.quests ?? {}) },
    stats: { ...fresh.stats, ...(raw.stats ?? {}) },
    settings: { ...fresh.settings, ...(raw.settings ?? {}) },
    items: { ...(raw.items ?? {}) },
    upgrades: { ...(raw.upgrades ?? {}) },
    skills: { ...(raw.skills ?? {}) },
    fishdex: { ...(raw.fishdex ?? {}) },
    bag: Array.isArray(raw.bag) ? raw.bag : [],
    unlockedZones:
      Array.isArray(raw.unlockedZones) && raw.unlockedZones.length > 0
        ? raw.unlockedZones
        : fresh.unlockedZones,
    achievements: Array.isArray(raw.achievements) ? raw.achievements : [],
    log: Array.isArray(raw.log) ? raw.log : [],
  };
  merged.pond.fish = Array.isArray(raw.pond?.fish) ? raw.pond.fish : [];
  merged.saveVersion = SAVE_VERSION;
  merged.contentVersion = CONTENT_VERSION;
  if (!Number.isFinite(merged.lastTickAt)) merged.lastTickAt = now;
  if (!Number.isFinite(merged.rngSeed)) merged.rngSeed = randomSeed();
  return merged;
}
