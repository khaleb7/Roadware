/**
 * Mulberry32 — tiny seeded PRNG. State is a single uint32, fully serializable.
 * Pass one instance (or recreate from state) through systems; never Math.random.
 */
export class SeededRng {
  private state: number;

  constructor(seedOrState: number) {
    this.state = seedOrState >>> 0;
    if (this.state === 0) {
      // 0 is a fixed point for some mixes; nudge so campaigns still vary.
      this.state = 0x9e3779b9;
    }
  }

  /** Current internal state for GameState.rngState. */
  getState(): number {
    return this.state >>> 0;
  }

  /** Advance and return float in [0, 1). */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Inclusive integer range. */
  int(min: number, max: number): number {
    if (max < min) {
      throw new Error(`rng.int: max (${max}) < min (${min})`);
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(probability: number): boolean {
    if (probability <= 0) return false;
    if (probability >= 1) return true;
    return this.next() < probability;
  }

  pickWeighted<T extends { weight: number }>(items: readonly T[]): T {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    if (total <= 0 || items.length === 0) {
      throw new Error("rng.pickWeighted: empty or zero-weight table");
    }
    let roll = this.next() * total;
    for (const item of items) {
      roll -= item.weight;
      if (roll < 0) return item;
    }
    return items[items.length - 1]!;
  }
}
