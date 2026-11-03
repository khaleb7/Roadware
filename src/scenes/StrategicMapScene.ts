import Phaser from "phaser";
import { playSfx } from "../audio/procedural";
import { PALETTE, PALETTE_CSS } from "../art/palette";
import { WORKING_TITLE } from "../config";
import type { DifficultyId } from "../core/difficulty";
import type { EncounterAction, GameCommand, GameState } from "../core";
import { Game } from "../core/game";
import { autosave, writeSave } from "../persistence/save";
import type { SaveFile } from "../persistence/types";
import type { GameSettings } from "../settings/types";
import {
  destroyStatusOverlay,
  renderStatusOverlay,
  setOverlayCallbacks,
} from "../ui/statusOverlay";

/**
 * Strategic map shell — stylized procedural backdrop + status overlay (mouse-first).
 */
export class StrategicMapScene extends Phaser.Scene {
  private sim!: Game;
  private settings!: GameSettings;

  constructor() {
    super({ key: "StrategicMap" });
  }

  init(data: {
    seed?: number;
    difficulty?: DifficultyId;
    loadSlot?: number;
  }): void {
    const loaded = this.registry.get("loadedSave") as SaveFile | undefined;
    if (loaded && data.loadSlot !== undefined) {
      this.sim = new Game(loaded.state);
      this.registry.set("loadedSave", undefined);
      this.registry.set("sim", this.sim);
      return;
    }

    const existing = this.registry.get("sim") as Game | undefined;
    if (existing && data.seed === undefined && data.difficulty === undefined) {
      this.sim = existing;
    } else {
      this.sim = Game.newGame(data.seed ?? 2026, data.difficulty ?? "classic");
      this.registry.set("sim", this.sim);
    }
  }

