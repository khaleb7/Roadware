/** Stat / action tooltip copy for mouse hover and tutorial tips. */
export const STAT_TOOLTIPS: Record<string, string> = {
  food: "Rations burned each turn per living crew. Starve and they desert.",
  fuel: "Spent on road moves. No fuel strands the convoy.",
  tires: "Wear on long hauls. Zero tires blocks movement.",
  medicine: "Spent to heal wounded crew.",
  guns: "Needed for city attacks and some extractions.",
  ammunition: "Burned in fights. Empty mags mean ugly odds.",
  spareParts: "Spent to repair vehicle durability.",
  crew: "Living gang members. Zero crew is a loss.",
  vehicles: "Road iron under the cap from balance data.",
  hunger: "Turns short on food. Triggers desertion rolls.",
  danger: "City heat — raises road encounter odds.",
  campaign: "Survive until the remnant briefs you, then deliver eight scientists.",
  difficulty: "Classic is baseline. Road-Weary thins scrap and shortens the clock.",
};

export const TUTORIAL_TIPS: string[] = [
  "Click an action button or use keys — mouse-first, keys still work.",
  "Stage a move or fight choice, then Confirm (Enter) or Undo (U) before the turn commits.",
  "Search cities to reveal loot, factions, and scientists.",
  "After remnant contact, extract scientists (X) and deliver them at the bunker (D).",
  "Autosave writes every turn (slot 0). Manual saves live in Settings / Load.",
  "Hover resource labels for tooltips. Toggle tips in Settings.",
];

export function tipForTurn(turn: number): string {
  return TUTORIAL_TIPS[Math.max(0, turn - 1) % TUTORIAL_TIPS.length]!;
}
