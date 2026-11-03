import { describe, expect, it } from "vitest";
import { SeededRng } from "./rng";

describe("SeededRng", () => {
  it("is reproducible from the same seed", () => {
    const a = new SeededRng(12345);
    const b = new SeededRng(12345);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("diverges for different seeds", () => {
    const a = new SeededRng(1);
    const b = new SeededRng(2);
    expect(Array.from({ length: 5 }, () => a.next())).not.toEqual(
      Array.from({ length: 5 }, () => b.next()),
    );
  });

  it("restores mid-stream from getState()", () => {
    const a = new SeededRng(99);
    a.next();
    a.next();
    const mid = a.getState();
    const continued = [a.next(), a.next(), a.next()];

    const b = new SeededRng(mid);
    expect([b.next(), b.next(), b.next()]).toEqual(continued);
  });

  it("int is inclusive", () => {
    const rng = new SeededRng(7);
    for (let i = 0; i < 50; i += 1) {
      const n = rng.int(2, 4);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(4);
    }
  });
});
