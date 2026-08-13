import { RATE_LIMITS } from "../../../shared/src/index";

export class RateGate {
  private hits = new Map<string, number[]>();

  allow(bucket: string, id: string, override?: { max: number; window: number }): boolean {
    const spec = override || RATE_LIMITS[bucket] || { max: 20, window: 60_000 };
    const now = Date.now();
    const key = bucket + ":" + id;
    const list = (this.hits.get(key) || []).filter((t) => now - t < spec.window);
    if (list.length >= spec.max) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    return true;
  }

  peek(bucket: string, id: string): number {
    const spec = RATE_LIMITS[bucket] || { max: 20, window: 60_000 };
    const now = Date.now();
    return (this.hits.get(bucket + ":" + id) || []).filter((t) => now - t < spec.window).length;
  }
}
