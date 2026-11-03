import { getVehicleClass } from "../data";
import { SeededRng } from "../rng";
import { getWeapon, tacticalBalance } from "./data";
import { defaultFacingForSide } from "./createBattle";
import { hitArc, isAdjacent, manhattan, rotateToward } from "./geo";
import type {
  Facing,
  SalvageOffer,
  TacticalAction,
  TacticalActionResult,
  TacticalBattle,
  TacticalUnit,
} from "./types";
import type { BattleReport } from "../encounterTypes";

function cloneBattle(b: TacticalBattle): TacticalBattle {
  return structuredClone(b);
}

function rngOf(b: TacticalBattle): SeededRng {
  return new SeededRng(b.rngState);
}

function sync(b: TacticalBattle, rng: SeededRng): void {
  b.rngState = rng.getState();
}

function fail(battle: TacticalBattle, error: string): TacticalActionResult {
  return { ok: false, battle, error, messages: [] };
}

function unitById(b: TacticalBattle, id: string): TacticalUnit | undefined {
  return b.units.find((u) => u.id === id);
}

function occupied(b: TacticalBattle, x: number, y: number, exceptId?: string): boolean {
  return b.units.some(
    (u) => !u.destroyed && u.deployed && u.x === x && u.y === y && u.id !== exceptId,
  );
}

function inBounds(b: TacticalBattle, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < b.width && y < b.height;
}

function aliveUnits(b: TacticalBattle, side: "player" | "enemy"): TacticalUnit[] {
  return b.units.filter(
    (u) => u.side === side && u.deployed && !u.destroyed && !u.captured,
  );
}

function refreshSide(b: TacticalBattle, side: "player" | "enemy"): void {
  for (const u of b.units) {
    if (u.side !== side || u.destroyed || u.captured || !u.deployed) continue;
    if (u.immobilized) {
      u.movesLeft = 0;
    } else {
      const speed = getVehicleClass(u.classId).speed;
      u.movesLeft = Math.max(
        tacticalBalance.movesPerTurnBase,
        Math.ceil(speed / tacticalBalance.speedMovesDivisor),
      );
    }
    u.attacksLeft = tacticalBalance.attacksPerTurn;
    u.actedThisTurn = false;
  }
}

function pushLog(b: TacticalBattle, msg: string): void {
  b.log.push(msg);
  if (b.log.length > 80) b.log.splice(0, b.log.length - 80);
}

function applyHullDamage(u: TacticalUnit, amount: number): void {
  u.hull = Math.max(tacticalBalance.hullDestroyAt, u.hull - amount);
  if (u.hull <= tacticalBalance.hullDestroyAt) {
    u.destroyed = true;
    u.immobilized = true;
  }
}

function applyTireHit(u: TacticalUnit, rng: SeededRng): string | null {
  u.tires = Math.max(
    tacticalBalance.tireDestroyThreshold,
    u.tires - tacticalBalance.tireDamageOnHit,
  );
  if (u.tires <= tacticalBalance.tireDestroyThreshold) {
    u.immobilized = true;
    u.movesLeft = 0;
    return `${u.name} tires shredded — immobilized`;
  }
  if (rng.chance(0.01)) return null; // keep rng use stable path
  return `${u.name} tires ${u.tires}/${u.maxTires}`;
}

function crewCombatSum(u: TacticalUnit): number {
  return u.crew.filter((c) => c.alive).reduce((s, c) => s + c.combat, 0);
}

function damageCrew(u: TacticalUnit, rng: SeededRng): string | null {
  const living = u.crew.filter((c) => c.alive);
  if (living.length === 0) return null;
  const victim = living[rng.int(0, living.length - 1)]!;
  victim.health -= tacticalBalance.crewCasualtyHealthLoss;
  if (victim.health <= 0) {
    victim.alive = false;
    victim.health = 0;
    return `${victim.name} down in ${u.name}`;
  }
  return `${victim.name} wounded (${victim.health} hp)`;
}

