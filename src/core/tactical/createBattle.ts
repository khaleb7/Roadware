import { livingCrew } from "../crew";
import { getVehicleClass } from "../data";
import type { PendingEncounter } from "../encounterTypes";
import type { SeededRng } from "../rng";
import type { GameState, VehicleClassId } from "../types";
import { tacticalBalance } from "./data";
import type { Facing, TacticalBattle, TacticalCrewSlot, TacticalUnit } from "./types";

function playerWeapons(classId: VehicleClassId): string[] {
  return [...(tacticalBalance.playerDefaultWeapons[classId] ?? ["handgun"])];
}

function enemyWeapons(classId: VehicleClassId): string[] {
  return [...(tacticalBalance.enemyForce.defaultWeapons[classId] ?? ["handgun"])];
}

export function createTacticalBattle(
  state: GameState,
  pending: PendingEncounter,
  rng: SeededRng,
): TacticalBattle {
  const cfg = tacticalBalance;
  const units: TacticalUnit[] = [];
  let nextId = 1;
  const alloc = (prefix: string) => {
    const id = `${prefix}-${nextId}`;
    nextId += 1;
    return id;
  };

  // Player vehicles — undeployed in pool (x/y = -1 until placed)
  const crewPool = livingCrew(state.crew);
  let crewIdx = 0;
  for (const v of state.vehicles) {
    const cls = getVehicleClass(v.classId);
    const crew: TacticalCrewSlot[] = [];
    const seats = Math.min(cls.maxCrew, 3);
    for (let s = 0; s < seats && crewIdx < crewPool.length; s += 1) {
      const c = crewPool[crewIdx]!;
      crewIdx += 1;
      crew.push({
        crewId: c.id,
        name: c.name,
        role: s === 0 ? "driver" : s === 1 ? "gunner" : "passenger",
        health: c.health,
        combat: c.combat,
        alive: true,
      });
    }
    units.push({
      id: alloc("pv"),
      side: "player",
      sourceVehicleId: v.id,
      classId: v.classId,
      name: v.name,
      x: -1,
      y: -1,
      facing: 0,
      hull: v.durability,
      maxHull: v.maxDurability,
      tires: cfg.tireMax,
      maxTires: cfg.tireMax,
      destroyed: false,
      immobilized: false,
      captured: false,
      deployed: false,
      weapons: playerWeapons(v.classId),
      crew,
      movesLeft: 0,
      attacksLeft: 0,
      actedThisTurn: false,
    });
  }

  // Enemy force sized from encounter strength
  const force = cfg.enemyForce;
  let count = Math.max(
    force.minVehicles,
    Math.min(
      force.maxVehicles,
      Math.round(pending.strength / force.strengthPerVehicle),
    ),
  );
  count = Math.max(force.minVehicles, count);
  for (let i = 0; i < count; i += 1) {
    const pick = rng.pickWeighted(force.classWeights);
    const classId = pick.classId;
    const cls = getVehicleClass(classId);
    const gunners = Math.max(1, Math.min(2, Math.floor(cls.maxCrew / 2)));
    const crew: TacticalCrewSlot[] = [];
    for (let g = 0; g < gunners; g += 1) {
      crew.push({
        crewId: alloc("ec"),
        name: `${pending.name} rider`,
        role: g === 0 ? "driver" : "gunner",
        health: 80,
        combat: rng.int(30, 55),
        alive: true,
      });
    }
    const x = rng.int(0, cfg.gridWidth - 1);
    const y = rng.int(cfg.enemyDeployMinY, cfg.enemyDeployMaxY);
    units.push({
      id: alloc("ev"),
      side: "enemy",
      sourceVehicleId: null,
      classId,
      name: `${cls.label} ${i + 1}`,
      x,
      y,
      facing: 2,
      hull: cls.maxDurability,
      maxHull: cls.maxDurability,
      tires: cfg.tireMax,
      maxTires: cfg.tireMax,
      destroyed: false,
      immobilized: false,
      captured: false,
      deployed: true,
      weapons: enemyWeapons(classId),
      crew,
      movesLeft: 0,
      attacksLeft: 0,
      actedThisTurn: false,
    });
  }

  return {
    encounterArchetypeId: pending.archetypeId,
    encounterName: pending.name,
    terrainId: pending.terrainId,
    width: cfg.gridWidth,
    height: cfg.gridHeight,
    phase: "deploy",
    activeSide: "player",
    round: 1,
    rngState: rng.getState(),
    units,
    log: [
      `Tactical: ${pending.name} on ${pending.terrainId} road.`,
      "Deploy convoy (autoDeploy or place units), then beginCombat.",
    ],
    ammo: state.resources.ammunition,
    guns: state.resources.guns,
    selectedUnitId: units.find((u) => u.side === "player")?.id ?? null,
    result: null,
  };
}

export function defaultFacingForSide(side: "player" | "enemy"): Facing {
  return side === "player" ? 0 : 2;
}
