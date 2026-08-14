"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonTone = "primary" | "ghost" | "coral" | "quiet" | "sun";

const TONES: Record<ButtonTone, string> = {
  primary:
    "bg-water text-white border-water-deep hover:brightness-110 active:translate-y-px disabled:bg-ink-soft",
  coral:
    "bg-coral text-white border-[color-mix(in_srgb,var(--coral),black_25%)] hover:brightness-110 active:translate-y-px",
  sun: "bg-sun text-ink border-[color-mix(in_srgb,var(--sun),black_22%)] hover:brightness-105 active:translate-y-px",
  ghost:
    "bg-card text-ink border-card-edge hover:bg-paper-2 active:translate-y-px",
  quiet: "bg-transparent text-ink-soft border-transparent hover:text-ink",
};

export function Button({
  tone = "primary",
  size = "md",
  full,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone;
  size?: "sm" | "md" | "lg";
  full?: boolean;
}) {
  const sizes = {
    sm: "text-xs px-2.5 py-1.5 rounded-lg gap-1",
    md: "text-sm px-3.5 py-2 rounded-xl gap-1.5",
    lg: "text-base px-5 py-3 rounded-2xl gap-2",
  }[size];

  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center border font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${TONES[tone]} ${sizes} ${full ? "w-full" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
  padded = true,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`cozy-card overflow-hidden ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 border-b border-card-edge bg-paper-2/60 px-3.5 py-2.5">
          <h2 className="text-sm font-bold tracking-tight">{title}</h2>
          {action}
        </header>
      )}
      <div className={padded ? "p-3.5" : ""}>{children}</div>
    </section>
  );
}

export function Bar({
  value,
  max,
  tone = "var(--water)",
  height = 8,
  label,
}: {
  value: number;
  max: number;
  tone?: string;
  height?: number;
  label?: ReactNode;
}) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 flex justify-between text-[11px] text-ink-soft">{label}</div>
      )}
      <div
        className="w-full overflow-hidden rounded-full bg-paper-2"
        style={{ height }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: tone }}
        />
      </div>
    </div>
  );
}

export function Chip({
  children,
  tone = "var(--card-edge)",
  className = "",
}: {
  children: ReactNode;
  tone?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${className}`}
      style={{ borderColor: tone, color: "var(--ink)" }}
    >
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden
      />
      <div className="animate-pop-in relative z-10 w-full max-w-md cozy-card p-4 shadow-[var(--shadow-soft)]">
        {title && <h2 className="mb-2 text-base font-extrabold">{title}</h2>}
        <div className="text-sm">{children}</div>
        {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-ink-soft">
      <span className="text-3xl" aria-hidden>
        {emoji}
      </span>
      <p className="max-w-[16rem]">{text}</p>
    </div>
  );
}