function facingMultiplier(arc: "front" | "side" | "rear"): number {
  const f = tacticalBalance.facing;
  if (arc === "front") return f.frontDamageTaken;
  if (arc === "rear") return f.rearDamageTaken;
  return f.sideDamageTaken;
}

function mitigatedDamage(
  raw: number,
  armor: number,
  arc: "front" | "side" | "rear",
): number {
  const mit = Math.min(
    tacticalBalance.maxArmorMitigation,
    armor * tacticalBalance.armorMitigationPerPoint,
  );
  const afterArmor = raw * (1 - mit);
  return Math.max(1, Math.round(afterArmor * facingMultiplier(arc)));
}

function checkEnd(b: TacticalBattle, rng: SeededRng): void {
  const players = aliveUnits(b, "player");
  const enemies = aliveUnits(b, "enemy");
  if (players.length > 0 && enemies.length > 0) return;

  const winner: "player" | "enemy" | "draw" =
    players.length > 0 && enemies.length === 0
      ? "player"
      : enemies.length > 0 && players.length === 0
        ? "enemy"
        : "draw";

  b.phase = "ended";
  const salvage = buildSalvage(b, rng, winner);
  const report = buildReport(b, winner, salvage);
  b.result = {
    winner,
    report,
    salvage,
    survivingPlayerVehicleIds: players
      .map((u) => u.sourceVehicleId)
      .filter((id): id is string => Boolean(id)),
    deadCrewIds: b.units
      .filter((u) => u.side === "player")
      .flatMap((u) => u.crew.filter((c) => !c.alive).map((c) => c.crewId)),
    damagedVehicles: b.units
      .filter((u) => u.side === "player" && u.sourceVehicleId)
      .map((u) => ({
        id: u.sourceVehicleId!,
        durability: Math.max(1, u.destroyed ? 1 : u.hull),
      })),
  };
  pushLog(b, report.summary);
}

function buildSalvage(
  b: TacticalBattle,
  rng: SeededRng,
  winner: "player" | "enemy" | "draw",
): SalvageOffer[] {
  if (winner !== "player") return [];
  const cfg = tacticalBalance.salvage;
  const offers: SalvageOffer[] = [];
  for (const u of b.units.filter((x) => x.side === "enemy")) {
    const eligible =
      u.captured || ((u.destroyed || u.immobilized) && rng.chance(cfg.disabledChance));
    const boardedOk = u.captured && cfg.boardedGuaranteed;
    if (!eligible && !boardedOk) continue;
    if (u.captured && !cfg.boardedGuaranteed && !rng.chance(cfg.disabledChance)) {
      // still allow boarded guaranteed path above
    }
    const frac =
      cfg.durabilityFractionMin +
      rng.next() * (cfg.durabilityFractionMax - cfg.durabilityFractionMin);
    const maxD = getVehicleClass(u.classId).maxDurability;
    offers.push({
      classId: u.classId,
      name: `Salvaged ${u.name}`,
      durability: Math.max(1, Math.floor(maxD * frac)),
      maxDurability: maxD,
      fromUnitId: u.id,
    });
  }
  return offers;
}

function buildReport(
  b: TacticalBattle,
  winner: "player" | "enemy" | "draw",
  salvage: SalvageOffer[],
): BattleReport {
  const title =
    winner === "player"
      ? "Tactical victory"
      : winner === "enemy"
        ? "Tactical defeat"
        : "Tactical draw";
  const lines = [
    ...b.log.slice(-12),
    salvage.length
      ? `Salvage ready: ${salvage.map((s) => s.name).join(", ")}`
      : "No salvage recovered.",
  ];
  return {
    outcomeId: `tactical-${winner}`,
    title,
    summary: `${b.encounterName} — ${title}.`,
    playerScore: aliveUnits(b, "player").length,
    enemyScore: aliveUnits(b, "enemy").length,
    ratio: winner === "player" ? 0.75 : winner === "enemy" ? 0.25 : 0.5,
    lines,
  };
}

