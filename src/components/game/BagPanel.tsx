"use client";

import { fishValue, getModifiers } from "@/game/engine";
import type { Locale } from "@/game/types";
import { Button, EmptyState, Panel } from "@/components/ui/primitives";
import { FishCard } from "./FishCard";
import { formatNumber, t } from "@/lib/i18n";
import { useGame } from "@/store/gameStore";

export function BagPanel({ locale }: { locale: Locale }) {
  const state = useGame((s) => s.state);
  const selection = useGame((s) => s.selection);
  const toggleSelect = useGame((s) => s.toggleSelect);
  const selectAll = useGame((s) => s.selectAll);
  const clearSelection = useGame((s) => s.clearSelection);
  const run = useGame((s) => s.run);

  const mods = getModifiers(state);
  const selected = state.bag.filter((f) => selection.includes(f.id));
  const selectedValue = selected.reduce((sum, fish) => sum + fishValue(state, fish), 0);
  const totalValue = state.bag.reduce((sum, fish) => sum + fishValue(state, fish), 0);

  return (
    <Panel
      title={`${t(locale, "bag.title")} · ${state.bag.length}/${mods.bagCapacity}`}
      action={
        <span className="text-[11px] font-bold text-moss">
          {t(locale, "bag.value")} {formatNumber(totalValue, locale)}🪙
        </span>
      }
    >
      {state.bag.length === 0 ? (
        <EmptyState emoji="🧺" text={t(locale, "bag.empty")} />
      ) : (
        <>
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            <Button size="sm" tone="ghost" onClick={selectAll}>
              {t(locale, "bag.selectAll")}
            </Button>
            {selection.length > 0 && (
              <Button size="sm" tone="quiet" onClick={clearSelection}>
                {t(locale, "bag.clear")}
              </Button>
            )}
          </div>

          <div className="no-scrollbar flex max-h-[46vh] flex-col gap-1.5 overflow-y-auto lg:max-h-[52vh]">
            {state.bag.map((fish) => (
              <FishCard
                key={fish.id}
                fish={fish}
                locale={locale}
                value={fishValue(state, fish)}
                selected={selection.includes(fish.id)}
                onClick={() => toggleSelect(fish.id)}
              />
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button
              size="sm"
              tone="sun"
              disabled={selection.length === 0}
              onClick={() => {
                void run({ type: "sellFish", ids: selection });
                clearSelection();
              }}
            >
              {t(locale, "bag.sellSelected")}
              {selection.length > 0 && ` · ${formatNumber(selectedValue, locale)}🪙`}
            </Button>
            <Button
              size="sm"
              tone="primary"
              disabled={selection.length === 0}
              onClick={() => {
                void run({ type: "stockFish", ids: selection });
                clearSelection();
              }}
            >
              {t(locale, "bag.stockSelected")}
            </Button>
            <Button
              size="sm"
              tone="ghost"
              onClick={() => {
                void run({ type: "sellFish", ids: state.bag.map((f) => f.id) });
                clearSelection();
              }}
            >
              {t(locale, "bag.sellAll")}
            </Button>
          </div>
        </>
      )}
    </Panel>
  );
}
