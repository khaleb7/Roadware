import type { BattleReport } from "../encounterTypes";
import type { TerrainId, VehicleClassId } from "../types";

export type Facing = 0 | 1 | 2 | 3; // N E S W
export type TacticalSide = "player" | "enemy";
export type TacticalPhase = "deploy" | "combat" | "ended";

export interface TacticalCrewSlot {
  /** Links to GameState crew id when player; synthetic id for enemies. */
  crewId: string;
  name: string;
  role: "driver" | "gunner" | "passenger";
  health: number;
  combat: number;
  alive: boolean;
}

export interface TacticalUnit {
  id: string;
  side: TacticalSide;
  /** Original convoy vehicle id when player-owned; null for enemies/salvage spawns. */
  sourceVehicleId: string | null;
  classId: VehicleClassId;
  name: string;
  x: number;
  y: number;
  facing: Facing;
  hull: number;
  maxHull: number;
  tires: number;
  maxTires: number;
  destroyed: boolean;
  immobilized: boolean;
  captured: boolean;
  deployed: boolean;
  weapons: string[];
  crew: TacticalCrewSlot[];
  movesLeft: number;
  attacksLeft: number;
  actedThisTurn: boolean;
}

export interface SalvageOffer {
  classId: VehicleClassId;
  name: string;
  durability: number;
  maxDurability: number;
  fromUnitId: string;
}

export interface TacticalBattle {
  encounterArchetypeId: string;
  encounterName: string;
  terrainId: TerrainId;
  width: number;
  height: number;
  phase: TacticalPhase;
  activeSide: TacticalSide;
  round: number;
  rngState: number;
  units: TacticalUnit[];
  log: string[];
  /** Player ammo pool snapshot for the battle (spent here, synced on finish). */
  ammo: number;
  guns: number;
  selectedUnitId: string | null;
  result: null | {
    winner: "player" | "enemy" | "draw";
    report: BattleReport;
    salvage: SalvageOffer[];
    survivingPlayerVehicleIds: string[];
    deadCrewIds: string[];
    damagedVehicles: Array<{ id: string; durability: number }>;
  };
}

export type TacticalAction =
  | { type: "select"; unitId: string }
  | { type: "deploy"; unitId: string; x: number; y: number; facing?: Facing }
  | {
      type: "assignCrew";
      unitId: string;
      crewId: string;
      role: TacticalCrewSlot["role"];
    }
  | { type: "autoDeploy" }
  | { type: "beginCombat" }
  | { type: "move"; unitId: string; x: number; y: number }
  | { type: "rotate"; unitId: string; facing: Facing }
  | { type: "shoot"; unitId: string; targetId: string; weaponId?: string }
  | { type: "ram"; unitId: string; targetId: string }
  | { type: "board"; unitId: string; targetId: string }
  | { type: "endTurn" }
  | { type: "fleeQuick" };

export interface TacticalActionResult {
  ok: boolean;
  battle: TacticalBattle;
  error?: string;
  messages: string[];
}
