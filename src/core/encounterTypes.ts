import type { ResourceId, TerrainId } from "./types";

export type EncounterKind =
  | "rival_gang"
  | "mutants"
  | "cannibals"
  | "militia"
  | "cult"
  | "plague_zone"
  | "friendly_enclave"
  | "trader"
  | "healer";

export type EncounterAction = "fight" | "evade" | "negotiate" | "trade";

export type EncounterContext = "road" | "city";

export interface EncounterLootEntry {
  resource: ResourceId;
  min: number;
  max: number;
  weight: number;
}

export interface EncounterTradeOffer {
  give: { resource: ResourceId; amount: number };
  receive: { resource: ResourceId; amount: number };
}

export interface EncounterArchetype {
  id: string;
  kind: EncounterKind;
  name: string;
  description: string;
  attitude: string;
  strengthMin: number;
  strengthMax: number;
  moraleMin: number;
  moraleMax: number;
  actions: EncounterAction[];
  spawnWeight: number;
  contexts: EncounterContext[];
  lootTable: EncounterLootEntry[];
  trade?: EncounterTradeOffer;
  giftOnNegotiate?: { resource: ResourceId; amount: number };
  healOnTrade?: { healthRestored: number };
  plague?: { exposureChance: number; healthDamage: number };
}

export interface PendingEncounter {
  archetypeId: string;
  kind: EncounterKind;
  name: string;
  description: string;
  strength: number;
  morale: number;
  actions: EncounterAction[];
  terrainId: TerrainId;
  locationId: string;
  context: EncounterContext;
}

export interface BattleReport {
  outcomeId: string;
  title: string;
  summary: string;
  playerScore: number;
  enemyScore: number;
  ratio: number;
  lines: string[];
}
