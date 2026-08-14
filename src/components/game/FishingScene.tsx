"use client";

import { useEffect } from "react";
import {
  ITEM_BY_ID,
  RARITY_COLOR,
  RARITY_LABEL,
  SPECIES_BY_ID,
  ZONE_BY_ID,
} from "@/game/data";
import {
  getModifiers,
  nextBarHitMs,
  timeOfDay,
  weatherAt,
  TIME_LABEL,
  WEATHER_LABEL,
  WEATHER_LUCK,
} from "@/game/engine";
import type { Locale, WeatherId, ZoneId } from "@/game/types";
import { Button } from "@/components/ui/primitives";
import { TensionBar } from "./TensionBar";
import { FishAvatar, Stars } from "./FishCard";
import { formatNumber, pick, t } from "@/lib/i18n";
import { useGame } from "@/store/gameStore";
import { useNow } from "@/lib/hooks";

/** Read-only status pill over the scene; hovering explains what it changes. */
const CHIP =
  "cursor-help rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm";

export function FishingScene({ locale }: { locale: Locale }) {
  const state = useGame((s) => s.state);
  const phase = useGame((s) => s.phase);
  const cast = useGame((s) => s.cast);
  const barStartedAt = useGame((s) => s.barStartedAt);
  const lastResult = useGame((s) => s.lastResult);
  const autoFishing = useGame((s) => s.autoFishing);
  const doCast = useGame((s) => s.doCast);
  const doTap = useGame((s) => s.doTap);
  const setAutoFishing = useGame((s) => s.setAutoFishing);
  const now = useNow(1000);

  const zone = ZONE_BY_ID[state.zoneId];
  const tod = timeOfDay(now);
  const weather = weatherAt(now);
  const bait = state.equippedBaitId ? ITEM_BY_ID[state.equippedBaitId] : null;
  const baitCount = state.equippedBaitId ? state.items[state.equippedBaitId] ?? 0 : 0;
  const helperLevel = state.upgrades.helper ?? 0;
  const autoIntervalMs = getModifiers(state).activeAutoCatchIntervalMs;

  // Space bar: cast when idle, reel when hooked. The main desktop control.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.key !== " ") return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      event.preventDefault();
      if (phase === "hooked") void doTap();
      else if (phase === "idle") void doCast();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, doCast, doTap]);

  // The Deck Cat casts on a calm timer and reels at the next legal timing
  // window. Turning auto-fishing off leaves the current cast to the player.
  useEffect(() => {
    if (!autoFishing) return;
    if (helperLevel <= 0) {
      setAutoFishing(false);
      return;
    }

    if (phase === "idle") {
      const timer = window.setTimeout(() => void doCast(), autoIntervalMs);
      return () => window.clearTimeout(timer);
    }

    if (phase === "hooked" && cast) {
      const elapsed = Math.max(0, performance.now() - barStartedAt);
      const hitAt = nextBarHitMs(cast, elapsed + 80);
      const tapIn = hitAt === null ? Math.max(0, cast.timeoutMs - elapsed) : hitAt - elapsed;
      const timer = window.setTimeout(() => void doTap(), Math.max(0, tapIn));
      return () => window.clearTimeout(timer);
    }
  }, [
    autoFishing,
    autoIntervalMs,
    barStartedAt,
    cast,
    doCast,
    doTap,
    helperLevel,
    phase,
    setAutoFishing,
  ]);

  const isNight = tod === "night";
  const bobberX = phase === "idle" ? 26 : 62;

  return (
    <div className="relative overflow-hidden rounded-cozy border border-card-edge shadow-[var(--shadow-soft)]">
      {/* sky */}
      <div
        className="relative h-[46vh] min-h-[300px] w-full sm:h-[52vh] lg:h-[58vh]"
        style={{
          background: `linear-gradient(180deg, ${zone.palette.sky[0]}, ${zone.palette.sky[1]})`,
        }}
      >
        <CelestialBody isNight={isNight} />
        <WeatherLayer weather={weather} />

        {/* water */}
        <div
          className="absolute inset-x-0 bottom-0 h-[62%]"
          style={{
            background: `linear-gradient(180deg, ${zone.palette.water[0]}, ${zone.palette.water[1]})`,
          }}
        >
          <Waves />
        </div>

        {/* bobber */}
        <div className="absolute bottom-[38%] left-0 right-0 h-16">
          <span
            className="absolute bottom-0 text-4xl transition-all duration-500 ease-out"
            style={{ left: `${bobberX}%` }}
            aria-hidden
          >
            <span className={phase === "hooked" ? "animate-bob inline-block" : "inline-block"}>
              🎣
            </span>
          </span>
        </div>

        {/* zone + weather chips */}
        <div className="absolute inset-x-0 top-0 flex flex-wrap items-center gap-1.5 p-2.5">
          <span
            className={CHIP}
            title={`${t(locale, "fish.tipZone")} · ×${zone.valueMultiplier}`}
          >
            {zone.emoji} {pick(locale, zone.name)}
          </span>
          <span className={CHIP} title={t(locale, "fish.tipTime")}>
            {TIME_LABEL[tod].emoji} {pick(locale, TIME_LABEL[tod])}
          </span>
          <span
            className={CHIP}
            title={`${t(locale, "fish.tipWeather")} · ${t(locale, "fish.luck")} +${Math.round(
              WEATHER_LUCK[weather] * 100,
            )}%`}
          >
            {WEATHER_LABEL[weather].emoji} {pick(locale, WEATHER_LABEL[weather])}
          </span>
        </div>

        {/* control layer */}
        <div className="absolute inset-x-0 bottom-0 p-3 pb-4">
          {phase === "hooked" && cast ? (
            <TensionBar
              cast={cast}
              barStartedAt={barStartedAt}
              locale={locale}
              onTap={() => void doTap()}
            />
          ) : (
            <div className="flex flex-col items-center gap-2">
              {lastResult && phase === "reveal" ? (
                <ResultCard locale={locale} />
              ) : (
                <p className="text-center text-[11px] font-semibold text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                  {phase === "casting"
                    ? t(locale, "fish.casting")
                    : phase === "reeling"
                      ? t(locale, "fish.reeling")
                      : `${t(locale, "fish.hint")} · ${t(locale, "fish.spaceHint")}`}
                </p>
              )}
              <Button
                size="lg"
                tone="coral"
                onClick={() => void doCast()}
                disabled={phase !== "idle"}
                className="min-w-[62%] shadow-[var(--shadow-soft)]"
                title={t(locale, "fish.tipCast")}
              >
                <span aria-hidden>🎣</span>
                {phase === "idle" ? t(locale, "fish.cast") : t(locale, "fish.cooldown")}
              </Button>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span
                  className="cursor-help rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-semibold text-white"
                  title={
                    bait && baitCount > 0
                      ? t(locale, "fish.tipBait")
                      : t(locale, "fish.tipNoBait")
                  }
                >
                  {t(locale, "fish.bait")}:{" "}
                  {bait && baitCount > 0
                    ? `${bait.emoji} ${pick(locale, bait.name)} ×${formatNumber(baitCount, locale)}`
                    : t(locale, "fish.noBait")}
                </span>
                <button
                  type="button"
                  onClick={() => setAutoFishing(!autoFishing)}
                  disabled={helperLevel <= 0}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm transition ${
                    autoFishing
                      ? "border-sun bg-moss/90 shadow-[0_0_0_2px_rgba(255,255,255,0.22)]"
                      : "border-white/35 bg-black/25 hover:bg-black/35"
                  } disabled:cursor-not-allowed disabled:opacity-55`}
                  title={
                    helperLevel <= 0
                      ? t(locale, "fish.tipAutoLocked")
                      : `${t(locale, "fish.tipAuto")} ${Math.round(autoIntervalMs / 1000)}s`
                  }
                >
                  <span aria-hidden>{helperLevel > 0 ? "🐈" : "🔒"}</span>{" "}
                  {helperLevel <= 0
                    ? t(locale, "fish.autoLocked")
                    : autoFishing
                      ? t(locale, "fish.autoOn")
                      : t(locale, "fish.autoOff")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultCard({ locale }: { locale: Locale }) {
  const lastResult = useGame((s) => s.lastResult);
  if (!lastResult) return null;

  if (lastResult.outcome === "fish" && lastResult.fish) {
    const species = SPECIES_BY_ID[lastResult.fish.speciesId];
    return (
      <div className="animate-pop-in flex items-center gap-2.5 rounded-2xl border border-white/60 bg-card/95 px-3 py-2 shadow-[var(--shadow-soft)]">
        <FishAvatar fish={lastResult.fish} size={40} />
        <div className="text-left">
          <p className="flex items-center gap-1.5 text-sm font-extrabold">
            {pick(locale, species.name)}
            {lastResult.newSpecies && (
              <span className="rounded-full bg-coral px-1.5 py-0.5 text-[9px] font-bold text-white">
                {t(locale, "fish.newSpecies")}
              </span>
            )}
          </p>
          <p className="flex items-center gap-2 text-[11px] text-ink-soft">
            <span>
              {lastResult.fish.sizeCm} {t(locale, "common.cm")}
            </span>
            <Stars count={lastResult.fish.stars} />
            <span style={{ color: RARITY_COLOR[species.rarity] }}>
              {pick(locale, RARITY_LABEL[species.rarity])}
            </span>
          </p>
          {lastResult.perfect && (
            <p className="text-[11px] font-bold text-moss">{t(locale, "fish.perfect")}</p>
          )}
          {lastResult.bagFull && (
            <p className="text-[11px] font-bold text-coral">
              {t(locale, "fish.bagFullSold")} +{lastResult.autoSoldFor}🪙
            </p>
          )}
        </div>
      </div>
    );
  }

  if (lastResult.outcome === "junk" && lastResult.junkItemId) {
    const item = ITEM_BY_ID[lastResult.junkItemId];
    return (
      <div className="animate-pop-in rounded-2xl border border-white/60 bg-card/95 px-3 py-2 text-sm font-bold shadow-[var(--shadow-soft)]">
        {item.emoji} {pick(locale, item.name)}
      </div>
    );
  }

  return (
    <div className="animate-pop-in rounded-2xl border border-white/60 bg-card/95 px-3 py-2 text-sm font-bold text-ink-soft shadow-[var(--shadow-soft)]">
      {lastResult.outcome === "escape" ? t(locale, "fish.escaped") : t(locale, "fish.missed")}
    </div>
  );
}

function CelestialBody({ isNight }: { isNight: boolean }) {
  return (
    <span
      className="absolute right-6 top-5 text-4xl transition-opacity duration-1000"
      style={{ filter: isNight ? "none" : "drop-shadow(0 0 18px rgba(255,220,120,0.9))" }}
      aria-hidden
    >
      {isNight ? "🌙" : "☀️"}
    </span>
  );
}

function Waves() {
  return (
    <>
      {[0, 1].map((layer) => (
        <div
          key={layer}
          className={layer === 0 ? "animate-wave-slow absolute inset-x-0" : "animate-wave-fast absolute inset-x-0"}
          style={{
            top: layer === 0 ? 0 : 14,
            width: "200%",
            height: 26,
            opacity: layer === 0 ? 0.5 : 0.28,
          }}
          aria-hidden
        >
          <svg viewBox="0 0 1200 40" preserveAspectRatio="none" className="h-full w-full">
            <path
              d="M0 20 Q 75 0 150 20 T 300 20 T 450 20 T 600 20 T 750 20 T 900 20 T 1050 20 T 1200 20 V40 H0 Z"
              fill="rgba(255,255,255,0.65)"
            />
          </svg>
        </div>
      ))}
    </>
  );
}

function WeatherLayer({ weather }: { weather: WeatherId }) {
  if (weather === "rain" || weather === "storm") {
    const drops = weather === "storm" ? 26 : 14;
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {Array.from({ length: drops }).map((_, index) => (
          <span
            key={index}
            className="absolute block h-6 w-[2px] rounded-full bg-white/45"
            style={{
              left: `${(index * 97) % 100}%`,
              top: "-10%",
              animation: `float-up ${0.7 + (index % 4) * 0.15}s linear ${index * 0.11}s infinite reverse`,
            }}
          />
        ))}
      </div>
    );
  }
  if (weather === "fog") {
    return (
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(0deg, rgba(255,255,255,0.42), transparent 65%)" }}
        aria-hidden
      />
    );
  }
  if (weather === "moonlit") {
    return (
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 78% 12%, rgba(255,255,255,0.35), transparent 45%)",
        }}
        aria-hidden
      />
    );
  }
  return null;
}

export function ZoneStrip({ locale }: { locale: Locale }) {
  const state = useGame((s) => s.state);
  const run = useGame((s) => s.run);

  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
      {Object.values(ZONE_BY_ID).map((zone) => {
        const unlocked = state.unlockedZones.includes(zone.id);
        const active = state.zoneId === zone.id;
        const canUnlock =
          !unlocked &&
          state.level >= zone.unlock.level &&
          (state.upgrades.boat ?? 0) >= zone.unlock.boatLevel &&
          state.coins >= zone.unlock.coins;

        return (
          <button
            key={zone.id}
            type="button"
            onClick={() =>
              unlocked
                ? void run({ type: "travel", zoneId: zone.id as ZoneId })
                : canUnlock
                  ? void run({ type: "unlockZone", zoneId: zone.id as ZoneId })
                  : undefined
            }
            disabled={!unlocked && !canUnlock}
            className={`min-w-[8.5rem] shrink-0 rounded-2xl border px-3 py-2 text-left transition ${
              active
                ? "border-water bg-foam shadow-[0_0_0_2px_var(--water-light)]"
                : "border-card-edge bg-card hover:bg-paper-2"
            } disabled:opacity-55`}
          >
            <span className="flex items-center gap-1.5 text-[13px] font-bold">
              <span aria-hidden>{unlocked ? zone.emoji : "🔒"}</span>
              <span className="truncate">{pick(locale, zone.name)}</span>
            </span>
            <span className="block text-[11px] text-ink-soft">
              {unlocked ? (
                `×${zone.valueMultiplier} ${locale === "th" ? "ราคาปลา" : "value"}`
              ) : canUnlock ? (
                `${t(locale, "fish.unlock")} · ${formatNumber(zone.unlock.coins, locale)}🪙`
              ) : (
                `${t(locale, "fish.needLevel")} ${zone.unlock.level}${
                  zone.unlock.boatLevel > 0
                    ? ` · ${t(locale, "fish.needBoat")}${zone.unlock.boatLevel}`
                    : ""
                }`
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
