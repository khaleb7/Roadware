export {
  balance,
  citiesData,
  specialists,
  vehicleClasses,
  terrain,
  factions,
  encounters,
  getVehicleClass,
  getCityDef,
  getTerrain,
  getFaction,
  getEncounter,
} from "./data";
export { SeededRng } from "./rng";
export {
  createInitialState,
  cloneState,
  serializeState,
  deserializeState,
} from "./state";
export type { NewGameOptions } from "./state";
export { applyCommand } from "./commands";
export { Game, runCommand } from "./game";
export type { GameConstructOptions } from "./game";
export {
  difficultyData,
  getDifficulty,
  listDifficulties,
  scaleStartingResources,
  scaleDeadlineTurns,
} from "./difficulty";
export type { DifficultyId, DifficultyProfile } from "./difficulty";
export { stageChoice, clearStaged } from "./undo";
export type { StagedChoice } from "./undo";
export { livingCrew, hasSpecialist, grantXp } from "./crew";
export { moveFuelCost, canAddVehicle } from "./vehicles";
export {
  getNeighbors,
  findRoad,
  shortestPath,
  nextHop,
  computeTravelCost,
  graphStats,
  cityStatusView,
  neighborStatus,
} from "./map";
export {
  chooseCommand,
  playSeededGame,
  aggregateResults,
  formatReport,
} from "./balance";
export type { PlayResult, PlayOptions, BalanceReport } from "./balance";
export {
  rollEncounterChance,
  createPendingEncounter,
  quickResolveFight,
  resolveEncounterAction,
} from "./encounters";
export {
  createTacticalBattle,
  applyTacticalAction,
  applyTacticalResult,
  tacticalBalance,
  weapons,
} from "./tactical";
export {
  campaignData,
  gangStrength,
  meetsFederalContactThreshold,
  createCampaignState,
  campaignStatusView,
} from "./campaign";
export type * from "./types";
export type * from "./encounterTypes";
export type * from "./tactical/types";
export type * from "./campaignTypes";