function autoDeployPlayer(b: TacticalBattle, rng: SeededRng): void {
  const cfg = tacticalBalance;
  const undeployed = b.units.filter((u) => u.side === "player" && !u.deployed);
  for (const u of undeployed) {
    let placed = false;
    for (let attempt = 0; attempt < 40 && !placed; attempt += 1) {
      const x = rng.int(0, b.width - 1);
      const y = rng.int(cfg.playerDeployMinY, cfg.playerDeployMaxY);
      if (!occupied(b, x, y)) {
        u.x = x;
        u.y = y;
        u.facing = defaultFacingForSide("player");
        u.deployed = true;
        placed = true;
      }
    }
    if (!placed) {
      // scan deploy band
      outer: for (let y = cfg.playerDeployMinY; y <= cfg.playerDeployMaxY; y += 1) {
        for (let x = 0; x < b.width; x += 1) {
          if (!occupied(b, x, y)) {
            u.x = x;
            u.y = y;
            u.facing = defaultFacingForSide("player");
            u.deployed = true;
            break outer;
          }
        }
      }
    }
  }
}

function beginCombat(b: TacticalBattle): void {
  const undeployed = b.units.some((u) => u.side === "player" && !u.deployed);
  if (undeployed) throw new Error("Deploy all convoy vehicles first");
  b.phase = "combat";
  b.activeSide = "player";
  b.round = 1;
  refreshSide(b, "player");
  pushLog(b, "Combat begun. Player initiative.");
}

function runEnemyAi(b: TacticalBattle, rng: SeededRng): string[] {
  const messages: string[] = [];
  if (b.phase !== "combat" || b.activeSide !== "enemy") return messages;
  refreshSide(b, "enemy");
  const enemies = aliveUnits(b, "enemy");
  for (const u of enemies) {
    if (u.destroyed || u.captured) continue;
    const players = aliveUnits(b, "player");
    if (players.length === 0) break;
    // Prefer shoot
    let shot = false;
    if (u.attacksLeft > 0 && b.ammo >= 0) {
      const weaponId = u.weapons[0];
      if (weaponId) {
        const weapon = getWeapon(weaponId);
        const targets = players
          .filter((p) => manhattan(u.x, u.y, p.x, p.y) <= weapon.range)
          .sort(
            (a, c) => manhattan(u.x, u.y, a.x, a.y) - manhattan(u.x, u.y, c.x, c.y),
          );
        const target = targets[0];
        if (target) {
          const res = performShoot(b, rng, u, target, weaponId);
          messages.push(...res);
          shot = true;
        }
      }
    }
    if (!shot && u.movesLeft > 0 && !u.immobilized) {
      const target = players[0]!;
      const nx = u.x + Math.sign(target.x - u.x) * (target.x === u.x ? 0 : 1);
      const ny = u.y + Math.sign(target.y - u.y) * (target.y === u.y ? 0 : 1);
      // Prefer axis toward target
      const candidates = [
        { x: u.x + Math.sign(target.x - u.x), y: u.y },
        { x: u.x, y: u.y + Math.sign(target.y - u.y) },
        { x: nx, y: u.y },
        { x: u.x, y: ny },
      ];
      for (const c of candidates) {
        if (
          inBounds(b, c.x, c.y) &&
          !occupied(b, c.x, c.y, u.id) &&
          (c.x !== u.x || c.y !== u.y)
        ) {
          // Ram if adjacent after move intent
          if (
            tacticalBalance.ai.ramIfStronger &&
            isAdjacent(c.x, c.y, target.x, target.y) &&
            u.attacksLeft > 0 &&
            crewCombatSum(u) >= crewCombatSum(target)
          ) {
            u.x = c.x;
            u.y = c.y;
            u.facing = rotateToward(u.x, u.y, target.x, target.y);
            u.movesLeft -= 1;
            messages.push(...performRam(b, rng, u, target));
          } else {
            u.facing = rotateToward(u.x, u.y, c.x, c.y);
            u.x = c.x;
            u.y = c.y;
            u.movesLeft -= 1;
            messages.push(`${u.name} advances to ${c.x},${c.y}`);
          }
          break;
        }
      }
    }
  }
  b.activeSide = "player";
  b.round += 1;
  refreshSide(b, "player");
  messages.push(`Round ${b.round} — player turn.`);
  checkEnd(b, rng);
  return messages;
}

