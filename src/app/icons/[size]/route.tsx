import { ImageResponse } from "next/og";

/**
 * Maskable PNG icons for the PWA install prompt, rendered from the same shapes
 * as the SVG icon so the app ships no binary assets.
 */
const SIZES: Record<string, number> = {
  "icon-192.png": 192,
  "icon-512.png": 512,
};

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: key } = await params;
  const size = SIZES[key];
  if (!size) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(180deg, #ffe9c2, #ffd7a1)",
        }}
      >
        <svg width={size} height={size} viewBox="0 0 512 512">
          <path d="M0 300 Q 64 268 128 300 T 256 300 T 384 300 T 512 300 V512 H0 Z" fill="#177f8c" />
          <circle cx="384" cy="128" r="44" fill="#f4c453" />
          <ellipse cx="150" cy="360" rx="92" ry="56" fill="#ef8264" />
          <path d="M228 360 L300 314 L300 406 Z" fill="#ef8264" />
          <circle cx="106" cy="346" r="12" fill="#fffaf0" />
          <path d="M300 96 L204 336" stroke="#8b5e3c" strokeWidth="16" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
