import "server-only";

import { SPECIES_BY_ID } from "@/game/data";
import {
  createInitialState,
  migrateState,
  weeklyKey,
  type Command,
} from "@/game/engine";
import type { GameState } from "@/game/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionUser } from "@/lib/supabase/server";

const AUDIT_KEEP = 30;

export interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  friend_code: string;
  guild_id: string | null;
  save: unknown;
  level: number;
  dex_count: number;
  coins_earned_total: number;
  week_key: string | null;
  week_coins: number;
  week_catches: number;
  week_biggest_size: number;
  week_biggest_species: string | null;
}

function randomFriendCode(): string {
  // Unambiguous alphabet: no 0/O/1/I.
  const alphabet = "ACDEFGHJKLMNPQRTUVWXY2346789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `FISH-${code}`;
}

function defaultName(user: SessionUser): string {
  if (user.email) return user.email.split("@")[0].slice(0, 20);
  return "นักตกปลาใหม่";
}

/** Creates the profile row on first sign-in. Idempotent. */
export async function ensureProfile(user: SessionUser): Promise<ProfileRow | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data: existing } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, friend_code, guild_id, save, level, dex_count, coins_earned_total, week_key, week_coins, week_catches, week_biggest_size, week_biggest_species",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (existing) return existing as ProfileRow;

  const state = createInitialState();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        display_name: defaultName(user),
        friend_code: randomFriendCode(),
        save: state,
        level: state.level,
        coins: state.coins,
        last_tick_at: new Date(state.lastTickAt).toISOString(),
        week_key: weeklyKey(Date.now()),
      })
      .select(
        "id, username, display_name, friend_code, guild_id, save, level, dex_count, coins_earned_total, week_key, week_coins, week_catches, week_biggest_size, week_biggest_species",
      )
      .single();

    if (!error && data) return data as ProfileRow;
    // 23505 = unique violation: almost always the friend code, so try again.
    if (error?.code !== "23505") break;
  }
  return null;
}

export async function loadProfileState(
  user: SessionUser,
  now = Date.now(),
): Promise<{ profile: ProfileRow; state: GameState } | null> {
  const profile = await ensureProfile(user);
  if (!profile) return null;
  return { profile, state: migrateState(profile.save, now) };
}

const PROFILE_COLUMNS =
  "id, username, display_name, friend_code, guild_id, save, level, dex_count, coins_earned_total, week_key, week_coins, week_catches, week_biggest_size, week_biggest_species";

/**
 * Loads another player's save — needed when an action changes two people at
 * once, like accepting a trade or feeding a friend's pond.
 */
export async function loadStateById(
  userId: string,
  now = Date.now(),
): Promise<{ profile: ProfileRow; state: GameState } | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  const profile = data as ProfileRow;
  return { profile, state: migrateState(profile.save, now) };
}

export interface SaveMeta {
  /** Size of a fish landed by this action, for the weekly board. */
  caughtSize?: number;
  caughtSpecies?: string;
  caughtCount?: number;
}

/**
 * Writes the save plus the handful of denormalised columns other players can
 * see. One UPDATE per action — the weekly counters live here precisely so a
 * leaderboard costs no additional writes.
 */
