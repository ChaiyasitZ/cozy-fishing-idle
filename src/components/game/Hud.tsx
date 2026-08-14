"use client";

import { getModifiers, xpForLevel } from "@/game/engine";
import type { Locale } from "@/game/types";
import { Bar } from "@/components/ui/primitives";
import { formatNumber, t } from "@/lib/i18n";
import { useGame, type Tab } from "@/store/gameStore";

export function TopBar({ locale }: { locale: Locale }) {
  const state = useGame((s) => s.state);
  const syncing = useGame((s) => s.syncing);
  const mode = useGame((s) => s.mode);
  const connectionError = useGame((s) => s.connectionError);
  const mods = getModifiers(state);

  return (
    <header className="safe-t sticky top-0 z-30 border-b border-card-edge bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2">
        <span className="text-lg" aria-hidden>
          🐟
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[12px] font-extrabold">
            <span className="rounded-full bg-paper-2 px-2 py-0.5">
              {t(locale, "hud.level")} {state.level}
            </span>
            <span className="text-sun">🪙 {formatNumber(state.coins, locale)}</span>
            {state.pearls > 0 && <span className="text-plum">🫧 {formatNumber(state.pearls, locale)}</span>}
            <span className="text-ink-soft">
              🧺 {state.bag.length}/{mods.bagCapacity}
            </span>
            {state.skillPoints > 0 && (
              <span className="rounded-full bg-plum px-1.5 py-0.5 text-[10px] text-white">
                +{state.skillPoints}
              </span>
            )}
          </div>
          <div className="mt-1">
            <Bar value={state.xp} max={xpForLevel(state.level)} height={4} tone="var(--moss)" />
          </div>
        </div>
        <span
          className="shrink-0 text-[10px] font-bold"
          title={mode === "cloud" ? "cloud save" : "local save"}
        >
          {connectionError ? (
            <span className="text-coral">⚠️</span>
          ) : mode === "cloud" ? (
            <span className={syncing ? "animate-pulse text-water" : "text-moss"}>☁️</span>
          ) : (
            <span className="text-ink-soft">💾</span>
          )}
        </span>
      </div>
    </header>
  );
}

const TABS: { id: Tab; emoji: string; key: Parameters<typeof t>[1] }[] = [
  { id: "fish", emoji: "🎣", key: "nav.fish" },
  { id: "pond", emoji: "⛲", key: "nav.pond" },
  { id: "shop", emoji: "🛒", key: "nav.shop" },
  { id: "dex", emoji: "📖", key: "nav.dex" },
  { id: "friends", emoji: "🤝", key: "nav.friends" },
  { id: "more", emoji: "⚙️", key: "nav.more" },
];

export function BottomTabs({ locale }: { locale: Locale }) {
  const tab = useGame((s) => s.tab);
  const setTab = useGame((s) => s.setTab);

  return (
    <nav className="safe-b fixed inset-x-0 bottom-0 z-30 border-t border-card-edge bg-paper/95 backdrop-blur lg:hidden">
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map((entry) => (
          <li key={entry.id} className="flex-1">
            <button
              type="button"
              onClick={() => setTab(entry.id)}
              aria-current={tab === entry.id}
              className={`flex w-full flex-col items-center gap-0.5 py-2 text-[10px] font-bold transition ${
                tab === entry.id ? "text-water" : "text-ink-soft"
              }`}
            >
              <span className="text-lg leading-none" aria-hidden>
                {entry.emoji}
              </span>
              {t(locale, entry.key)}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function NavRail({ locale }: { locale: Locale }) {
  const tab = useGame((s) => s.tab);
  const setTab = useGame((s) => s.setTab);

  return (
    <nav className="hidden lg:block">
      <ul className="sticky top-20 flex flex-col gap-1.5">
        {TABS.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => setTab(entry.id)}
              aria-current={tab === entry.id}
              className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-[12px] font-bold transition ${
                tab === entry.id
                  ? "border-water bg-foam text-water"
                  : "border-transparent text-ink-soft hover:bg-card"
              }`}
            >
              <span className="text-base" aria-hidden>
                {entry.emoji}
              </span>
              {t(locale, entry.key)}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-40 flex flex-col items-center gap-1.5 px-3">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismiss(toast.id)}
          className={`animate-pop-in pointer-events-auto flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold shadow-[var(--shadow-soft)] ${
            toast.tone === "good"
              ? "border-moss bg-card text-moss"
              : toast.tone === "bad"
                ? "border-coral bg-card text-coral"
                : "border-card-edge bg-card"
          }`}
        >
          <span aria-hidden>{toast.emoji}</span>
          {toast.text}
        </button>
      ))}
    </div>
  );
}
