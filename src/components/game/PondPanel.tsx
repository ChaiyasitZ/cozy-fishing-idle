"use client";

import { FOODS, ITEM_BY_ID, SPECIES_BY_ID } from "@/game/data";
import {
  currentFreshness,
  fishYield,
  growthProgress,
  isMature,
  pendingHarvest,
  BREED_COOLDOWN_MS,
  getModifiers,
} from "@/game/engine";
import type { Locale, PondFish } from "@/game/types";
import { Bar, Button, EmptyState, Panel } from "@/components/ui/primitives";
import { FishCard, SpeciesIcon } from "./FishCard";
import { formatNumber, pick, t } from "@/lib/i18n";
import { useNow } from "@/lib/hooks";
import { useGame } from "@/store/gameStore";

function remaining(ms: number, locale: Locale): string {
  const mins = Math.max(0, Math.ceil(ms / 60000));
  if (mins < 60) return locale === "th" ? `อีก ${mins} นาที` : `${mins}m left`;
  const hours = Math.floor(mins / 60);
  return locale === "th" ? `อีก ${hours} ชม. ${mins % 60} นาที` : `${hours}h ${mins % 60}m left`;
}

export function PondPanel({ locale }: { locale: Locale }) {
  const state = useGame((s) => s.state);
  const run = useGame((s) => s.run);
  const breedSelection = useGame((s) => s.breedSelection);
  const toggleBreedSelect = useGame((s) => s.toggleBreedSelect);
  const now = useNow(1000);

  const mods = getModifiers(state);
  const freshness = currentFreshness(state, now);
  const waiting = pendingHarvest(state, now);
  const perHour = state.pond.fish.reduce((sum, fish) => sum + fishYield(state, fish, now), 0);
  const availableFood = FOODS.filter((food) => (state.items[food.id] ?? 0) > 0);
  const canBreed = breedSelection.length === 2;

  return (
    <div className="flex flex-col gap-3">
      <Panel
        title={`${t(locale, "pond.title")} · ${state.pond.fish.length}/${mods.pondSlots}`}
        action={
          <span className="text-[11px] font-bold text-moss">
            {formatNumber(perHour, locale)}🪙/{locale === "th" ? "ชม." : "h"}
          </span>
        }
      >
        <div className="mb-3">
          <Bar
            value={freshness * 100}
            max={100}
            tone={freshness > 0.5 ? "var(--water)" : freshness > 0.2 ? "var(--sun)" : "var(--coral)"}
            label={
              <>
                <span>{t(locale, "pond.freshness")}</span>
                <span>{Math.round(freshness * 100)}%</span>
              </>
            }
          />
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          <Button
            size="sm"
            tone="sun"
            disabled={waiting.coins <= 0 && waiting.pearls <= 0}
            onClick={() => void run({ type: "collectPond" })}
          >
            {t(locale, "pond.collect")}
            {waiting.coins > 0 && ` · ${formatNumber(waiting.coins, locale)}🪙`}
            {waiting.pearls > 0 && ` ${waiting.pearls}🫧`}
          </Button>
          {availableFood.length === 0 ? (
            <span className="self-center text-[11px] text-ink-soft">
              {locale === "th" ? "ไม่มีอาหารปลา — ซื้อได้ที่ร้านค้า" : "No food — buy some in the shop"}
            </span>
          ) : (
            availableFood.map((food) => {
              // Plain pellets only clean the water, so the growth boost has to
              // be visible here or feeding looks like it did nothing.
              const boost = food.food?.growthMultiplier ?? 1;
              return (
                <Button
                  key={food.id}
                  size="sm"
                  tone="ghost"
                  title={`${t(locale, "pond.freshness")} +${Math.round(
                    (food.food?.freshness ?? 0) * 100,
                  )}% · ${
                    boost > 1
                      ? `${t(locale, "pond.growth")} ×${boost}`
                      : t(locale, "pond.growthNone")
                  }`}
                  onClick={() => void run({ type: "feedPond", foodId: food.id })}
                >
                  {food.emoji} {t(locale, "pond.feed")} ×{state.items[food.id]}
                  {boost > 1 && (
                    <span className="ml-1 text-[10px] font-bold text-moss">⚡{boost}×</span>
                  )}
                </Button>
              );
            })
          )}
        </div>

        {state.pond.fish.length === 0 ? (
          <EmptyState emoji="⛲" text={t(locale, "pond.empty")} />
        ) : (
          <div className="no-scrollbar flex max-h-[44vh] flex-col gap-1.5 overflow-y-auto">
            {state.pond.fish.map((fish) => (
              <PondFishRow
                key={fish.id}
                fish={fish}
                locale={locale}
                now={now}
                selected={breedSelection.includes(fish.id)}
                onSelect={() => toggleBreedSelect(fish.id)}
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel title={t(locale, "pond.breed")}>
        <p className="mb-2 text-[11px] text-ink-soft">{t(locale, "pond.breedHint")}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {breedSelection.map((id) => {
            const fish = state.pond.fish.find((f) => f.id === id);
            const species = fish ? SPECIES_BY_ID[fish.speciesId] : null;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full border border-water bg-foam px-2 py-0.5 text-[11px] font-bold"
              >
                {fish && <SpeciesIcon speciesId={fish.speciesId} size={14} />}
                {species ? pick(locale, species.name) : id}
              </span>
            );
          })}
          <Button
            size="sm"
            tone="primary"
            disabled={!canBreed}
            onClick={() =>
              void run({
                type: "breed",
                aId: breedSelection[0],
                bId: breedSelection[1],
              })
            }
          >
            🧬 {t(locale, "pond.breed")}
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function PondFishRow({
  fish,
  locale,
  now,
  selected,
  onSelect,
}: {
  fish: PondFish;
  locale: Locale;
  now: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const state = useGame((s) => s.state);
  const run = useGame((s) => s.run);
  const mature = isMature(fish, now);
  const progress = growthProgress(fish, now);
  const resting = now - (fish.lastBredAt ?? 0) < BREED_COOLDOWN_MS;

  return (
    <div className="rounded-xl border border-card-edge bg-card p-2">
      <FishCard
        fish={fish}
        locale={locale}
        selected={selected}
        onClick={onSelect}
        subtitle={
          mature ? (
            <span className="text-moss">
              {t(locale, "pond.mature")} · {formatNumber(fishYield(state, fish, now), locale)}🪙/
              {locale === "th" ? "ชม." : "h"}
              {resting && ` · ${t(locale, "pond.cooldown")}`}
            </span>
          ) : (
            <span>
              {t(locale, "pond.growing")} {Math.round(progress * 100)}% ·{" "}
              {remaining(fish.maturesAt - now, locale)}
            </span>
          )
        }
      />
      {!mature && (
        <div className="mt-1.5">
          <Bar value={progress * 100} max={100} height={5} tone="var(--moss)" />
        </div>
      )}
      <div className="mt-1.5 flex gap-1.5">
        <Button size="sm" tone="quiet" onClick={() => void run({ type: "pondToBag", fishId: fish.id })}>
          {t(locale, "pond.toBag")}
        </Button>
        <Button size="sm" tone="quiet" onClick={() => void run({ type: "sellPondFish", fishId: fish.id })}>
          {t(locale, "pond.sell")}
        </Button>
      </div>
    </div>
  );
}

export function pondFoodName(id: string, locale: Locale): string {
  const item = ITEM_BY_ID[id];
  return item ? pick(locale, item.name) : id;
}
