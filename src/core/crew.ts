import { balance } from "./data";
import type { CrewMember, SpecialistId } from "./types";

export function hasSpecialist(crew: readonly CrewMember[], id: SpecialistId): boolean {
  return crew.some((c) => c.specialist === id && c.health > 0);
}

export function livingCrew(crew: readonly CrewMember[]): CrewMember[] {
  return crew.filter((c) => c.health > 0);
}

export function findCrew(
  crew: readonly CrewMember[],
  id: string,
): CrewMember | undefined {
  return crew.find((c) => c.id === id);
}

/** Apply XP and convert banked XP into rating gains using data thresholds. */
export function grantXp(
  member: CrewMember,
  amount: number,
  banks: { combat?: number; survival?: number; leadership?: number } = {},
): string[] {
  const notes: string[] = [];
  if (amount <= 0) return notes;

  member.xp += amount;
  member.combatXpBank += banks.combat ?? amount;
  member.survivalXpBank += banks.survival ?? amount;
  member.leadershipXpBank += banks.leadership ?? Math.floor(amount / 2);

  const xp = balance.experience;
  const max = xp.maxRating;
  const gain = xp.ratingGain;

  while (member.combatXpBank >= xp.xpPerCombatRating && member.combat < max) {
    member.combatXpBank -= xp.xpPerCombatRating;
    member.combat = Math.min(max, member.combat + gain);
    notes.push(`${member.name} combat +${gain}`);
  }
  while (member.survivalXpBank >= xp.xpPerSurvivalRating && member.survival < max) {
    member.survivalXpBank -= xp.xpPerSurvivalRating;
    member.survival = Math.min(max, member.survival + gain);
    notes.push(`${member.name} survival +${gain}`);
  }
  while (
    member.leadershipXpBank >= xp.xpPerLeadershipRating &&
    member.leadership < max
  ) {
    member.leadershipXpBank -= xp.xpPerLeadershipRating;
    member.leadership = Math.min(max, member.leadership + gain);
    notes.push(`${member.name} leadership +${gain}`);
  }

  return notes;
}

export function grantXpToAll(
  crew: CrewMember[],
  amount: number,
  banks?: { combat?: number; survival?: number; leadership?: number },
): string[] {
  return livingCrew(crew).flatMap((c) => grantXp(c, amount, banks));
}

export function clampHealth(member: CrewMember): void {
  member.health = Math.max(
    balance.crewDefaults.minHealth,
    Math.min(balance.crewDefaults.maxHealth, member.health),
  );
}
