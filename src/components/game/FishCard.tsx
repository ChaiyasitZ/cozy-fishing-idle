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

function PortraitFrame({
  size,
  mutationRing,
  children,
  rounded = "full",
  /** Landscape frame matching cropped fish icons (~3:2). */
  wide = false,
}: {
  size: number;
  mutationRing?: string;
  children: React.ReactNode;
  rounded?: "full" | "xl";
  wide?: boolean;
}) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden ${
        rounded === "xl" ? "rounded-xl" : "rounded-full"
      }`}
      style={{
        width: wide ? Math.round(size * 1.45) : size,
        height: size,
        background:
          "linear-gradient(160deg, color-mix(in srgb, var(--water-light), white 55%), var(--foam))",
        boxShadow: mutationRing
          ? `0 0 0 2px ${mutationRing}, inset 0 -6px 12px rgba(29,139,156,0.12)`
          : "inset 0 -6px 12px rgba(29,139,156,0.1)",
      }}
    >
      {children}
    </span>
  );
}

export function FishAvatar({
  fish,
  size = 44,
}: {
  fish: FishInstance;
  size?: number;
}) {
  const species = SPECIES_BY_ID[fish.speciesId];
  const mutation = fish.mutation ? MUTATION_INFO[fish.mutation] : null;
  const hasImage = Boolean(species?.image);

  return (
    <PortraitFrame
      size={size}
      mutationRing={mutation?.ring}
      rounded={hasImage ? "xl" : "full"}
      wide={hasImage}
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- small static public assets
        <img
          src={species!.image}
          alt=""
          width={Math.round(size * 1.45)}
          height={size}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <span style={{ fontSize: size * 0.52 }} aria-hidden>
          {species?.emoji ?? "🐟"}
        </span>
      )}
      {mutation && (
        <span
          className="animate-sheen pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at 30% 25%, ${mutation.ring}, transparent 65%)`,
            borderRadius: "inherit",
          }}
          aria-hidden
        />
      )}
    </PortraitFrame>
  );
}

/** Species portrait for Fishdex / lists that only have a species id. */
export function SpeciesAvatar({
  speciesId,
  size = 44,
  locked = false,
}: {
  speciesId: string;
  size?: number;
  locked?: boolean;
}) {
  const species = SPECIES_BY_ID[speciesId];
  if (locked || !species) {
    return (
      <PortraitFrame size={size} rounded="xl" wide>
        <span style={{ fontSize: size * 0.4 }} aria-hidden>
          ❔
        </span>
      </PortraitFrame>
    );
  }
  if (species.image) {
    return (
      <PortraitFrame size={size} rounded="xl" wide>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={species.image}
          alt=""
          width={Math.round(size * 1.45)}
          height={size}
          className="h-full w-full object-cover"
          draggable={false}
        />
      </PortraitFrame>
    );
  }
  return (
    <PortraitFrame size={size} rounded="full">
      <span style={{ fontSize: size * 0.52 }} aria-hidden>
        {species.emoji}
      </span>
    </PortraitFrame>
  );
}

/** Full-bleed Fishdex card portrait — cropped fish art fills the box. */
export function SpeciesCardPortrait({
  speciesId,
  locked = false,
}: {
  speciesId: string;
  locked?: boolean;
}) {
  const species = SPECIES_BY_ID[speciesId];
  return (
    <div
      className="relative aspect-[3/2] w-full overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--water-light), white 28%), color-mix(in srgb, var(--water), black 22%))",
      }}
    >
      {locked || !species ? (
        <span
          className="absolute inset-0 flex items-center justify-center text-2xl opacity-70"
          aria-hidden
        >
          ❔
        </span>
      ) : species.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={species.image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <span
          className="absolute inset-0 flex items-center justify-center text-3xl"
          aria-hidden
        >
          {species.emoji}
        </span>
      )}
    </div>
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
