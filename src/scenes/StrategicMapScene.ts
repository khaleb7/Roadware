import Phaser from "phaser";
import { WORKING_TITLE } from "../config";
import type { EncounterAction, FightMode, GameCommand } from "../core";
import { Game } from "../core/game";
import { destroyStatusOverlay, renderStatusOverlay } from "../ui/statusOverlay";

/**
 * Strategic map shell — launches tactical scene when a road fight goes tactical.
 */
export class StrategicMapScene extends Phaser.Scene {
  private sim!: Game;

  constructor() {
    super({ key: "StrategicMap" });
  }

  init(data: { seed?: number }): void {
    const existing = this.registry.get("sim") as Game | undefined;
    if (existing && data.seed === undefined) {
      this.sim = existing;
    } else {
      this.sim = new Game(data.seed ?? 2026);
      this.registry.set("sim", this.sim);
    }
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x0b0d10);
    this.add
      .text(width / 2, 28, WORKING_TITLE, {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "22px",
        color: "#c8b48a",
      })
      .setOrigin(0.5, 0);

    this.add
      .text(width / 2, height * 0.55, "Roads & encounters — status overlay active", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#6b737c",
      })
      .setOrigin(0.5);

    // Resume mid-tactical if needed
    if (this.sim.getState().tacticalBattle) {
      this.scene.start("TacticalCombat");
      return;
    }

    renderStatusOverlay(this.sim);

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      this.handleKey(event.key.toLowerCase());
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      destroyStatusOverlay();
    });
  }

  private handleKey(key: string): void {
    const resolveKeys: Record<string, EncounterAction> = {
      e: "evade",
      n: "negotiate",
      t: "trade",
    };
    if (key === "f") {
      this.resolveFight("quick");
      return;
    }
    if (key === "v") {
      this.resolveFight("tactical");
      return;
    }
    if (resolveKeys[key]) {
      this.run({ type: "resolveEncounter", action: resolveKeys[key]! });
      return;
    }

    switch (key) {
      case "s":
        renderStatusOverlay(this.sim);
        break;
      case "1":
        this.run({ type: "search" });
        break;
      case "2":
        this.run({ type: "loot" });
        break;
      case "3":
        this.run({ type: "rest" });
        break;
      case "4":
        this.run({ type: "attack" });
        break;
      case "m": {
        const status = this.sim.dispatch({ type: "status" }).status;
        const first = status?.neighbors[0];
        if (first) this.run({ type: "move", destinationId: first.id });
        break;
      }
      default:
        break;
    }
  }

  private resolveFight(mode: FightMode): void {
    this.run({ type: "resolveEncounter", action: "fight", mode });
    if (this.sim.getState().tacticalBattle) {
      destroyStatusOverlay();
      this.scene.start("TacticalCombat");
    }
  }

  private run(command: GameCommand): void {
    const result = this.sim.dispatch(command);
    if (!result.ok) {
      console.warn(result.error);
    }
    renderStatusOverlay(this.sim);
  }
}
