"use client";

import { MUTATION_INFO, RARITY_COLOR, RARITY_LABEL, SPECIES_BY_ID } from "@/game/data";
import type { FishInstance, Locale } from "@/game/types";
import { formatNumber, pick, t } from "@/lib/i18n";

export function Stars({ count }: { count: number }) {
  return (
    <span className="text-[10px] tracking-tight text-sun" aria-label={`${count} stars`}>
      {"★".repeat(count)}
      <span className="text-card-edge">{"★".repeat(Math.max(0, 5 - count))}</span>
    </span>
  );
}

export function FishAvatar({
  fish,
  size = 34,
}: {
  fish: FishInstance;
  size?: number;
}) {
  const species = SPECIES_BY_ID[fish.speciesId];
  const mutation = fish.mutation ? MUTATION_INFO[fish.mutation] : null;
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: "var(--foam)",
        boxShadow: mutation ? `0 0 0 2px ${mutation.ring}` : undefined,
      }}
    >
      <span style={{ fontSize: size * 0.56 }} aria-hidden>
        {species?.emoji ?? "🐟"}
      </span>
      {mutation && (
        <span
          className="animate-sheen absolute inset-0 rounded-full"
          style={{ background: `radial-gradient(circle at 30% 25%, ${mutation.ring}, transparent 65%)` }}
          aria-hidden
        />
      )}
    </span>
  );
}

export function FishCard({
  fish,
  locale,
  value,
  selected,
  onClick,
  right,
  subtitle,
  disabled,
}: {
  fish: FishInstance;
  locale: Locale;
  value?: number;
  selected?: boolean;
  onClick?: () => void;
  right?: React.ReactNode;
  subtitle?: React.ReactNode;
  disabled?: boolean;
}) {
  const species = SPECIES_BY_ID[fish.speciesId];
  if (!species) return null;
  const mutation = fish.mutation ? MUTATION_INFO[fish.mutation] : null;

  const body = (
    <>
      <FishAvatar fish={fish} />
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-bold">{pick(locale, species.name)}</span>
          {mutation && (
            <span className="shrink-0 text-[10px] font-bold" style={{ color: mutation.ring }}>
              {pick(locale, mutation.name)}
            </span>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-soft">
          <span>
            {fish.sizeCm} {t(locale, "common.cm")}
          </span>
          <Stars count={fish.stars} />
          <span style={{ color: RARITY_COLOR[species.rarity] }}>
            {pick(locale, RARITY_LABEL[species.rarity])}
          </span>
        </span>
        {subtitle && <span className="block text-[11px] text-ink-soft">{subtitle}</span>}
      </span>
      {right ??
        (value !== undefined && (
          <span className="shrink-0 text-[13px] font-extrabold text-moss">
            {formatNumber(value, locale)}
            <span className="ml-0.5 text-[10px]">🪙</span>
          </span>
        ))}
    </>
  );

  if (!onClick) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-card-edge bg-card px-2.5 py-2">
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition disabled:opacity-50 ${
        selected
          ? "border-water bg-foam shadow-[0_0_0_2px_var(--water-light)]"
          : "border-card-edge bg-card hover:bg-paper-2"
      }`}
    >
      {body}
    </button>
  );
}
