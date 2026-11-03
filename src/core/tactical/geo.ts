import type { Facing } from "./types";

export function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export function isAdjacent(ax: number, ay: number, bx: number, by: number): boolean {
  return manhattan(ax, ay, bx, by) === 1;
}

/** Delta from attacker to defender → which facing of defender is hit. */
export function hitArc(
  defenderFacing: Facing,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): "front" | "side" | "rear" {
  const dx = fromX - toX;
  const dy = fromY - toY;
  // Dominant approach axis
  let approach: Facing;
  if (Math.abs(dx) >= Math.abs(dy)) {
    approach = dx > 0 ? 1 : 3; // from east / west
  } else {
    approach = dy > 0 ? 2 : 0; // from south / north
  }
  const diff = (approach - defenderFacing + 4) % 4;
  if (diff === 0) return "front";
  if (diff === 2) return "rear";
  return "side";
}

export function rotateToward(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): Facing {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 1 : 3;
  }
  return dy >= 0 ? 2 : 0;
}

export const FACING_DELTA: Record<Facing, { dx: number; dy: number }> = {
  0: { dx: 0, dy: -1 },
  1: { dx: 1, dy: 0 },
  2: { dx: 0, dy: 1 },
  3: { dx: -1, dy: 0 },
};
