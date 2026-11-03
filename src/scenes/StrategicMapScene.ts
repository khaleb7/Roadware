import Phaser from "phaser";
import { WORKING_TITLE } from "../config";
import type { EncounterAction, GameCommand } from "../core";
import { Game } from "../core/game";
import { destroyStatusOverlay, renderStatusOverlay } from "../ui/statusOverlay";

/**
 * Thin Phaser shell — map/status/encounter interaction via HTML overlay.
 */
export class StrategicMapScene extends Phaser.Scene {
  private sim!: Game;

  constructor() {
    super({ key: "StrategicMap" });
  }

  init(data: { seed?: number }): void {
    this.sim = new Game(data.seed ?? 2026);
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
      f: "fight",
      e: "evade",
      n: "negotiate",
      t: "trade",
    };
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

  private run(command: GameCommand): void {
    const result = this.sim.dispatch(command);
    if (!result.ok) {
      console.warn(result.error);
    }
    renderStatusOverlay(this.sim);
  }
}
