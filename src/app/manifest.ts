import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cozy Fishing Idle",
    short_name: "Cozy Fishing",
    description: "ตกปลาชิล ๆ เลี้ยงปลา ขายปลา อัพเกรด และเล่นกับเพื่อน",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fdf4e3",
    theme_color: "#1d8b9c",
    lang: "th",
    categories: ["games", "casual"],
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