function performShoot(
  b: TacticalBattle,
  rng: SeededRng,
  attacker: TacticalUnit,
  target: TacticalUnit,
  weaponId: string,
): string[] {
  const weapon = getWeapon(weaponId);
  const msgs: string[] = [];
  if (b.ammo < weapon.ammoPerShot) {
    msgs.push("Not enough ammunition to fire.");
    return msgs;
  }
  b.ammo -= weapon.ammoPerShot;
  attacker.attacksLeft -= 1;
  attacker.actedThisTurn = true;
  attacker.facing = rotateToward(attacker.x, attacker.y, target.x, target.y);

  const dist = manhattan(attacker.x, attacker.y, target.x, target.y);
  let acc = weapon.accuracy - dist * 0.04;
  if (attacker.crew.some((c) => c.alive && c.role === "gunner")) acc += 0.08;
  if (!rng.chance(Math.max(0.15, Math.min(0.95, acc)))) {
    msgs.push(`${attacker.name} misses ${target.name} with ${weapon.label}.`);
    pushLog(b, msgs[msgs.length - 1]!);
    return msgs;
  }

  const arc = hitArc(target.facing, attacker.x, attacker.y, target.x, target.y);
  const armor = getVehicleClass(target.classId).armor;
  const dmg = mitigatedDamage(weapon.damage, armor, arc);
  applyHullDamage(target, dmg);
  msgs.push(
    `${attacker.name} hits ${target.name} (${arc}, ${dmg} hull) with ${weapon.label}.`,
  );

  if (!target.destroyed && rng.chance(weapon.tireHitChance)) {
    const tmsg = applyTireHit(target, rng);
    if (tmsg) msgs.push(tmsg);
  }
  if (!target.destroyed && rng.chance(weapon.crewHitChance)) {
    const cmsg = damageCrew(target, rng);
    if (cmsg) msgs.push(cmsg);
  }
  if (target.destroyed) msgs.push(`${target.name} wrecked!`);
  for (const m of msgs) pushLog(b, m);
  checkEnd(b, rng);
  return msgs;
}

function performRam(
  b: TacticalBattle,
  rng: SeededRng,
  attacker: TacticalUnit,
  target: TacticalUnit,
): string[] {
  const cfg = tacticalBalance.ram;
  const msgs: string[] = [];
  const dmg = cfg.baseDamage + Math.floor(getVehicleClass(attacker.classId).armor * 2);
  const self = Math.max(1, Math.round(dmg * cfg.selfDamageFraction));
  const arc = hitArc(target.facing, attacker.x, attacker.y, target.x, target.y);
  const dealt = mitigatedDamage(dmg, getVehicleClass(target.classId).armor, arc);
  applyHullDamage(target, dealt);
  applyHullDamage(attacker, self);
  attacker.attacksLeft = Math.max(0, attacker.attacksLeft - 1);
  attacker.actedThisTurn = true;
  msgs.push(`${attacker.name} rams ${target.name} (${dealt} to target, ${self} self).`);
  if (!target.destroyed && rng.chance(cfg.immobilizeChance)) {
    target.immobilized = true;
    target.movesLeft = 0;
    msgs.push(`${target.name} spun out — immobilized.`);
  }
  if (target.destroyed) msgs.push(`${target.name} crushed!`);
  if (attacker.destroyed) msgs.push(`${attacker.name} wrecked in the ram!`);
  for (const m of msgs) pushLog(b, m);
  checkEnd(b, rng);
  return msgs;
}

