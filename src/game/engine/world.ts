import type { TimeOfDay, WeatherId } from "@/game/types";
import { createRng, hashString } from "./rng";

/**
 * World state is derived from the clock, not stored: every player shares the
 * same weather, and both client and server can compute it without a round trip.
 * Everything uses UTC+7 so "night" matches the players' actual evening.
 */
export const GAME_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

export function localParts(now: number) {
  const d = new Date(now + GAME_TZ_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
  };
}

export function timeOfDay(now: number): TimeOfDay {
  const { hour } = localParts(now);
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

export const TIME_LABEL: Record<TimeOfDay, { th: string; en: string; emoji: string }> = {
  dawn: { th: "รุ่งสาง", en: "Dawn", emoji: "🌅" },
  day: { th: "กลางวัน", en: "Day", emoji: "☀️" },
  dusk: { th: "พลบค่ำ", en: "Dusk", emoji: "🌇" },
  night: { th: "กลางคืน", en: "Night", emoji: "🌙" },
};

const WEATHER_TABLE: { id: WeatherId; weight: number }[] = [
  { id: "clear", weight: 36 },
  { id: "cloudy", weight: 26 },
  { id: "rain", weight: 18 },
  { id: "fog", weight: 11 },
  { id: "storm", weight: 6 },
];

/** Weather changes every 3 hours and is stable for everyone in that block. */
export function weatherAt(now: number): WeatherId {
  const { year, month, day, hour } = localParts(now);
  const block = Math.floor(hour / 3);
  const rng = createRng(hashString(`w:${year}-${month}-${day}-${block}`));
  const picked = rng.weighted(WEATHER_TABLE, (w) => w.weight).id;
  // Clear nights become moonlit, which is what the reef legends respond to.
  if (picked === "clear" && timeOfDay(now) === "night") return "moonlit";
  return picked;
}

export const WEATHER_LABEL: Record<WeatherId, { th: string; en: string; emoji: string }> = {
  clear: { th: "ฟ้าใส", en: "Clear", emoji: "☀️" },
  cloudy: { th: "เมฆมาก", en: "Cloudy", emoji: "☁️" },
  rain: { th: "ฝนพรำ", en: "Light rain", emoji: "🌧️" },
  storm: { th: "พายุ", en: "Storm", emoji: "⛈️" },
  fog: { th: "หมอกลง", en: "Foggy", emoji: "🌫️" },
  moonlit: { th: "คืนแสงจันทร์", en: "Moonlit", emoji: "🌕" },
};

/** Weather nudges bite luck a little, so the day has texture. */
export const WEATHER_LUCK: Record<WeatherId, number> = {
  clear: 0,
  cloudy: 0.02,
  rain: 0.06,
  storm: 0.12,
  fog: 0.05,
  moonlit: 0.1,
};

export function dailyKey(now: number): string {
  const { year, month, day } = localParts(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** ISO-style week key, computed in game time. */
export function weeklyKey(now: number): string {
  const d = new Date(now + GAME_TZ_OFFSET_MS);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  const week =
    1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** The travelling merchant's daily offer: one bait at a discount, one fish family paying extra. */
export function dailyMerchant(now: number) {
  const rng = createRng(hashString(`m:${dailyKey(now)}`));
  const baits = ["bait_shrimp", "bait_lure", "bait_glow", "bait_royal"] as const;
  const bonusZones = ["pond", "river", "lake", "sea", "deep", "reef"] as const;
  return {
    discountBaitId: rng.pick(baits),
    discount: 0.25 + rng.next() * 0.25,
    bonusZoneId: rng.pick(bonusZones),
    bonusMultiplier: 1.2 + rng.next() * 0.35,
  };
}
