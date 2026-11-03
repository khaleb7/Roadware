/**
 * Headless console smoke for the core sim + map + encounters.
 * Run: npm run sim
 */
import { Game } from "./game";
import { getNeighbors } from "./map";
import type { EncounterAction } from "./types";

const seed = Number(process.argv[2] ?? 42);
const game = new Game(seed);

console.log(`ASPHALT DOMINION sim — seed ${seed}`);
printStatus(game);

const firstRoad =
  getNeighbors(game.getState().locationId)[0]?.to ?? "colorado-springs-co";

function autoResolve(preferred: EncounterAction = "fight"): void {
  const pending = game.getState().pendingEncounter;
  if (!pending) return;
  const action = pending.actions.includes(preferred) ? preferred : pending.actions[0]!;
  const result = game.dispatch({ type: "resolveEncounter", action });
  console.log(`\n[resolve:${action}] ${result.ok ? "ok" : result.error}`);
  for (const e of result.events) {
    console.log(`  · ${e.kind}: ${e.message}`);
  }
}

const script = [
  { type: "status" as const },
  { type: "search" as const },
  { type: "move" as const, destinationId: firstRoad },
  { type: "attack" as const },
];

for (const cmd of script) {
  autoResolve();
  const result = game.dispatch(cmd);
  const tag = result.ok ? "ok" : "FAIL";
  console.log(`\n[${tag}] ${JSON.stringify(cmd)}`);
  if (!result.ok) {
    console.log(`  error: ${result.error}`);
    break;
  }
  for (const e of result.events) {
    console.log(`  · ${e.kind}: ${e.message}`);
  }
  if (result.status) {
    console.log(
      `  status ${result.status.locationName} turn=${result.status.turn} pending=${Boolean(result.status.pendingEncounter)}`,
    );
  }
}

autoResolve("fight");
printStatus(game);
const report = game.getState().lastBattleReport;
if (report) {
  console.log(`\nBattle report: ${report.summary}`);
  for (const line of report.lines) console.log(`  - ${line}`);
}

function printStatus(g: Game): void {
  const s = g.getState();
  console.log(
    `turn=${s.turn} loc=${s.locationId} phase=${s.phase} crew=${s.crew.length} veh=${s.vehicles.length} pending=${s.pendingEncounter?.name ?? "none"}`,
  );
  console.log(
    `  food=${s.resources.food} fuel=${s.resources.fuel} tires=${s.resources.tires} ammo=${s.resources.ammunition}`,
  );
}
