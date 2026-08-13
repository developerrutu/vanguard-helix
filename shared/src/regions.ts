export interface RegionDef {
  id: string;
  name: string;
  city: string;
  /** Extra milliseconds added to the probe so a single-box demo still selects geographically. */
  extraMs: number;
  tzHints: string[];
}

export const REGIONS: RegionDef[] = [
  { id: "india", name: "India", city: "Mumbai", extraMs: 4, tzHints: ["Asia/Calcutta", "Asia/Kolkata", "Asia/Colombo"] },
  { id: "singapore", name: "Singapore", city: "Singapore", extraMs: 28, tzHints: ["Asia/Singapore", "Asia/Jakarta", "Asia/Bangkok"] },
  { id: "japan", name: "Japan", city: "Tokyo", extraMs: 72, tzHints: ["Asia/Tokyo"] },
  { id: "korea", name: "South Korea", city: "Seoul", extraMs: 78, tzHints: ["Asia/Seoul"] },
  { id: "europe", name: "Europe", city: "Frankfurt", extraMs: 118, tzHints: ["Europe/"] },
  { id: "middleeast", name: "Middle East", city: "Bahrain", extraMs: 42, tzHints: ["Asia/Dubai", "Asia/Riyadh", "Asia/Qatar", "Asia/Bahrain"] },
  { id: "na", name: "North America", city: "Virginia", extraMs: 186, tzHints: ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/"] },
  { id: "sa", name: "South America", city: "São Paulo", extraMs: 228, tzHints: ["America/Sao_Paulo", "America/Argentina"] },
  { id: "oceania", name: "Oceania", city: "Sydney", extraMs: 94, tzHints: ["Australia/", "Pacific/Auckland"] },
];

export type PingBand = "green" | "yellow" | "orange" | "red";

export function pingBand(ms: number): PingBand {
  if (ms <= 50) return "green";
  if (ms <= 100) return "yellow";
  if (ms <= 150) return "orange";
  return "red";
}

export function pingColor(ms: number): string {
  const b = pingBand(ms);
  if (b === "green") return "#3dffc0";
  if (b === "yellow") return "#e8e05a";
  if (b === "orange") return "#ff9a3d";
  return "#ff4d6a";
}

export function guessRegion(timeZone: string): string {
  for (const r of REGIONS) {
    if (r.tzHints.some((h) => timeZone === h || timeZone.startsWith(h))) return r.id;
  }
  return "india";
}

export function regionById(id: string): RegionDef {
  return REGIONS.find((r) => r.id === id) ?? REGIONS[0];
}