  create(): void {
    const { width, height } = this.scale;
    this.settings =
      (this.registry.get("settings") as GameSettings | undefined) ??
      ({
        fullscreen: false,
        masterVolume: 0.7,
        sfxVolume: 0.8,
        musicVolume: 0.5,
        showTutorialTips: true,
        showStatTooltips: true,
        autosave: true,
        targetWidth: 1920,
        targetHeight: 1080,
      } satisfies GameSettings);

    if (this.textures.exists("tex-map-dust")) {
      this.add.image(width / 2, height / 2, "tex-map-dust").setDisplaySize(width, height);
    } else {
      this.add.rectangle(width / 2, height / 2, width, height, PALETTE.night);
    }

    // Stylized city node strip
    if (this.textures.exists("tex-city-node")) {
      for (let i = 0; i < 7; i++) {
        const x = width * 0.18 + i * (width * 0.11);
        const y = height * 0.62 + Math.sin(i * 1.1) * 28;
        this.add.image(x, y, "tex-city-node").setScale(0.9).setAlpha(0.85);
        if (i < 6 && this.textures.exists("tex-road")) {
          this.add
            .image(x + width * 0.055, y, "tex-road")
            .setDisplaySize(width * 0.09, 10)
            .setAlpha(0.5);
        }
      }
    }

    // Convoy silhouette
    if (this.textures.exists("veh-hardtop")) {
      this.add.image(width * 0.5, height * 0.72, "veh-hardtop").setScale(1.6);
    } else if (this.textures.exists("tex-veh-hardtop")) {
      this.add.image(width * 0.5, height * 0.72, "tex-veh-hardtop").setScale(1.8);
    }

    this.add
      .text(width / 2, 36, WORKING_TITLE, {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "26px",
        color: PALETTE_CSS.amber,
      })
      .setOrigin(0.5, 0);

    if (this.sim.getState().tacticalBattle) {
      this.scene.start("TacticalCombat");
      return;
    }

    setOverlayCallbacks({
      settings: this.settings,
      onStage: (cmd, label) => this.stageCommand(cmd, label),
      onConfirm: () => void this.confirmStaged(),
      onUndo: () => this.undoStaged(),
      onRefresh: () => renderStatusOverlay(this.sim),
      onSave: () => void this.manualSave(),
      onOpenSettings: () => {
        destroyStatusOverlay();
        this.scene.start("Settings", { returnScene: "StrategicMap" });
      },
    });

    renderStatusOverlay(this.sim);

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      this.handleKey(event.key.toLowerCase(), event);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      destroyStatusOverlay();
    });
  }

  private stageCommand(command: GameCommand, label: string): void {
    // Resolve extract shortcut without id from keyboard path
    if (command.type === "extractScientist" && !command.scientistId) {
      const status = this.sim.dispatch({ type: "status" }).status;
      const target = status?.campaign.scientistsHere.find(
        (s) => s.revealed && !s.aboard && !s.delivered,
      );
      if (!target) return;
      command = { type: "extractScientist", scientistId: target.id };
      label = `Extract ${target.name}`;
    }
    this.sim.stage(command, label);
    playSfx("ui-click");
    if (command.type === "move") playSfx("engine");
    renderStatusOverlay(this.sim);
  }

  private undoStaged(): void {
    this.sim.undoStage();
    playSfx("ui-cancel");
    renderStatusOverlay(this.sim);
  }

  private async confirmStaged(): Promise<void> {
    const staged = this.sim.getStaged();
    if (!staged) return;
    const isFight = staged.command.type === "resolveEncounter";
    const result = this.sim.confirmStage();
    if (!result) return;
    if (!result.ok) {
      console.warn(result.error);
      playSfx("ui-cancel");
    } else {
      playSfx("ui-confirm");
      if (isFight && staged.command.type === "resolveEncounter" && staged.command.action === "fight") {
        playSfx("gunfire");
      }
      if (result.turnAdvanced && this.settings.autosave) {
        await autosave(this.sim.getState() as GameState);
      }
    }
    if (this.sim.getState().tacticalBattle) {
      destroyStatusOverlay();
      this.scene.start("TacticalCombat");
      return;
    }
    renderStatusOverlay(this.sim);
  }

  private async manualSave(): Promise<void> {
    await writeSave(this.sim.getState() as GameState, 1, "Manual save");
    playSfx("ui-confirm");
    renderStatusOverlay(this.sim);
  }

  private openSettings(): void {
    destroyStatusOverlay();
    this.scene.start("Settings", { returnScene: "StrategicMap" });
  }

  private handleKey(key: string, event: KeyboardEvent): void {
    if (key === "enter") {
      void this.confirmStaged();
      return;
    }
    if (key === "o") {
      this.openSettings();
      return;
    }
    if (key === "u" || key === "escape") {
      this.undoStaged();
      return;
    }

    const resolveKeys: Record<string, EncounterAction> = {
      e: "evade",
      n: "negotiate",
      t: "trade",
    };
    if (key === "f") {
      this.stageCommand(
        { type: "resolveEncounter", action: "fight", mode: "quick" },
        "Quick fight",
      );
      return;
    }
    if (key === "v") {
      this.stageCommand(
        { type: "resolveEncounter", action: "fight", mode: "tactical" },
        "Tactical fight",
      );
      return;
    }
    if (resolveKeys[key]) {
      this.stageCommand(
        { type: "resolveEncounter", action: resolveKeys[key]! },
        resolveKeys[key]!,
      );
      return;
    }

    switch (key) {
      case "s":
        if (event.shiftKey) {
          this.openSettings();
          break;
        }
        renderStatusOverlay(this.sim);
        break;
      case "1":
        this.stageCommand({ type: "search" }, "Search");
        break;
      case "2":
        this.stageCommand({ type: "loot" }, "Loot");
        break;
      case "3":
        this.stageCommand({ type: "rest" }, "Rest");
        break;
      case "4":
        this.stageCommand({ type: "attack" }, "Attack");
        break;
      case "x":
        this.stageCommand({ type: "extractScientist", scientistId: "" }, "Extract");
        break;
      case "d":
        this.stageCommand({ type: "deliverScientists" }, "Deliver scientists");
        break;
      case "m": {
        const status = this.sim.dispatch({ type: "status" }).status;
        const first = status?.neighbors[0];
        if (first) {
          this.stageCommand(
            { type: "move", destinationId: first.id },
            `Move to ${first.name}`,
          );
        }
        break;
      }
      default:
        break;
    }
  }
}
