# Cozy Fishing Idle 🎣

เกมตกปลาแบบ cozy idle เล่นบนเว็บ ได้ทั้งมือถือและ PC — ตกปลา เลี้ยงปลาในบ่อ ผสมพันธุ์ ขาย อัพเกรดอุปกรณ์และสกิล
เล่นคนเดียวหรือเล่นกับเพื่อนแบบ async ก็ได้

A cozy fishing idle game for phones and desktops: cast, raise fish in your pond, breed
them, sell them, upgrade your gear, and play solo or asynchronously with friends.

## Stack

| Layer      | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router) + React 19 + TypeScript               |
| Styling    | Tailwind CSS v4, CSS/SVG animation, emoji art (no image asset) |
| State      | Zustand on the client, pure engine shared with the server     |
| Backend    | Supabase — Auth, Postgres with RLS                            |
| Hosting    | Vercel (Node.js functions, region `sin1`)                     |
| Tests      | Vitest over the pure game engine                              |

## How it works

The whole game is one pure function. Every change to a save goes through
`applyCommand(state, command, now)` in `src/game/engine/commands.ts`:

- **Guest play** runs `applyCommand` in the browser and saves to `localStorage`.
- **Signed in** runs the exact same function inside a Server Action, against the
  save stored in Postgres, then returns the new state.

Because the engine is deterministic (seeded RNG in the save, no `Math.random`, no
`Date.now` inside the logic), the server can re-derive anything the client claims:

- Idle progress is computed from `lastTickAt` on the next load, so there is no cron job.
- The fishing minigame pre-rolls the catch and hides it, and the server verifies the
  tap the player claims to have made against the bar position it recomputes itself.
- Daily and weekly content is derived from a period key, not scheduled.

```
src/game/data/*        content: species, zones, items, upgrades, skills, quests
src/game/engine/*      pure logic: rng, catch, economy, pond, idle, prestige, commands
src/components/game/*  UI: fishing scene, tension bar, pond, shop, fishdex, friends
src/app/actions/*      Server Actions (the only writers)
src/lib/supabase/*     browser / server / admin clients
supabase/migrations/*  schema + RLS
```

## Running locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Without any environment variables the game is fully
playable as a guest, with the save in `localStorage`.

## Enabling cloud saves and social features

1. Create a Supabase project in **Southeast Asia (Singapore)** (same region as the
   Vercel functions, so a round trip stays fast).
2. Copy `.env.example` to `.env.local` and fill in the URL, publishable key and
   secret key. The secret key is server-only — never prefix it with `NEXT_PUBLIC_`.
3. Push the schema:

   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```

4. In Supabase Auth settings, add the redirect URLs:
   `http://localhost:3000/**`, your production domain, and the preview wildcard
   `https://cozy-fishing-idle-*.vercel.app/**`.
5. Enable the Google and Discord providers if you want social login. Email OTP and
   anonymous sign-in work out of the box.

## Deploying

```bash
vercel link
vercel env pull .env.local
vercel deploy            # preview
vercel promote <url>     # production, no rebuild
```

`vercel.ts` sets the `sin1` region, cache headers, and a daily cron that pings
`/api/health` — which keeps a free Supabase project from pausing after a quiet week.

Preview and production share one database, so migrations are applied **before** the
code that needs them (`supabase db push`, then deploy) and are written additively.

## Testing

```bash
npm test        # engine: rng, casting, economy, pond, idle, saves, anti-cheat
npm run lint
npm run build
```

## Balance and content

All content lives in `src/game/data` as plain TypeScript with a `CONTENT_VERSION`.
Tune a species price or an upgrade curve there; saves migrate through
`migrateState`, so rebalancing never wipes a player's progress.
