export type ScientistStatus = "hidden" | "guarded" | "faction_held";

export type CampaignStage = "survival" | "briefed" | "complete";

export interface ScientistState {
  id: string;
  name: string;
  cityId: string;
  status: ScientistStatus;
  /** Known to the player (found via search). */
  revealed: boolean;
  /** Riding with the convoy. */
  aboard: boolean;
  /** Safely dropped at the bunker. */
  delivered: boolean;
}

export interface CampaignState {
  stage: CampaignStage;
  contactedFederal: boolean;
  bunkerCityId: string;
  /** Set after federal contact when deadline.enabled. */
  deadlineTurn: number | null;
  leaderCrewId: string;
  scientists: ScientistState[];
}

export interface CampaignStatusView {
  stage: CampaignStage;
  contactedFederal: boolean;
  bunkerCityId: string | null;
  bunkerName: string | null;
  deadlineTurn: number | null;
  turnsRemaining: number | null;
  scientistsTotal: number;
  scientistsRevealed: number;
  scientistsAboard: number;
  scientistsDelivered: number;
  gangStrength: number;
  strengthThreshold: number;
  scientistsHere: Array<{
    id: string;
    name: string;
    status: ScientistStatus;
    revealed: boolean;
    aboard: boolean;
    delivered: boolean;
  }>;
}
