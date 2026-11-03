import Phaser from "phaser";
import { playSfx, setAudioVolumes } from "../audio/procedural";
import { PALETTE, PALETTE_CSS } from "../art/palette";
import { WORKING_TITLE } from "../config";
import {
  applyDisplaySettings,
  loadSettings,
  saveSettings,
} from "../persistence/settingsStore";
import type { GameSettings } from "../settings/types";

/**
 * Windowed / fullscreen + audio + tutorial toggles.
 * Logical resolution stays 1080p (GAME_WIDTH/HEIGHT); Phaser FIT scales the canvas.
 */
export class SettingsScene extends Phaser.Scene {
  private settings!: GameSettings;
  private lines: Phaser.GameObjects.GameObject[] = [];
  /** Scene to resume on Back — MainMenu by default, StrategicMap when opened mid-run. */
  private returnScene: string = "MainMenu";

  constructor() {
    super({ key: "Settings" });
  }

  init(data?: { returnScene?: string }): void {
    this.returnScene = data?.returnScene ?? "MainMenu";
  }

  create(): void {
    void this.boot();
  }

  private async boot(): Promise<void> {
    this.settings = await loadSettings();
    this.registry.set("settings", this.settings);
    this.redraw();
  }

  private goBack(): void {
    playSfx("ui-cancel");
    this.scene.start(this.returnScene);
  }

  private clear(): void {
    for (const g of this.lines) g.destroy();
    this.lines = [];
  }

  private redraw(): void {
    this.clear();
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, PALETTE.night);
    if (this.textures.exists("tex-map-dust")) {
      this.add
        .image(width / 2, height / 2, "tex-map-dust")
        .setDisplaySize(width, height)
        .setAlpha(0.55);
    }

    const title = this.add
      .text(width / 2, 80, `${WORKING_TITLE} — Settings`, {
        fontFamily: "Georgia, serif",
        fontSize: "36px",
        color: PALETTE_CSS.amber,
      })
      .setOrigin(0.5);
    this.lines.push(title);

    const note = this.add
      .text(
        width / 2,
        130,
        `Logical target ${this.settings.targetWidth}×${this.settings.targetHeight} (FIT scale — resolution independent)`,
        {
          fontFamily: "system-ui",
          fontSize: "14px",
          color: PALETTE_CSS.chrome,
        },
      )
      .setOrigin(0.5);
    this.lines.push(note);

    let y = 220;
    y = this.toggle(y, `Fullscreen: ${this.settings.fullscreen ? "ON" : "OFF"}`, async () => {
      this.settings.fullscreen = !this.settings.fullscreen;
      await applyDisplaySettings(this.settings);
      await this.persist();
      this.redraw();
    });
    y = this.toggle(y, `Autosave each turn: ${this.settings.autosave ? "ON" : "OFF"}`, async () => {
      this.settings.autosave = !this.settings.autosave;
      await this.persist();
      this.redraw();
    });
    y = this.toggle(
      y,
      `Tutorial tips: ${this.settings.showTutorialTips ? "ON" : "OFF"}`,
      async () => {
        this.settings.showTutorialTips = !this.settings.showTutorialTips;
        await this.persist();
        this.redraw();
      },
    );
    y = this.toggle(
      y,
      `Stat tooltips: ${this.settings.showStatTooltips ? "ON" : "OFF"}`,
      async () => {
        this.settings.showStatTooltips = !this.settings.showStatTooltips;
        await this.persist();
        this.redraw();
      },
    );
    y = this.toggle(y, `Master volume: ${Math.round(this.settings.masterVolume * 100)}%  (+/-)`, () => {
      /* keyboard handles */
    });
    y = this.toggle(y, `SFX volume: ${Math.round(this.settings.sfxVolume * 100)}%  ([ / ]`, () => {
      /* keyboard handles */
    });

    const backLabel =
      this.returnScene === "StrategicMap" ? "Back to convoy [Esc]" : "Back to menu [Esc]";
    this.toggle(y + 40, backLabel, () => this.goBack());

    this.input.keyboard?.off("keydown");
    this.input.keyboard?.on("keydown", (ev: KeyboardEvent) => {
      void this.onKey(ev.key.toLowerCase());
    });
  }

  private toggle(y: number, label: string, onClick: () => void): number {
    const { width } = this.scale;
    const text = this.add
      .text(width / 2, y, label, {
        fontFamily: "system-ui",
        fontSize: "20px",
        color: PALETTE_CSS.sand,
        backgroundColor: "#1a1c1ecc",
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    text.on("pointerover", () => text.setColor(PALETTE_CSS.amber));
    text.on("pointerout", () => text.setColor(PALETTE_CSS.sand));
    text.on("pointerdown", () => {
      playSfx("ui-click");
      onClick();
    });
    this.lines.push(text);
    return y + 52;
  }

  private async persist(): Promise<void> {
    this.registry.set("settings", this.settings);
    setAudioVolumes(this.settings.masterVolume, this.settings.sfxVolume);
    await saveSettings(this.settings);
  }

  private async onKey(key: string): Promise<void> {
    if (key === "escape" || key === "backspace") {
      this.goBack();
      return;
    }
    if (key === "=" || key === "+") {
      this.settings.masterVolume = Math.min(1, this.settings.masterVolume + 0.1);
      await this.persist();
      this.redraw();
    }
    if (key === "-" || key === "_") {
      this.settings.masterVolume = Math.max(0, this.settings.masterVolume - 0.1);
      await this.persist();
      this.redraw();
    }
    if (key === "]") {
      this.settings.sfxVolume = Math.min(1, this.settings.sfxVolume + 0.1);
      await this.persist();
      this.redraw();
    }
    if (key === "[") {
      this.settings.sfxVolume = Math.max(0, this.settings.sfxVolume - 0.1);
      await this.persist();
      this.redraw();
    }
    if (key === "f") {
      this.settings.fullscreen = !this.settings.fullscreen;
      await applyDisplaySettings(this.settings);
      await this.persist();
      this.redraw();
    }
  }
}
