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

export type TerrainId =
  "highway" | "secondary" | "mountain" | "desert" | "coastal" | "ruined";

export type GamePhase = "playing" | "lost";

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

export interface RecruitTemplate {
  name: string;
  specialist: SpecialistId;
  combat: number;
  survival: number;
  leadership: number;
}

export interface CityRevealFlags {
  population: boolean;
  danger: boolean;
  faction: boolean;
  loot: boolean;
  vehicles: boolean;
  recruits: boolean;
  specials: boolean;
}

/** Per-city runtime state — hidden fields stay in state but UI reads reveal flags. */
export interface CityRuntime {
  id: string;
  visited: boolean;
  searched: boolean;
  population: number;
  danger: number;
  factionId: string;
  loot: Resources;
  vehicleYard: VehicleClassId[];
  recruits: RecruitTemplate[];
  specialLocations: string[];
  revealed: CityRevealFlags;
}

export interface GameState {
  seed: number;
  rngState: number;
  turn: number;
  phase: GamePhase;
  lossReason: string | null;
  locationId: string;
  resources: Resources;
  crew: CrewMember[];
  vehicles: Vehicle[];
  caches: CacheDeposit[];
  cities: Record<string, CityRuntime>;
  hungerStreak: number;
  stranded: boolean;
  nextEntityId: number;
  log: GameEvent[];
}

export type GameCommand =
  | { type: "move"; destinationId: string }
  | { type: "search" }
  | { type: "loot"; cacheId?: string }
  | { type: "retrieve"; cacheId: string }
  | { type: "repair"; vehicleId: string }
  | { type: "heal"; crewId: string }
  | { type: "cache"; deposit: Partial<Resources> }
  | { type: "rest" }
  | { type: "attack" }
  | { type: "status" }
  | { type: "scavengeVehicle"; classId?: VehicleClassId }
  | { type: "captureVehicle"; classId?: VehicleClassId };

export interface NeighborInfo {
  id: string;
  name: string;
  terrain: TerrainId;
  miles: number;
  fuelCost: number;
}

export interface CityStatusView {
  id: string;
  name: string;
  stateCode: string;
  visited: boolean;
  searched: boolean;
  population: number | null;
  danger: number | null;
  factionLabel: string | null;
  loot: Partial<Resources> | null;
  vehicleYard: VehicleClassId[] | null;
  recruitCount: number | null;
  recruits: RecruitTemplate[] | null;
  specialLocations: string[] | null;
}

export interface CommandResult {
  ok: boolean;
  state: GameState;
  events: GameEvent[];
  turnAdvanced: boolean;
  error?: string;
  status?: StatusSnapshot;
}

export interface StatusSnapshot {
  turn: number;
  phase: GamePhase;
  locationId: string;
  locationName: string;
  resources: Resources;
  crewCount: number;
  vehicleCount: number;
  hungerStreak: number;
  stranded: boolean;
  lossReason: string | null;
  neighbors: NeighborInfo[];
  city: CityStatusView;
  cachesHere: Array<{ id: string; resources: Partial<Resources> }>;
  recentLog: GameEvent[];
}
