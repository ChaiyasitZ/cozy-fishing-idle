"use client";

import { useState } from "react";
import {
  BAITS,
  FOODS,
  ITEM_BY_ID,
  SKILLS,
  UPGRADES,
  upgradeCost,
  ZONE_BY_ID,
} from "@/game/data";
import { dailyMerchant, itemPrice } from "@/game/engine";
import type { Locale } from "@/game/types";
import { Button, Panel } from "@/components/ui/primitives";
import { formatNumber, pick, t } from "@/lib/i18n";
import { useNow } from "@/lib/hooks";
import { useGame } from "@/store/gameStore";

type ShopTab = "bait" | "food" | "gear" | "skills";

export function ShopPanel({ locale }: { locale: Locale }) {
  const state = useGame((s) => s.state);
  const run = useGame((s) => s.run);
  const now = useNow(60_000);
  const [tab, setTab] = useState<ShopTab>("bait");

  const merchant = dailyMerchant(now);
  const discountItem = ITEM_BY_ID[merchant.discountBaitId];
  const bonusZone = ZONE_BY_ID[merchant.bonusZoneId];
  const materialValue = Object.entries(state.items).reduce((sum, [id, qty]) => {
    const item = ITEM_BY_ID[id];
    return item?.kind === "material" ? sum + item.sell * qty : sum;
  }, 0);

  const tabs: { id: ShopTab; label: string; emoji: string }[] = [
    { id: "bait", label: t(locale, "shop.baits"), emoji: "🪱" },
    { id: "food", label: t(locale, "shop.foods"), emoji: "🥣" },
    { id: "gear", label: t(locale, "shop.upgrades"), emoji: "🎣" },
    { id: "skills", label: t(locale, "shop.skills"), emoji: "🍀" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <Panel title={`🦦 ${t(locale, "shop.merchant")}`}>
        <p className="text-[12px]">
          <span className="font-bold text-coral">{t(locale, "shop.merchantDeal")}:</span>{" "}
          {discountItem.emoji} {pick(locale, discountItem.name)} −
          {Math.round(merchant.discount * 100)}%
        </p>
        <p className="text-[12px]">
          <span className="font-bold text-moss">{t(locale, "shop.merchantBonus")}:</span>{" "}
          {bonusZone.emoji} {pick(locale, bonusZone.name)} ×
          {merchant.bonusMultiplier.toFixed(2)}
        </p>
        {materialValue > 0 && (
          <Button
            size="sm"
            tone="sun"
            className="mt-2"
            onClick={() => void run({ type: "sellMaterials" })}
          >
            {t(locale, "shop.salvage")} · {formatNumber(materialValue, locale)}🪙
          </Button>
        )}
      </Panel>

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-bold transition ${
              tab === entry.id
                ? "border-water bg-water text-white"
                : "border-card-edge bg-card hover:bg-paper-2"
            }`}
          >
            <span aria-hidden>{entry.emoji}</span> {entry.label}
          </button>
        ))}
      </div>

      {tab === "bait" && (
        <Panel title={t(locale, "shop.baits")}>
          <div className="flex flex-col gap-1.5">
            {BAITS.map((bait) => {
              const price = itemPrice(bait.id, now) ?? 0;
              const owned = state.items[bait.id] ?? 0;
              const equipped = state.equippedBaitId === bait.id;
              const discounted = price < (bait.buy ?? 0);
              return (
                <div
                  key={bait.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-card-edge bg-card px-2.5 py-2"
                >
                  <span className="text-xl" aria-hidden>
                    {bait.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">{pick(locale, bait.name)}</p>
                    <p className="text-[11px] text-ink-soft">
                      {t(locale, "shop.owned")} {owned} ·{" "}
                      {locale === "th" ? "โชค" : "luck"} +
                      {Math.round((bait.bait?.luck ?? 0) * 100)}% ·{" "}
                      {locale === "th" ? "ขนาด" : "size"} +
                      {Math.round((bait.bait?.sizeBonus ?? 0) * 100)}%
                    </p>
                  </div>
                  <span
                    className={`text-[12px] font-extrabold ${discounted ? "text-coral" : ""}`}
                  >
                    {formatNumber(price, locale)}🪙
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() => void run({ type: "buyItem", itemId: bait.id, qty: 10 })}
                      disabled={state.coins < price * 10}
                    >
                      ×10
                    </Button>
                    <Button
                      size="sm"
                      tone={equipped ? "ghost" : "sun"}
                      disabled={equipped || owned <= 0}
                      onClick={() => void run({ type: "equipBait", itemId: bait.id })}
                    >
                      {equipped ? t(locale, "shop.equipped") : t(locale, "shop.equip")}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {tab === "food" && (
        <Panel title={t(locale, "shop.foods")}>
          <div className="flex flex-col gap-1.5">
            {FOODS.map((food) => {
              const price = itemPrice(food.id, now) ?? 0;
              return (
                <div
                  key={food.id}
                  className="flex items-center gap-2 rounded-xl border border-card-edge bg-card px-2.5 py-2"
                >
                  <span className="text-xl" aria-hidden>
                    {food.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">{pick(locale, food.name)}</p>
                    <p className="text-[11px] text-ink-soft">
                      {t(locale, "shop.owned")} {state.items[food.id] ?? 0} ·{" "}
                      {t(locale, "pond.freshness")} +
                      {Math.round((food.food?.freshness ?? 0) * 100)}% ·{" "}
                      {(food.food?.growthMultiplier ?? 1) > 1
                        ? `${t(locale, "pond.growth")} ×${food.food?.growthMultiplier}`
                        : t(locale, "pond.growthNone")}
                    </p>
                  </div>
                  <span className="text-[12px] font-extrabold">
                    {formatNumber(price, locale)}🪙
                  </span>
                  <Button
                    size="sm"
                    onClick={() => void run({ type: "buyItem", itemId: food.id, qty: 3 })}
                    disabled={state.coins < price * 3}
                  >
                    ×3
                  </Button>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {tab === "gear" && (
        <Panel title={t(locale, "shop.upgrades")}>
          <div className="flex flex-col gap-1.5">
            {UPGRADES.map((upgrade) => {
              const level = state.upgrades[upgrade.id] ?? 0;
              const maxed = level >= upgrade.maxLevel;
              const cost = upgradeCost(upgrade.id, level);
              return (
                <div
                  key={upgrade.id}
                  className="flex items-center gap-2 rounded-xl border border-card-edge bg-card px-2.5 py-2"
                >
                  <span className="text-xl" aria-hidden>
                    {upgrade.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">
                      {pick(locale, upgrade.name)}{" "}
                      <span className="text-ink-soft">
                        {t(locale, "shop.level")}
                        {level}/{upgrade.maxLevel}
                      </span>
                    </p>
                    <p className="text-[11px] text-ink-soft">{pick(locale, upgrade.effect)}</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={maxed || state.coins < cost}
                    onClick={() => void run({ type: "buyUpgrade", id: upgrade.id })}
                  >
                    {maxed ? t(locale, "shop.maxed") : `${formatNumber(cost, locale)}🪙`}
                  </Button>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {tab === "skills" && (
        <Panel
          title={t(locale, "shop.skills")}
          action={
            <span className="text-[11px] font-bold text-plum">
              {t(locale, "hud.skillPoints")}: {state.skillPoints}
            </span>
          }
        >
          <div className="flex flex-col gap-1.5">
            {SKILLS.map((skill) => {
              const level = state.skills[skill.id] ?? 0;
              const maxed = level >= skill.maxLevel;
              return (
                <div
                  key={skill.id}
                  className="flex items-center gap-2 rounded-xl border border-card-edge bg-card px-2.5 py-2"
                >
                  <span className="text-xl" aria-hidden>
                    {skill.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">
                      {pick(locale, skill.name)}{" "}
                      <span className="text-ink-soft">
                        {level}/{skill.maxLevel}
                      </span>
                    </p>
                    <p className="text-[11px] text-ink-soft">{pick(locale, skill.blurb)}</p>
                  </div>
                  <Button
                    size="sm"
                    tone="ghost"
                    disabled={maxed || state.skillPoints <= 0}
                    onClick={() => void run({ type: "learnSkill", id: skill.id })}
                  >
                    {maxed ? t(locale, "shop.maxed") : "+1"}
                  </Button>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}
