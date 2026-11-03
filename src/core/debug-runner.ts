/**
 * Headless console smoke for the core sim + map.
 * Run: npm run sim
 */
import { Game } from "./game";
import { getNeighbors } from "./map";

const seed = Number(process.argv[2] ?? 42);
const game = new Game(seed);

console.log(`ASPHALT DOMINION sim — seed ${seed}`);
printStatus(game);

const firstRoad =
  getNeighbors(game.getState().locationId)[0]?.to ?? "colorado-springs-co";

const script = [
  { type: "status" as const },
  { type: "search" as const },
  { type: "rest" as const },
  { type: "move" as const, destinationId: firstRoad },
  { type: "loot" as const },
  { type: "attack" as const },
];

for (const cmd of script) {
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
      `  status ${result.status.locationName} turn=${result.status.turn} roads=${result.status.neighbors.length}`,
    );
  }
}

printStatus(game);

function printStatus(g: Game): void {
  const s = g.getState();
  console.log(
    `turn=${s.turn} loc=${s.locationId} phase=${s.phase} crew=${s.crew.length} veh=${s.vehicles.length} cities=${Object.keys(s.cities).length}`,
  );
  console.log(
    `  food=${s.resources.food} fuel=${s.resources.fuel} tires=${s.resources.tires} ammo=${s.resources.ammunition}`,
  );
}
