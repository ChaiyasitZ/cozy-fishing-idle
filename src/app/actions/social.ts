"use server";

import { ITEM_BY_ID, SPECIES_BY_ID } from "@/game/data";
import {
  addLog,
  dailyKey,
  fishValue,
  getModifiers,
  grantAchievement,
  sanitizeForClient,
  trackQuest,
  weeklyKey,
} from "@/game/engine";
import type { FishInstance } from "@/game/types";
import {
  ensureProfile,
  GUILD_GOALS,
  loadProfileState,
  loadStateById,
  saveProfileState,
  writeAudit,
  type ProfileRow,
} from "@/lib/game/repo";
import type {
  ActionResult,
  BoardRow,
  ClubSummary,
  FriendSummary,
  GameSnapshot,
  GiftSummary,
  SocialSnapshot,
  TradeSummary,
} from "@/lib/game/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/supabase/server";

const GIFT_POOL = ["bait_shrimp", "food_basic", "bait_lure", "food_premium"];
const VISIT_REWARD_COINS = 120;

function nameOf(profile: { display_name: string | null; username: string | null; id: string }) {
  return profile.display_name ?? profile.username ?? profile.id.slice(0, 6);
}

/* ------------------------------------------------------------------ reading */

export async function getSocialAction(): Promise<SocialSnapshot | null> {
  const user = await getSessionUser();
  const supabase = createAdminClient();
  if (!user || !supabase) return null;

  const self = await ensureProfile(user);
  if (!self) return null;

  const now = Date.now();
  const day = dailyKey(now);
  const week = weeklyKey(now);

  const [{ data: links }, { data: giftRows }, { data: tradeRows }] = await Promise.all([
    supabase
      .from("friendships")
      .select("friend_id, status, requested_by")
      .eq("user_id", user.id),
    supabase
      .from("gifts")
      .select("id, item_id, qty, created_at, from_user")
      .eq("to_user", user.id)
      .is("claimed_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("trade_offers")
      .select("id, from_user, to_user, fish, ask_coins, status")
      .or(`from_user.eq.${user.id},to_user.eq.${user.id}`)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const friendIds = (links ?? []).map((l) => l.friend_id as string);
  const relatedIds = new Set<string>([
    ...friendIds,
    ...(giftRows ?? []).map((g) => g.from_user as string),
    ...(tradeRows ?? []).flatMap((t) => [t.from_user as string, t.to_user as string]),
  ]);
  relatedIds.delete(user.id);

  const { data: peopleRows } = relatedIds.size
    ? await supabase
        .from("public_profiles")
        .select(
          "id, username, display_name, friend_code, level, dex_count, biggest_species, biggest_size, pond_preview, week_key, week_coins, week_biggest_size, week_biggest_species",
        )
        .in("id", [...relatedIds])
    : { data: [] };

  type PersonRow = {
    id: string;
    username: string | null;
    display_name: string | null;
    friend_code: string;
    level: number;
    dex_count: number;
    biggest_species: string | null;
    biggest_size: number;
    pond_preview: { speciesId: string; stars: number }[] | null;
    week_key: string | null;
    week_coins: number;
    week_biggest_size: number;
    week_biggest_species: string | null;
  };
  const people = new Map<string, PersonRow>(
    ((peopleRows ?? []) as PersonRow[]).map((p) => [p.id, p]),
  );

  const [{ data: visits }, { data: giftsSentToday }] = await Promise.all([
    supabase.from("pond_visits").select("host_id").eq("visitor_id", user.id).eq("day_key", day),
    supabase.from("gifts").select("to_user").eq("from_user", user.id).eq("day_key", day),
  ]);
  const visitedToday = new Set((visits ?? []).map((v) => v.host_id as string));
  const giftedToday = new Set((giftsSentToday ?? []).map((g) => g.to_user as string));

  const friends: FriendSummary[] = (links ?? []).flatMap((link) => {
    const person = people.get(link.friend_id as string);
    if (!person) return [];
    return [
      {
        id: person.id,
        name: nameOf(person),
        friendCode: person.friend_code,
        level: person.level,
        dexCount: person.dex_count,
        biggestSpecies: person.biggest_species,
        biggestSize: Number(person.biggest_size ?? 0),
        pondPreview: person.pond_preview ?? [],
        status: link.status as "pending" | "accepted",
        incoming: link.status === "pending" && link.requested_by !== user.id,
        visitedToday: visitedToday.has(person.id),
        giftedToday: giftedToday.has(person.id),
      },
    ];
  });

  const gifts: GiftSummary[] = (giftRows ?? []).map((gift) => ({
    id: gift.id as string,
    fromName: nameOf(
      people.get(gift.from_user as string) ?? {
        id: gift.from_user as string,
        display_name: null,
        username: null,
      },
    ),
    itemId: gift.item_id as string,
    qty: gift.qty as number,
    createdAt: gift.created_at as string,
  }));

  const trades: TradeSummary[] = (tradeRows ?? []).map((trade) => {
    const fish = trade.fish as FishInstance;
    const outgoing = trade.from_user === user.id;
    return {
      id: trade.id as string,
      outgoing,
      fromName: outgoing
        ? "—"
        : nameOf(
            people.get(trade.from_user as string) ?? {
              id: trade.from_user as string,
              display_name: null,
              username: null,
            },
          ),
      toName: outgoing
        ? nameOf(
            people.get(trade.to_user as string) ?? {
              id: trade.to_user as string,
              display_name: null,
              username: null,
            },
          )
        : "—",
      speciesId: fish.speciesId,
      sizeCm: fish.sizeCm,
      stars: fish.stars,
      mutation: fish.mutation,
      askCoins: Number(trade.ask_coins ?? 0),
      status: trade.status as TradeSummary["status"],
    };
  });

  // Boards are computed from the weekly counters that already live on profiles.
  const accepted = friends.filter((f) => f.status === "accepted");
  const selfWeek = {
    userId: self.id,
    name: nameOf(self),
    isSelf: true,
  };
  const boards = {
    biggest: sortBoard([
      {
        ...selfWeek,
        score: self.week_key === week ? Number(self.week_biggest_size ?? 0) : 0,
        detail: self.week_key === week ? self.week_biggest_species : null,
      },
      ...accepted.map((friend) => {
        const person = people.get(friend.id);
        return {
          userId: friend.id,
          name: friend.name,
          isSelf: false,
          score:
            person?.week_key === week ? Number(person?.week_biggest_size ?? 0) : 0,
          detail: person?.week_key === week ? (person?.week_biggest_species ?? null) : null,
        };
      }),
    ]),
    dex: sortBoard([
      { ...selfWeek, score: self.dex_count, detail: null },
      ...accepted.map((friend) => ({
        userId: friend.id,
        name: friend.name,
        isSelf: false,
        score: friend.dexCount,
        detail: null,
      })),
    ]),
    coins: sortBoard([
      {
        ...selfWeek,
        score: self.week_key === week ? Number(self.week_coins ?? 0) : 0,
        detail: null,
      },
      ...accepted.map((friend) => {
        const person = people.get(friend.id);
        return {
          userId: friend.id,
          name: friend.name,
          isSelf: false,
          score: person?.week_key === week ? Number(person?.week_coins ?? 0) : 0,
          detail: null,
        };
      }),
    ]),
  };

  return {
    self: { id: self.id, name: nameOf(self), friendCode: self.friend_code },
    friends,
    gifts,
    boards,
    trades,
    club: await loadClub(self, week),
  };
}

function sortBoard(rows: BoardRow[]): BoardRow[] {
  return rows.sort((a, b) => b.score - a.score).slice(0, 12);
}

async function loadClub(self: ProfileRow, week: string): Promise<ClubSummary | null> {
  const supabase = createAdminClient();
  if (!supabase || !self.guild_id) return null;

  const [{ data: guild }, { data: members }, { data: goals }] = await Promise.all([
    supabase.from("guilds").select("id, name, motto, owner_id").eq("id", self.guild_id).maybeSingle(),
    supabase.from("guild_members").select("user_id, role").eq("guild_id", self.guild_id).limit(50),
    supabase.from("guild_goals").select("goal_id, progress, target").eq("guild_id", self.guild_id).eq("period_key", week),
  ]);
  if (!guild) return null;

  const memberIds = (members ?? []).map((m) => m.user_id as string);
  const { data: memberProfiles } = memberIds.length
    ? await supabase.from("public_profiles").select("id, username, display_name, level").in("id", memberIds)
    : { data: [] };

  return {
    id: guild.id as string,
    name: guild.name as string,
    motto: (guild.motto as string) ?? null,
    isOwner: guild.owner_id === self.id,
    members: ((memberProfiles ?? []) as { id: string; username: string | null; display_name: string | null; level: number }[]).map((m) => ({
      id: m.id,
      name: nameOf(m),
      level: m.level,
      isSelf: m.id === self.id,
    })),
    goals: GUILD_GOALS.map((goal) => {
      const row = (goals ?? []).find((g) => g.goal_id === goal.goalId);
      return {
        goalId: goal.goalId,
        progress: Number(row?.progress ?? 0),
        target: Number(row?.target ?? goal.target),
      };
    }),
  };
}

/* ----------------------------------------------------------------- friends */

export async function addFriendAction(code: string): Promise<ActionResult> {
  const user = await getSessionUser();
  const supabase = createAdminClient();
  if (!user || !supabase) return { ok: false, error: "unauthenticated" };

  const self = await ensureProfile(user);
  if (!self) return { ok: false, error: "no_profile" };

  const normalized = code.trim().toUpperCase();
  if (normalized === self.friend_code) return { ok: false, error: "self" };

  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .eq("friend_code", normalized)
    .maybeSingle();
  if (!target) return { ok: false, error: "not_found" };

  const friendId = target.id as string;
  const { error } = await supabase.from("friendships").upsert([
    { user_id: self.id, friend_id: friendId, status: "pending", requested_by: self.id },
    { user_id: friendId, friend_id: self.id, status: "pending", requested_by: self.id },
  ]);
  if (error) return { ok: false, error: "failed" };

  await writeAudit(self.id, "friend_request", { friendId });
  return { ok: true };
}

export async function acceptFriendAction(friendId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  const supabase = createAdminClient();
  if (!user || !supabase) return { ok: false, error: "unauthenticated" };

  const { data: link } = await supabase
    .from("friendships")
    .select("requested_by, status")
    .eq("user_id", user.id)
    .eq("friend_id", friendId)
    .maybeSingle();
  if (!link || link.requested_by === user.id) return { ok: false, error: "not_found" };

  await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .in("user_id", [user.id, friendId])
    .in("friend_id", [user.id, friendId]);

  // Both sides get the badge for their first fishing buddy.
  for (const id of [user.id, friendId]) {
    const loaded = await loadStateById(id);
    if (!loaded) continue;
    grantAchievement(loaded.state, "friend_1");
    await saveProfileState(id, loaded.profile, loaded.state);
  }
  return { ok: true };
}

export async function removeFriendAction(friendId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  const supabase = createAdminClient();
  if (!user || !supabase) return { ok: false, error: "unauthenticated" };

  await supabase
    .from("friendships")
    .delete()
    .in("user_id", [user.id, friendId])
    .in("friend_id", [user.id, friendId]);
  return { ok: true };
}

/* ------------------------------------------------------------------- gifts */

export async function sendGiftAction(friendId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  const supabase = createAdminClient();
  if (!user || !supabase) return { ok: false, error: "unauthenticated" };

  const now = Date.now();
  const day = dailyKey(now);
  const loaded = await loadProfileState(user, now);
  if (!loaded) return { ok: false, error: "no_profile" };

  const { data: friendship } = await supabase
    .from("friendships")
    .select("status")
    .eq("user_id", user.id)
    .eq("friend_id", friendId)
    .maybeSingle();
  if (friendship?.status !== "accepted") return { ok: false, error: "not_friends" };

  const itemId = GIFT_POOL[Math.floor(Math.random() * GIFT_POOL.length)];
  const { error } = await supabase.from("gifts").insert({
    from_user: user.id,
    to_user: friendId,
    item_id: itemId,
    qty: 2,
    day_key: day,
  });
  if (error) return { ok: false, error: "already_sent" };

  const state = loaded.state;
  state.stats.giftsSent += 1;
  trackQuest(state, "gift", 1);
  addLog(state, "social", "ส่งของขวัญให้เพื่อน", "Sent a gift to a friend", now);
  await saveProfileState(user.id, loaded.profile, state, {}, now);
  return { ok: true };
}

export async function claimGiftAction(giftId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  const supabase = createAdminClient();
  if (!user || !supabase) return { ok: false, error: "unauthenticated" };

  const now = Date.now();
  const { data: gift } = await supabase
    .from("gifts")
    .select("id, item_id, qty, to_user, claimed_at")
    .eq("id", giftId)
    .maybeSingle();
  if (!gift || gift.to_user !== user.id || gift.claimed_at) {
    return { ok: false, error: "not_found" };
  }

  const { error } = await supabase
    .from("gifts")
    .update({ claimed_at: new Date(now).toISOString() })
    .eq("id", giftId)
    .is("claimed_at", null);
  if (error) return { ok: false, error: "failed" };

  const loaded = await loadProfileState(user, now);
  if (!loaded) return { ok: false, error: "no_profile" };
  const state = loaded.state;
  const itemId = gift.item_id as string;
  state.items[itemId] = (state.items[itemId] ?? 0) + (gift.qty as number);
  const item = ITEM_BY_ID[itemId];
  addLog(
    state,
    "social",
    `ได้รับ${item ? item.name.th : itemId} จากเพื่อน`,
    `Received ${item ? item.name.en : itemId} from a friend`,
    now,
  );
  await saveProfileState(user.id, loaded.profile, state, {}, now);
  return { ok: true };
}

/* -------------------------------------------------------------- pond visit */

export async function visitPondAction(hostId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  const supabase = createAdminClient();
  if (!user || !supabase) return { ok: false, error: "unauthenticated" };

  const now = Date.now();
  const day = dailyKey(now);

  const { data: friendship } = await supabase
    .from("friendships")
    .select("status")
    .eq("user_id", user.id)
    .eq("friend_id", hostId)
    .maybeSingle();
  if (friendship?.status !== "accepted") return { ok: false, error: "not_friends" };

  const { error } = await supabase.from("pond_visits").insert({
    visitor_id: user.id,
    host_id: hostId,
    day_key: day,
  });
  if (error) return { ok: false, error: "already_visited" };

  // The visitor tidies up: the host's water gets fresher, both get a little coin.
  const host = await loadStateById(hostId, now);
  if (host) {
    host.state.pond.freshness = Math.min(1, host.state.pond.freshness + 0.2);
    host.state.pond.lastFedAt = now;
    host.state.coins += VISIT_REWARD_COINS;
    addLog(host.state, "social", "เพื่อนมาช่วยดูแลบ่อให้", "A friend tidied your pond", now);
    await saveProfileState(hostId, host.profile, host.state, {}, now);
  }

  const visitor = await loadProfileState(user, now);
  if (!visitor) return { ok: false, error: "no_profile" };
  visitor.state.coins += VISIT_REWARD_COINS;
  visitor.state.stats.visits += 1;
  trackQuest(visitor.state, "visit", 1);
  addLog(visitor.state, "social", "ไปเยี่ยมบ่อเพื่อน", "Visited a friend's pond", now);
  await saveProfileState(user.id, visitor.profile, visitor.state, {}, now);

  return { ok: true, message: "visited" };
}

/* ------------------------------------------------------------------ trades */

export async function createTradeAction(
  friendId: string,
  fishId: string,
  askCoins: number,
): Promise<GameSnapshot | null> {
  const user = await getSessionUser();
  const supabase = createAdminClient();
  if (!user || !supabase) return null;

  const now = Date.now();
  const loaded = await loadProfileState(user, now);
  if (!loaded) return null;

  const state = loaded.state;
  const index = state.bag.findIndex((f) => f.id === fishId);
  if (index < 0) return { state: sanitizeForClient(state), effects: { ok: false, error: "not_found" } };

  const [fish] = state.bag.splice(index, 1);
  const { error } = await supabase.from("trade_offers").insert({
    from_user: user.id,
    to_user: friendId,
    fish,
    ask_coins: Math.max(0, Math.floor(askCoins)),
  });
  if (error) {
    state.bag.splice(index, 0, fish);
    return { state: sanitizeForClient(state), effects: { ok: false, error: "failed" } };
  }

  addLog(state, "social", "ตั้งข้อเสนอแลกเปลี่ยนปลา", "Offered a fish for trade", now);
  await saveProfileState(user.id, loaded.profile, state, {}, now);
  return { state: sanitizeForClient(state), effects: { ok: true } };
}

export async function acceptTradeAction(tradeId: string): Promise<GameSnapshot | null> {
  const user = await getSessionUser();
  const supabase = createAdminClient();
  if (!user || !supabase) return null;

  const now = Date.now();
  const { data: trade } = await supabase
    .from("trade_offers")
    .select("id, from_user, to_user, fish, ask_coins, status")
    .eq("id", tradeId)
    .maybeSingle();
  if (!trade || trade.to_user !== user.id || trade.status !== "open") return null;

  const buyer = await loadProfileState(user, now);
  if (!buyer) return null;
  const price = Number(trade.ask_coins ?? 0);
  const mods = getModifiers(buyer.state);

  if (buyer.state.coins < price) {
    return { state: sanitizeForClient(buyer.state), effects: { ok: false, error: "cannot_afford" } };
  }
  if (buyer.state.bag.length >= mods.bagCapacity) {
    return { state: sanitizeForClient(buyer.state), effects: { ok: false, error: "bag_full" } };
  }

  // Claim the offer first: whoever wins this update owns the trade.
  const { data: claimed } = await supabase
    .from("trade_offers")
    .update({ status: "accepted", resolved_at: new Date(now).toISOString() })
    .eq("id", tradeId)
    .eq("status", "open")
    .select("id")
    .maybeSingle();
  if (!claimed) return null;

  const fish = trade.fish as FishInstance;
  buyer.state.coins -= price;
  buyer.state.bag.push(fish);
  const species = SPECIES_BY_ID[fish.speciesId];
  addLog(
    buyer.state,
    "social",
    `แลกเปลี่ยนได้ ${species?.name.th ?? fish.speciesId}`,
    `Traded for a ${species?.name.en ?? fish.speciesId}`,
    now,
  );
  await saveProfileState(user.id, buyer.profile, buyer.state, {}, now);

  const seller = await loadStateById(trade.from_user as string, now);
  if (seller) {
    seller.state.coins += price;
    seller.state.stats.coinsEarned += price;
    addLog(seller.state, "social", `ขายปลาผ่านการแลกเปลี่ยน +${price} เหรียญ`, `Trade sold for ${price} coins`, now);
    await saveProfileState(trade.from_user as string, seller.profile, seller.state, {}, now);
  }

  return { state: sanitizeForClient(buyer.state), effects: { ok: true, coins: -price } };
}

export async function cancelTradeAction(tradeId: string): Promise<GameSnapshot | null> {
  const user = await getSessionUser();
  const supabase = createAdminClient();
  if (!user || !supabase) return null;

  const now = Date.now();
  const { data: trade } = await supabase
    .from("trade_offers")
    .select("id, from_user, fish, status")
    .eq("id", tradeId)
    .maybeSingle();
  if (!trade || trade.from_user !== user.id || trade.status !== "open") return null;

  const { data: claimed } = await supabase
    .from("trade_offers")
    .update({ status: "cancelled", resolved_at: new Date(now).toISOString() })
    .eq("id", tradeId)
    .eq("status", "open")
    .select("id")
    .maybeSingle();
  if (!claimed) return null;

  const loaded = await loadProfileState(user, now);
  if (!loaded) return null;
  const mods = getModifiers(loaded.state);
  const fish = trade.fish as FishInstance;
  if (loaded.state.bag.length < mods.bagCapacity) {
    loaded.state.bag.push(fish);
  } else {
    // No room to take it back, so the harbour buys it at the going rate.
    const refund = fishValue(loaded.state, fish, now);
    loaded.state.coins += refund;
    loaded.state.stats.coinsEarned += refund;
  }
  addLog(loaded.state, "social", "ยกเลิกข้อเสนอแลกเปลี่ยน", "Cancelled a trade offer", now);
  await saveProfileState(user.id, loaded.profile, loaded.state, {}, now);
  return { state: sanitizeForClient(loaded.state), effects: { ok: true } };
}

/* ------------------------------------------------------------------- clubs */

export async function createClubAction(name: string): Promise<ActionResult> {
  const user = await getSessionUser();
  const supabase = createAdminClient();
  if (!user || !supabase) return { ok: false, error: "unauthenticated" };

  const self = await ensureProfile(user);
  if (!self) return { ok: false, error: "no_profile" };
  if (self.guild_id) return { ok: false, error: "already_member" };

  const clean = name.trim().slice(0, 32);
  if (clean.length < 3) return { ok: false, error: "name_too_short" };

  const { data: guild, error } = await supabase
    .from("guilds")
    .insert({ name: clean, owner_id: self.id })
    .select("id")
    .single();
  if (error || !guild) return { ok: false, error: "name_taken" };

  await supabase
    .from("guild_members")
    .insert({ guild_id: guild.id, user_id: self.id, role: "owner" });
  await supabase.from("profiles").update({ guild_id: guild.id }).eq("id", self.id);
  return { ok: true };
}

export async function joinClubAction(name: string): Promise<ActionResult> {
  const user = await getSessionUser();
  const supabase = createAdminClient();
  if (!user || !supabase) return { ok: false, error: "unauthenticated" };

  const self = await ensureProfile(user);
  if (!self) return { ok: false, error: "no_profile" };
  if (self.guild_id) return { ok: false, error: "already_member" };

  const { data: guild } = await supabase
    .from("guilds")
    .select("id")
    .eq("name", name.trim())
    .maybeSingle();
  if (!guild) return { ok: false, error: "not_found" };

  await supabase.from("guild_members").insert({ guild_id: guild.id, user_id: self.id });
  await supabase.from("profiles").update({ guild_id: guild.id }).eq("id", self.id);
  return { ok: true };
}

export async function leaveClubAction(): Promise<ActionResult> {
  const user = await getSessionUser();
  const supabase = createAdminClient();
  if (!user || !supabase) return { ok: false, error: "unauthenticated" };

  const self = await ensureProfile(user);
  if (!self?.guild_id) return { ok: false, error: "not_member" };

  await supabase
    .from("guild_members")
    .delete()
    .eq("guild_id", self.guild_id)
    .eq("user_id", self.id);
  await supabase.from("profiles").update({ guild_id: null }).eq("id", self.id);
  return { ok: true };
}

export async function setDisplayNameAction(name: string): Promise<ActionResult> {
  const user = await getSessionUser();
  const supabase = createAdminClient();
  if (!user || !supabase) return { ok: false, error: "unauthenticated" };
  const clean = name.trim().slice(0, 24);
  if (clean.length < 2) return { ok: false, error: "name_too_short" };
  await supabase.from("profiles").update({ display_name: clean }).eq("id", user.id);
  return { ok: true };
}