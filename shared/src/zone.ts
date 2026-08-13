export interface ZonePhaseDef {
  id: number;
  name: string;
  wait: number;
  shrink: number;
  radius: number;
  dps: number;
}

/** ~12 minutes of pressure. Early team-wipes still end the match. */
export const ZONE_PHASES: ZonePhaseDef[] = [
  { id: 0, name: "LOOT", wait: 70, shrink: 0, radius: 92, dps: 0 },
  { id: 1, name: "LARGE ZONE", wait: 48, shrink: 34, radius: 58, dps: 2 },
  { id: 2, name: "REDUCED ZONE", wait: 42, shrink: 30, radius: 40, dps: 4 },
  { id: 3, name: "MEDIUM ZONE", wait: 38, shrink: 26, radius: 26, dps: 7 },
  { id: 4, name: "SMALL ZONE", wait: 30, shrink: 22, radius: 15, dps: 11 },
  { id: 5, name: "CRITICAL ZONE", wait: 24, shrink: 18, radius: 8, dps: 16 },
  { id: 6, name: "FINAL CIRCLE", wait: 36, shrink: 14, radius: 3.4, dps: 25 },
];

export interface ZonePublic {
  cx: number;
  cz: number;
  radius: number;
  nextCx: number;
  nextCz: number;
  nextRadius: number;
  phase: number;
  phaseName: string;
  waitLeft: number;
  shrinking: boolean;
  dps: number;
}

export function zoneDamageTick(dps: number, dt: number): number {
  return dps * dt;
}

export function scaledPhases(half: number): ZonePhaseDef[] {
  const k = half / 64;
  return ZONE_PHASES.map((p) => ({ ...p, radius: Math.max(3.2, +(p.radius * k).toFixed(2)) }));
}
