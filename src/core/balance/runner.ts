/**
 * Headless balance simulation — N seeded games with a simple AI policy.
 *
 * Usage:
 *   npm run balance
 *   npm run balance -- --games 40 --difficulty classic --max-turns 300
 *   npm run balance -- --games 20 --difficulty road-weary --json
 */
import type { DifficultyId } from "../difficulty";
import { aggregateResults, formatReport } from "./aggregate";
import { playSeededGame } from "./playGame";

interface BalanceCliOptions {
  games: number;
  difficulty: DifficultyId;
  maxTurns: number;
  seedBase: number;
  json: boolean;
}

function parseArgs(argv: string[]): BalanceCliOptions {
  const opts: BalanceCliOptions = {
    games: 30,
    difficulty: "classic",
    maxTurns: 300,
    seedBase: 1000,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--games" && next) {
      opts.games = Number(next);
      i++;
    } else if (a === "--difficulty" && next) {
      opts.difficulty = next as DifficultyId;
      i++;
    } else if (a === "--max-turns" && next) {
      opts.maxTurns = Number(next);
      i++;
    } else if (a === "--seed-base" && next) {
      opts.seedBase = Number(next);
      i++;
    } else if (a === "--json") {
      opts.json = true;
    }
  }
  return opts;
}

function runBalanceBatch(opts: BalanceCliOptions) {
  const results = [];
  for (let i = 0; i < opts.games; i++) {
    const seed = opts.seedBase + i;
    const result = playSeededGame({
      seed,
      difficulty: opts.difficulty,
      maxTurns: opts.maxTurns,
    });
    results.push(result);
    if (!opts.json) {
      const tag =
        result.outcome === "won"
          ? "WIN"
          : result.outcome === "lost"
            ? `LOSS:${result.lossKind}`
            : "TIMEOUT";
      console.log(
        `[${i + 1}/${opts.games}] seed=${seed} ${tag} turns=${result.turns} contact=${result.contacted} sci=${result.scientistsDelivered}/${result.scientistsTotal}`,
      );
    }
  }

  const report = aggregateResults(results, {
    difficulty: opts.difficulty,
    maxTurns: opts.maxTurns,
  });
  return report;
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  console.log(
    `ASPHALT DOMINION balance — games=${opts.games} difficulty=${opts.difficulty} maxTurns=${opts.maxTurns} seedBase=${opts.seedBase}`,
  );
  const started = Date.now();
  const report = runBalanceBatch(opts);
  const elapsed = ((Date.now() - started) / 1000).toFixed(2);
  if (opts.json) {
    // Omit per-game detail noise unless small
    const { results: _r, ...summary } = report;
    console.log(JSON.stringify({ ...summary, elapsedSec: Number(elapsed) }, null, 2));
  } else {
    console.log("");
    console.log(formatReport(report, "batch"));
    console.log(`elapsed=${elapsed}s`);
  }
}

main();
