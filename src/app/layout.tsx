import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai, Quicksand } from "next/font/google";
import "./globals.css";

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  display: "swap",
});

// Thai glyphs fall through to this face automatically, so both scripts look right.
const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cozy Fishing Idle — ตกปลาชิล ๆ",
  description:
    "เกมตกปลาแบบ idle เล่นได้ทั้งมือถือและ PC: ตกปลา เลี้ยงปลา ผสมพันธุ์ ขายปลา อัพเกรดอุปกรณ์ และเล่นกับเพื่อน",
  applicationName: "Cozy Fishing Idle",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Cozy Fishing" },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
  openGraph: {
    title: "Cozy Fishing Idle",
    description: "ตกปลา เลี้ยงปลา ขายปลา อัพเกรด แล้วชวนเพื่อนมาแข่งกัน",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf4e3" },
    { media: "(prefers-color-scheme: dark)", color: "#10222b" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // The game is a single fixed screen; letting it zoom on double-tap fights the UI.
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${quicksand.variable} ${notoThai.variable} h-full`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
