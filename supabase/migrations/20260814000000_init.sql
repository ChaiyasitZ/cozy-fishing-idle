-- Cozy Fishing Idle — initial schema.
--
-- Security model: every table has RLS enabled and only ever grants SELECT on
-- rows the player participates in. There are deliberately NO insert/update/
-- delete policies: all writes go through Server Actions using the secret key,
-- which scope every statement by the user id verified from the session JWT.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles ---
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  display_name text,
  friend_code text not null unique,
  guild_id uuid,

  -- Authoritative save. One row write per action keeps the free tier happy.
  save jsonb not null,
  save_version integer not null default 1,
  content_version integer not null default 1,

  -- Denormalised copies used by friends, visits and leaderboards.
  level integer not null default 1,
  coins bigint not null default 0,
  dex_count integer not null default 0,
  biggest_species text,
  biggest_size numeric not null default 0,
  coins_earned_total bigint not null default 0,
  pond_preview jsonb not null default '[]'::jsonb,
  prestige_count integer not null default 0,

  -- Weekly leaderboard counters, reset in place when week_key changes. Keeping
  -- them on the profile row means a board needs no extra writes per action.
  week_key text,
  week_coins bigint not null default 0,
  week_catches integer not null default 0,
  week_biggest_size numeric not null default 0,
  week_biggest_species text,

  last_tick_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_guild_idx on public.profiles (guild_id);

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (auth.uid() = id);

-- Canonical list of columns that are safe to show other players. Reads happen
-- server-side; access is revoked here so the Data API can never expose it.
create or replace view public.public_profiles
  with (security_invoker = true) as
  select id, username, display_name, friend_code, level, dex_count,
         biggest_species, biggest_size, pond_preview, prestige_count,
         guild_id, week_key, week_coins, week_catches, week_biggest_size,
         week_biggest_species, updated_at
    from public.profiles;

revoke all on public.public_profiles from anon, authenticated;

-- ------------------------------------------------------------- friendships ---
-- One row per direction so "my friends" is a single indexed lookup.
create table if not exists public.friendships (
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  requested_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  constraint friendships_no_self check (user_id <> friend_id)
);

create index if not exists friendships_friend_idx on public.friendships (friend_id);

alter table public.friendships enable row level security;

drop policy if exists "friendships: read own" on public.friendships;
create policy "friendships: read own" on public.friendships
  for select to authenticated using (auth.uid() = user_id or auth.uid() = friend_id);

-- ------------------------------------------------------------------- gifts ---
create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  item_id text not null,
  qty integer not null default 1 check (qty > 0),
  day_key text not null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (from_user, to_user, day_key)
);

create index if not exists gifts_inbox_idx on public.gifts (to_user, claimed_at);

alter table public.gifts enable row level security;

drop policy if exists "gifts: read own" on public.gifts;
create policy "gifts: read own" on public.gifts
  for select to authenticated using (auth.uid() = to_user or auth.uid() = from_user);

-- -------------------------------------------------------------- pond visits ---
create table if not exists public.pond_visits (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.profiles (id) on delete cascade,
  host_id uuid not null references public.profiles (id) on delete cascade,
  day_key text not null,
  created_at timestamptz not null default now(),
  unique (visitor_id, host_id, day_key)
);

create index if not exists pond_visits_host_idx on public.pond_visits (host_id, day_key);

alter table public.pond_visits enable row level security;

drop policy if exists "pond_visits: read own" on public.pond_visits;
create policy "pond_visits: read own" on public.pond_visits
  for select to authenticated using (auth.uid() = visitor_id or auth.uid() = host_id);

-- ------------------------------------------------------------ trade offers ---
-- The fish is escrowed as a JSON snapshot: it leaves the seller's save when the
-- offer is created, so it can never be sold twice.
create table if not exists public.trade_offers (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  fish jsonb not null,
  ask_coins bigint not null default 0 check (ask_coins >= 0),
  status text not null default 'open' check (status in ('open', 'accepted', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists trade_offers_inbox_idx on public.trade_offers (to_user, status);
create index if not exists trade_offers_outbox_idx on public.trade_offers (from_user, status);

alter table public.trade_offers enable row level security;

drop policy if exists "trades: read own" on public.trade_offers;
create policy "trades: read own" on public.trade_offers
  for select to authenticated using (auth.uid() = from_user or auth.uid() = to_user);

-- ------------------------------------------------------------------ guilds ---
create table if not exists public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  motto text,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.guilds enable row level security;

drop policy if exists "guilds: read member" on public.guilds;
create policy "guilds: read member" on public.guilds
  for select to authenticated using (
    exists (
      select 1 from public.guild_members m
       where m.guild_id = guilds.id and m.user_id = auth.uid()
    )
  );

create table if not exists public.guild_members (
  guild_id uuid not null references public.guilds (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create index if not exists guild_members_user_idx on public.guild_members (user_id);

alter table public.guild_members enable row level security;

drop policy if exists "guild_members: read own guild" on public.guild_members;
create policy "guild_members: read own guild" on public.guild_members
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.guild_members mine
       where mine.guild_id = guild_members.guild_id and mine.user_id = auth.uid()
    )
  );

create table if not exists public.guild_goals (
  guild_id uuid not null references public.guilds (id) on delete cascade,
  period_key text not null,
  goal_id text not null,
  progress bigint not null default 0,
  target bigint not null,
  primary key (guild_id, period_key, goal_id)
);

alter table public.guild_goals enable row level security;

drop policy if exists "guild_goals: read own guild" on public.guild_goals;
create policy "guild_goals: read own guild" on public.guild_goals
  for select to authenticated using (
    exists (
      select 1 from public.guild_members m
       where m.guild_id = guild_goals.guild_id and m.user_id = auth.uid()
    )
  );

-- --------------------------------------------------------------- audit log ---
-- Bounded on purpose: trimmed to the newest rows per user by the server.
create table if not exists public.audit_log (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_user_idx on public.audit_log (user_id, id desc);

alter table public.audit_log enable row level security;

drop policy if exists "audit: read own" on public.audit_log;
create policy "audit: read own" on public.audit_log
  for select to authenticated using (auth.uid() = user_id);