export async function saveProfileState(
  userId: string,
  previous: ProfileRow,
  state: GameState,
  meta: SaveMeta = {},
  now = Date.now(),
): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;

  const week = weeklyKey(now);
  const sameWeek = previous.week_key === week;
  const coinsDelta = Math.max(0, state.stats.coinsEarned - (previous.coins_earned_total ?? 0));
  const catchesDelta = meta.caughtCount ?? 0;

  const previousWeekBiggest = sameWeek ? (previous.week_biggest_size ?? 0) : 0;
  const beatsWeekRecord = (meta.caughtSize ?? 0) > previousWeekBiggest;
  const weekBiggest = beatsWeekRecord ? (meta.caughtSize ?? 0) : previousWeekBiggest;
  const weekBiggestSpecies = beatsWeekRecord
    ? (meta.caughtSpecies ?? null)
    : sameWeek
      ? previous.week_biggest_species
      : null;

  const pondPreview = state.pond.fish.slice(0, 6).map((fish) => ({
    speciesId: fish.speciesId,
    stars: fish.stars,
  }));

  await supabase
    .from("profiles")
    .update({
      save: state,
      save_version: state.saveVersion,
      content_version: state.contentVersion,
      level: state.level,
      coins: Math.min(Number.MAX_SAFE_INTEGER, state.coins),
      dex_count: Object.keys(state.fishdex).length,
      biggest_species: state.stats.biggest?.speciesId ?? null,
      biggest_size: state.stats.biggest?.sizeCm ?? 0,
      coins_earned_total: state.stats.coinsEarned,
      pond_preview: pondPreview,
      prestige_count: state.prestige.count,
      week_key: week,
      week_coins: (sameWeek ? previous.week_coins : 0) + coinsDelta,
      week_catches: (sameWeek ? previous.week_catches : 0) + catchesDelta,
      week_biggest_size: weekBiggest,
      week_biggest_species: weekBiggestSpecies,
      last_tick_at: new Date(state.lastTickAt).toISOString(),
      updated_at: new Date(now).toISOString(),
    })
    .eq("id", userId);

  // Club goals move with the same delta, so no separate tracking is needed.
  if (previous.guild_id && catchesDelta > 0) {
    await bumpGuildGoal(previous.guild_id, "catches", catchesDelta, now);
  }
}

export const GUILD_GOALS: { goalId: string; target: number; label: { th: string; en: string } }[] = [
  { goalId: "catches", target: 500, label: { th: "ตกปลารวมกัน 500 ตัว", en: "Catch 500 fish together" } },
];

async function bumpGuildGoal(
  guildId: string,
  goalId: string,
  amount: number,
  now: number,
): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;
  const period = weeklyKey(now);
  const goal = GUILD_GOALS.find((g) => g.goalId === goalId);
  if (!goal) return;

  const { data } = await supabase
    .from("guild_goals")
    .select("progress")
    .eq("guild_id", guildId)
    .eq("period_key", period)
    .eq("goal_id", goalId)
    .maybeSingle();

  await supabase.from("guild_goals").upsert({
    guild_id: guildId,
    period_key: period,
    goal_id: goalId,
    target: goal.target,
    progress: (data?.progress ?? 0) + amount,
  });
}

/** Small, bounded audit trail. Useful when a player claims something went wrong. */
export async function writeAudit(
  userId: string,
  action: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;
  await supabase.from("audit_log").insert({ user_id: userId, action, detail });

  // Trim occasionally rather than on every write.
  if (Math.random() < 0.05) {
    const { data } = await supabase
      .from("audit_log")
      .select("id")
      .eq("user_id", userId)
      .order("id", { ascending: false })
      .range(AUDIT_KEEP, AUDIT_KEEP);
    const cutoff = data?.[0]?.id;
    if (cutoff) {
      await supabase.from("audit_log").delete().eq("user_id", userId).lte("id", cutoff);
    }
  }
}

/** Actions worth recording; casting every two seconds is not one of them. */
const AUDITED: Command["type"][] = [
  "prestige",
  "unlockZone",
  "buyUpgrade",
  "learnSkill",
  "breed",
  "claimQuest",
];

export function shouldAudit(command: Command): boolean {
  return AUDITED.includes(command.type);
}

/**
 * Per-user request throttle. In-memory, so it is per instance — a backstop for
 * accidental loops rather than a hard security boundary (the engine's own cast
 * cooldown is the real limit).
 */
const buckets = new Map<string, { tokens: number; refilledAt: number }>();
const BUCKET_SIZE = 40;
const REFILL_PER_MS = BUCKET_SIZE / 20_000;

export function takeToken(userId: string, now = Date.now()): boolean {
  const bucket = buckets.get(userId) ?? { tokens: BUCKET_SIZE, refilledAt: now };
  const refill = (now - bucket.refilledAt) * REFILL_PER_MS;
  const tokens = Math.min(BUCKET_SIZE, bucket.tokens + refill);
  if (tokens < 1) {
    buckets.set(userId, { tokens, refilledAt: now });
    return false;
  }
  buckets.set(userId, { tokens: tokens - 1, refilledAt: now });
  if (buckets.size > 5000) buckets.clear();
  return true;
}

export function speciesName(speciesId: string | null | undefined): string {
  if (!speciesId) return "";
  return SPECIES_BY_ID[speciesId]?.name.en ?? speciesId;
}
