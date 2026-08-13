import { REGIONS, guessRegion, regionById, type RegionDef } from "../../../shared/src/index";

export class Directory {
  readonly regions = REGIONS;

  list(): RegionDef[] {
    return this.regions;
  }

  pick(timeZone: string, measured: { id: string; rtt: number }[]): RegionDef {
    if (measured.length) {
      const best = [...measured].sort((a, b) => a.rtt - b.rtt)[0];
      return regionById(best.id);
    }
    return regionById(guessRegion(timeZone));
  }

  extraMs(id: string): number {
    return regionById(id).extraMs;
  }
}
