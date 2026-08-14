import { ACHIEVEMENT_BY_ID, SPECIES, SPECIES_BY_ID } from "@/game/data";
import type { Achievement, GameState } from "@/game/types";
import { addLog } from "./log";
import { getModifiers } from "./modifiers";

type Condition = (state: GameState) => boolean;

const CONDITIONS: Record<string, Condition> = {
  first_cast: (s) => s.stats.casts >= 1,
  catch_10: (s) => s.stats.totalCaught >= 10,
  catch_250: (s) => s.stats.totalCaught >= 250,
  catch_2000: (s) => s.stats.totalCaught >= 2000,
  dex_10: (s) => Object.keys(s.fishdex).length >= 10,
  dex_25: (s) => Object.keys(s.fishdex).length >= 25,
  dex_all: (s) => Object.keys(s.fishdex).length >= SPECIES.length,
  first_legendary: (s) =>
    Object.keys(s.fishdex).some((id) =>
      ["legendary", "mythic"].includes(SPECIES_BY_ID[id]?.rarity ?? ""),
    ),
  first_mutation: (s) => s.stats.mutations >= 1,
  // An upgraded pond, not the four starter slots you fill in your first minute.
  pond_full: (s) => {
    const slots = getModifiers(s).pondSlots;
    return slots >= 10 && s.pond.fish.length >= slots;
  },
  breeder_1: (s) => s.stats.bred >= 1,
  perfect_25: (s) => s.stats.perfectCasts >= 25,
  zone_sea: (s) => s.unlockedZones.includes("sea"),
  zone_reef: (s) => s.unlockedZones.includes("reef"),
  prestige_1: (s) => s.prestige.count >= 1,
  // friend_1 is granted by the server when a friendship is accepted.
};

export function grantAchievement(
  state: GameState,
  id: string,
  now = Date.now(),
): Achievement | null {
  const achievement = ACHIEVEMENT_BY_ID[id];
  if (!achievement || state.achievements.includes(id)) return null;
  state.achievements.push(id);
  state.coins += achievement.reward.coins;
  state.pearls += achievement.reward.pearls;
  addLog(
    state,
    "system",
    `ปลดล็อกรางวัล: ${achievement.name.th}`,
    `Achievement unlocked: ${achievement.name.en}`,
    now,
  );
  return achievement;
}

export function checkAchievements(state: GameState, now = Date.now()): Achievement[] {
  const unlocked: Achievement[] = [];
  for (const [id, condition] of Object.entries(CONDITIONS)) {
    if (state.achievements.includes(id)) continue;
    if (!condition(state)) continue;
    const achievement = grantAchievement(state, id, now);
    if (achievement) unlocked.push(achievement);
  }
  return unlocked;
}
