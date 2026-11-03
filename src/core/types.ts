/** Resource ids — structural enum, amounts/rates live in data JSON. */
export const RESOURCE_IDS = [
  "food",
  "fuel",
  "tires",
  "medicine",
  "guns",
  "ammunition",
  "spareParts",
] as const;

export type ResourceId = (typeof RESOURCE_IDS)[number];

export type Resources = Record<ResourceId, number>;

export type SpecialistId =
  "leader" | "medic" | "mechanic" | "driver" | "scout" | "negotiator" | "gunner";

export type VehicleClassId =
  "bike" | "hardtop" | "hauler" | "bus" | "tanker" | "armored";

export type GamePhase = "playing" | "lost";

export type CommandType =
  | "move"
  | "search"
  | "loot"
  | "repair"
  | "heal"
  | "cache"
  | "rest"
  | "attack"
  | "status"
  | "scavengeVehicle"
  | "captureVehicle";

export interface CrewMember {
  id: string;
  name: string;
  specialist: SpecialistId;
  health: number;
  combat: number;
  survival: number;
  leadership: number;
  xp: number;
  combatXpBank: number;
  survivalXpBank: number;
  leadershipXpBank: number;
}

export interface Vehicle {
  id: string;
  classId: VehicleClassId;
  name: string;
  durability: number;
  maxDurability: number;
}

export interface CacheDeposit {
  id: string;
  locationId: string;
  resources: Partial<Resources>;
}

export interface GameEvent {
  turn: number;
  kind: string;
  message: string;
}

export interface GameState {
  /** Original campaign seed (for display / new-game replay). */
  seed: number;
  /** Current Mulberry32 state — serialize this for mid-run reproducibility. */
  rngState: number;
  turn: number;
  phase: GamePhase;
  lossReason: string | null;
  locationId: string;
  resources: Resources;
  crew: CrewMember[];
  vehicles: Vehicle[];
  caches: CacheDeposit[];
  hungerStreak: number;
  stranded: boolean;
  nextEntityId: number;
  log: GameEvent[];
}

export type GameCommand =
  | { type: "move"; destinationId: string }
  | { type: "search" }
  | { type: "loot"; cacheId?: string }
  | { type: "repair"; vehicleId: string }
  | { type: "heal"; crewId: string }
  | { type: "cache"; deposit: Partial<Resources> }
  | { type: "rest" }
  | { type: "attack" }
  | { type: "status" }
  | { type: "scavengeVehicle"; classId?: VehicleClassId }
  | { type: "captureVehicle"; classId?: VehicleClassId };

export interface CommandResult {
  ok: boolean;
  state: GameState;
  events: GameEvent[];
  /** False for free commands like status. */
  turnAdvanced: boolean;
  error?: string;
  status?: StatusSnapshot;
}

export interface StatusSnapshot {
  turn: number;
  phase: GamePhase;
  locationId: string;
  resources: Resources;
  crewCount: number;
  vehicleCount: number;
  hungerStreak: number;
  stranded: boolean;
  lossReason: string | null;
}
