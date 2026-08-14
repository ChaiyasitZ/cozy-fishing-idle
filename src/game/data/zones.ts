import type { Zone, ZoneId } from "@/game/types";

export const ZONES: Zone[] = [
  {
    id: "pond",
    name: { th: "บ่อหลังบ้าน", en: "Backyard Pond" },
    blurb: {
      th: "บ่อเล็ก ๆ ที่คุณยายทิ้งไว้ให้ น้ำนิ่งและอบอุ่น",
      en: "The little pond grandma left you. Still, warm water.",
    },
    emoji: "🏡",
    palette: { sky: ["#ffe9c2", "#ffd7a1"], water: ["#79c7c0", "#177f8c"] },
    unlock: { level: 1, coins: 0, boatLevel: 0 },
    valueMultiplier: 1,
    sweepSeconds: 2.4,
    junkChance: 0.16,
  },
  {
    id: "river",
    name: { th: "ลำธารป่าไม้", en: "Forest Stream" },
    blurb: {
      th: "น้ำไหลเย็นผ่านรากไม้ ปลาที่นี่ว่ายแรงกว่า",
      en: "Cold water over old roots. The fish here pull harder.",
    },
    emoji: "🌿",
    palette: { sky: ["#d9f2c8", "#a8dda0"], water: ["#5fb8a8", "#116b62"] },
    unlock: { level: 4, coins: 400, boatLevel: 0 },
    valueMultiplier: 1.35,
    sweepSeconds: 2.15,
    junkChance: 0.14,
  },
  {
    id: "lake",
    name: { th: "ทะเลสาบหมอก", en: "Misty Lake" },
    blurb: {
      th: "หมอกลอยต่ำทั้งวัน เงาปลาใหญ่ผ่านไปเป็นระยะ",
      en: "Low mist all day, and big shadows drifting past.",
    },
    emoji: "🌫️",
    palette: { sky: ["#dfe7f0", "#b9c9dc"], water: ["#6f9fb5", "#1d4f66"] },
    unlock: { level: 9, coins: 2200, boatLevel: 1 },
    valueMultiplier: 1.8,
    sweepSeconds: 2,
    junkChance: 0.12,
  },
  {
    id: "sea",
    name: { th: "ทะเลเปิด", en: "Open Sea" },
    blurb: {
      th: "ลมเค็มและคลื่นยาว เหมาะกับเรือลำใหม่ของคุณ",
      en: "Salt wind and long swells. Your new boat likes it.",
    },
    emoji: "⛵",
    palette: { sky: ["#cfeaff", "#9ed2f5"], water: ["#3f9fd0", "#0d4f7c"] },
    unlock: { level: 15, coins: 9000, boatLevel: 2 },
    valueMultiplier: 2.5,
    sweepSeconds: 1.85,
    junkChance: 0.1,
  },
  {
    id: "deep",
    name: { th: "ทะเลลึกไร้แสง", en: "Lightless Deep" },
    blurb: {
      th: "ต้องมีตะเกียงดี ๆ ที่นี่ปลาไม่เคยเห็นแสงอาทิตย์",
      en: "Bring a good lantern. Nothing here has seen the sun.",
    },
    emoji: "🕯️",
    palette: { sky: ["#2b3d55", "#16233a"], water: ["#173d5c", "#04121f"] },
    unlock: { level: 24, coins: 32000, boatLevel: 3 },
    valueMultiplier: 3.6,
    sweepSeconds: 1.7,
    junkChance: 0.08,
  },
  {
    id: "reef",
    name: { th: "แนวปะการังแสงจันทร์", en: "Moonlit Reef" },
    blurb: {
      th: "ปะการังเรืองแสงตอบรับแสงจันทร์ ที่นี่มีปลาในตำนาน",
      en: "Coral that answers moonlight. Legends swim here.",
    },
    emoji: "🌙",
    palette: { sky: ["#3b2f63", "#241a45"], water: ["#4a6fb5", "#132a55"] },
    unlock: { level: 34, coins: 120000, boatLevel: 4 },
    valueMultiplier: 5,
    sweepSeconds: 1.55,
    junkChance: 0.06,
  },
];

export const ZONE_BY_ID: Record<ZoneId, Zone> = Object.fromEntries(
  ZONES.map((z) => [z.id, z]),
) as Record<ZoneId, Zone>;

export const ZONE_ORDER: ZoneId[] = ZONES.map((z) => z.id);
