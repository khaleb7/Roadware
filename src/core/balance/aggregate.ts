import type { PlayResult } from "./playGame";

export interface BalanceReport {
  games: number;
  difficulty: string;
  maxTurns: number;
  wins: number;
  losses: number;
  timeouts: number;
  winRate: number;
  lossRate: number;
  timeoutRate: number;
  contactRate: number;
  avgTurns: number;
  avgTurnsWon: number;
  avgTurnsLost: number;
  avgScientistsDelivered: number;
  lossBreakdown: Record<string, number>;
  survivalRate: number;
  results: PlayResult[];
}

export function aggregateResults(
  results: PlayResult[],
  meta: { difficulty: string; maxTurns: number },
): BalanceReport {
  const games = results.length;
  const wins = results.filter((r) => r.outcome === "won").length;
  const losses = results.filter((r) => r.outcome === "lost").length;
  const timeouts = results.filter((r) => r.outcome === "timeout").length;
  const contacted = results.filter((r) => r.contacted).length;
  const survived = results.filter((r) => r.crewEnd > 0 && r.outcome !== "lost").length;

  const lossBreakdown: Record<string, number> = {};
  for (const r of results) {
    if (r.outcome === "lost" || r.outcome === "timeout") {
      const key = r.lossKind;
      lossBreakdown[key] = (lossBreakdown[key] ?? 0) + 1;
    }
  }

  const avg = (xs: number[]) =>
    xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

  const wonTurns = results.filter((r) => r.outcome === "won").map((r) => r.turns);
  const lostTurns = results.filter((r) => r.outcome === "lost").map((r) => r.turns);

  return {
    games,
    difficulty: meta.difficulty,
    maxTurns: meta.maxTurns,
    wins,
    losses,
    timeouts,
    winRate: games ? wins / games : 0,
    lossRate: games ? losses / games : 0,
    timeoutRate: games ? timeouts / games : 0,
    contactRate: games ? contacted / games : 0,
    avgTurns: avg(results.map((r) => r.turns)),
    avgTurnsWon: avg(wonTurns),
    avgTurnsLost: avg(lostTurns),
    avgScientistsDelivered: avg(results.map((r) => r.scientistsDelivered)),
    lossBreakdown,
    survivalRate: games ? survived / games : 0,
    results,
  };
}

export function formatReport(report: BalanceReport, label: string): string {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const lines = [
    `=== Balance report: ${label} ===`,
    `games=${report.games} difficulty=${report.difficulty} maxTurns=${report.maxTurns}`,
    `wins=${report.wins} (${pct(report.winRate)})  losses=${report.losses} (${pct(report.lossRate)})  timeouts=${report.timeouts} (${pct(report.timeoutRate)})`,
    `contactRate=${pct(report.contactRate)}  survivalRate=${pct(report.survivalRate)}`,
    `avgTurns=${report.avgTurns.toFixed(1)}  avgTurnsWon=${report.avgTurnsWon.toFixed(1)}  avgTurnsLost=${report.avgTurnsLost.toFixed(1)}`,
    `avgScientistsDelivered=${report.avgScientistsDelivered.toFixed(2)}`,
    `lossBreakdown=${JSON.stringify(report.lossBreakdown)}`,
  ];
  return lines.join("\n");
}
