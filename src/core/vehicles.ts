import { balance, getVehicleClass } from "./data";
import { allocateId } from "./state";
import type { GameState, Vehicle, VehicleClassId } from "./types";

export function findVehicle(
  vehicles: readonly Vehicle[],
  id: string,
): Vehicle | undefined {
  return vehicles.find((v) => v.id === id);
}

export function canAddVehicle(state: GameState): boolean {
  return state.vehicles.length < balance.maxVehicles;
}

export function addVehicle(
  state: GameState,
  classId: VehicleClassId,
  name: string,
): Vehicle {
  if (!canAddVehicle(state)) {
    throw new Error(`Vehicle cap reached (${balance.maxVehicles})`);
  }
  const cls = getVehicleClass(classId);
  const vehicle: Vehicle = {
    id: allocateId(state, "veh"),
    classId,
    name,
    durability: cls.maxDurability,
    maxDurability: cls.maxDurability,
  };
  state.vehicles.push(vehicle);
  return vehicle;
}

/** Legacy flat estimate — prefer computeTravelCost in map.ts for real moves. */
export function moveFuelCost(state: GameState): number {
  const c = balance.consumption;
  return c.fuelPerMoveFlat + c.fuelPerVehicleOnMove * state.vehicles.length;
}

export function totalCargoCapacity(state: GameState): number {
  return state.vehicles.reduce((sum, v) => sum + getVehicleClass(v.classId).cargo, 0);
}

export function totalCrewCapacity(state: GameState): number {
  return state.vehicles.reduce((sum, v) => sum + getVehicleClass(v.classId).maxCrew, 0);
}