function performBoard(
  b: TacticalBattle,
  rng: SeededRng,
  attacker: TacticalUnit,
  target: TacticalUnit,
): string[] {
  const cfg = tacticalBalance.board;
  const msgs: string[] = [];
  let chance =
    cfg.baseChance +
    crewCombatSum(attacker) * cfg.combatScale -
    target.crew.filter((c) => c.alive).length * cfg.targetCrewPenalty;
  chance = Math.max(0.05, Math.min(0.9, chance));
  attacker.attacksLeft -= 1;
  attacker.actedThisTurn = true;
  if (rng.chance(chance)) {
    target.captured = true;
    target.immobilized = true;
    target.movesLeft = 0;
    target.attacksLeft = 0;
    msgs.push(`${attacker.name} boards and captures ${target.name}!`);
  } else {
    const cmsg = damageCrew(attacker, rng);
    msgs.push(`${attacker.name} fails to board ${target.name}.`);
    if (cmsg) msgs.push(cmsg);
  }
  for (const m of msgs) pushLog(b, m);
  checkEnd(b, rng);
  return msgs;
}

export function applyTacticalAction(
  battle: TacticalBattle,
  action: TacticalAction,
): TacticalActionResult {
  if (battle.phase === "ended" && action.type !== "select") {
    return fail(battle, "Battle already ended");
  }

  const next = cloneBattle(battle);
  const rng = rngOf(next);
  const messages: string[] = [];

  try {
    switch (action.type) {
      case "select": {
        if (!unitById(next, action.unitId)) throw new Error("Unknown unit");
        next.selectedUnitId = action.unitId;
        break;
      }
      case "deploy": {
        if (next.phase !== "deploy") throw new Error("Not in deploy phase");
        const u = unitById(next, action.unitId);
        if (!u || u.side !== "player") throw new Error("Deploy player unit only");
        const cfg = tacticalBalance;
        if (
          action.y < cfg.playerDeployMinY ||
          action.y > cfg.playerDeployMaxY ||
          !inBounds(next, action.x, action.y)
        ) {
          throw new Error("Outside deploy zone");
        }
        if (occupied(next, action.x, action.y, u.id)) throw new Error("Cell occupied");
        u.x = action.x;
        u.y = action.y;
        u.facing = action.facing ?? defaultFacingForSide("player");
        u.deployed = true;
        messages.push(`Deployed ${u.name} at ${u.x},${u.y}`);
        pushLog(next, messages[0]!);
        break;
      }
      case "assignCrew": {
        if (next.phase !== "deploy") throw new Error("Assign crew during deploy");
        const u = unitById(next, action.unitId);
        if (!u || u.side !== "player") throw new Error("Invalid unit");
        // Move crew slot between player units
        let slot: (typeof u.crew)[number] | undefined;
        for (const other of next.units.filter((x) => x.side === "player")) {
          const idx = other.crew.findIndex((c) => c.crewId === action.crewId);
          if (idx >= 0) {
            slot = other.crew.splice(idx, 1)[0];
            break;
          }
        }
        if (!slot) throw new Error("Crew not found");
        slot.role = action.role;
        u.crew.push(slot);
        messages.push(`Assigned ${slot.name} as ${action.role} on ${u.name}`);
        pushLog(next, messages[0]!);
        break;
      }
      case "autoDeploy": {
        if (next.phase !== "deploy") throw new Error("Not in deploy phase");
        autoDeployPlayer(next, rng);
        messages.push("Convoy auto-deployed.");
        pushLog(next, messages[0]!);
        break;
      }
      case "beginCombat": {
        beginCombat(next);
        messages.push("Combat begun.");
        break;
      }
      case "move": {
        if (next.phase !== "combat" || next.activeSide !== "player") {
          throw new Error("Not player combat turn");
        }
        const u = unitById(next, action.unitId);
        if (!u || u.side !== "player") throw new Error("Invalid unit");
        if (!u.deployed || u.destroyed || u.captured)
          throw new Error("Unit unavailable");
        if (u.immobilized) throw new Error("Immobilized");
        if (u.movesLeft <= 0) throw new Error("No moves left");
        if (!inBounds(next, action.x, action.y)) throw new Error("Out of bounds");
        if (manhattan(u.x, u.y, action.x, action.y) !== 1) {
          throw new Error("Move one orthogonal step");
        }
        if (occupied(next, action.x, action.y, u.id)) throw new Error("Cell occupied");
        u.facing = rotateToward(u.x, u.y, action.x, action.y);
        u.x = action.x;
        u.y = action.y;
        u.movesLeft -= 1;
        messages.push(`${u.name} → ${u.x},${u.y}`);
        pushLog(next, messages[0]!);
        break;
      }
      case "rotate": {
        const u = unitById(next, action.unitId);
        if (!u || u.side !== "player") throw new Error("Invalid unit");
        if (next.phase === "combat" && next.activeSide !== "player") {
          throw new Error("Not player turn");
        }
        u.facing = action.facing;
        messages.push(`${u.name} faces ${action.facing}`);
        break;
      }
      case "shoot": {
        if (next.phase !== "combat" || next.activeSide !== "player") {
          throw new Error("Not player combat turn");
        }
        const u = unitById(next, action.unitId);
        const t = unitById(next, action.targetId);
        if (!u || !t) throw new Error("Invalid units");
        if (u.side !== "player" || t.side !== "enemy") throw new Error("Invalid shot");
        if (u.attacksLeft <= 0) throw new Error("No attacks left");
        if (u.destroyed || t.destroyed || t.captured) throw new Error("Invalid target");
        const weaponId = action.weaponId ?? u.weapons[0];
        if (!weaponId) throw new Error("No weapon");
        const weapon = getWeapon(weaponId);
        if (manhattan(u.x, u.y, t.x, t.y) > weapon.range)
          throw new Error("Out of range");
        messages.push(...performShoot(next, rng, u, t, weaponId));
        break;
      }
      case "ram": {
        if (next.phase !== "combat" || next.activeSide !== "player") {
          throw new Error("Not player combat turn");
        }
        const u = unitById(next, action.unitId);
        const t = unitById(next, action.targetId);
        if (!u || !t) throw new Error("Invalid units");
        if (!isAdjacent(u.x, u.y, t.x, t.y)) throw new Error("Ram requires adjacency");
        if (u.immobilized) throw new Error("Immobilized");
        messages.push(...performRam(next, rng, u, t));
        break;
      }
      case "board": {
        if (next.phase !== "combat" || next.activeSide !== "player") {
          throw new Error("Not player combat turn");
        }
        const u = unitById(next, action.unitId);
        const t = unitById(next, action.targetId);
        if (!u || !t) throw new Error("Invalid units");
        if (!isAdjacent(u.x, u.y, t.x, t.y))
          throw new Error("Board requires adjacency");
        if (t.destroyed) throw new Error("Cannot board wreck");
        messages.push(...performBoard(next, rng, u, t));
        break;
      }
      case "endTurn": {
        if (next.phase !== "combat" || next.activeSide !== "player") {
          throw new Error("Not player combat turn");
        }
        next.activeSide = "enemy";
        messages.push("Enemy turn…");
        pushLog(next, messages[0]!);
        messages.push(...runEnemyAi(next, rng));
        break;
      }
      case "fleeQuick": {
        // Abort to defeat-ish draw — player flees, no salvage
        next.phase = "ended";
        next.result = {
          winner: "enemy",
          report: {
            outcomeId: "tactical-flee",
            title: "Fled the road",
            summary: `${next.encounterName} — fled tactical fight.`,
            playerScore: 0,
            enemyScore: 1,
            ratio: 0.2,
            lines: ["Convoy punched out of the scrap."],
          },
          salvage: [],
          survivingPlayerVehicleIds: aliveUnits(next, "player")
            .map((u) => u.sourceVehicleId)
            .filter((id): id is string => Boolean(id)),
          deadCrewIds: [],
          damagedVehicles: next.units
            .filter((u) => u.side === "player" && u.sourceVehicleId)
            .map((u) => ({ id: u.sourceVehicleId!, durability: u.hull })),
        };
        messages.push("Fled the battlefield.");
        pushLog(next, messages[0]!);
        break;
      }
      default: {
        const _e: never = action;
        throw new Error(`Unknown tactical action ${JSON.stringify(_e)}`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(battle, message);
  }

  sync(next, rng);
  return { ok: true, battle: next, messages };
}

export function facingLabel(f: Facing): string {
  return ["N", "E", "S", "W"][f]!;
}
