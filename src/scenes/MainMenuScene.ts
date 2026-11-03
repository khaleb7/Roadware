import Phaser from "phaser";
import { playSfx, resumeAudio } from "../audio/procedural";
import { PALETTE, PALETTE_CSS } from "../art/palette";
import { VERSION, WORKING_TITLE } from "../config";
import { listDifficulties, type DifficultyId } from "../core/difficulty";
import { listSaveSlots, readSave } from "../persistence/save";
import { AUTOSAVE_SLOT, type SaveSlotMeta } from "../persistence/types";
import type { GameSettings } from "../settings/types";

type MenuMode = "root" | "difficulty" | "load" | "settings";

export class MainMenuScene extends Phaser.Scene {
  private mode: MenuMode = "root";
  private slots: SaveSlotMeta[] = [];
  private hintText!: Phaser.GameObjects.Text;
  private lines: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: "MainMenu" });
  }

  create(): void {
    void resumeAudio();
    const { width, height } = this.scale;

    if (this.textures.exists("tex-map-dust")) {
      this.add.image(width / 2, height / 2, "tex-map-dust").setDisplaySize(width, height);
    } else {
      this.add.rectangle(width / 2, height / 2, width, height, PALETTE.night);
    }

    this.add.rectangle(width / 2, height * 0.58, width * 0.7, 2, PALETTE.rust, 0.55);

    this.add
      .text(width / 2, height * 0.22, WORKING_TITLE, {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "64px",
        color: PALETTE_CSS.amber,
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.3, "Convoy strategy — rust roads, remnant hope", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: PALETTE_CSS.sand,
      })
      .setOrigin(0.5);

    // Vehicle parade
    const vehKeys = ["veh-hardtop", "veh-hauler", "veh-bike", "veh-armored"];
    vehKeys.forEach((key, i) => {
      if (!this.textures.exists(key)) return;
      this.add
        .image(width * 0.28 + i * 140, height * 0.42, key)
        .setScale(1.4)
        .setAlpha(0.9);
    });

    this.hintText = this.add
      .text(width / 2, height * 0.92, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: PALETTE_CSS.chrome,
        align: "center",
      })
      .setOrigin(0.5);

    this.add
      .text(16, height - 28, `v${VERSION}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: "#4a525a",
      })
      .setOrigin(0, 0.5);

    this.input.keyboard?.on("keydown", (ev: KeyboardEvent) => {
      void this.onKey(ev.key.toLowerCase());
    });

    void this.showRoot();
  }

  private clearLines(): void {
    for (const g of this.lines) g.destroy();
    this.lines = [];
  }

  private addMenuButton(
    y: number,
    label: string,
    onClick: () => void,
  ): void {
    const { width } = this.scale;
    const text = this.add
      .text(width / 2, y, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
        color: PALETTE_CSS.sand,
        backgroundColor: "#1a1c1ecc",
        padding: { x: 16, y: 8 },
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
  }

  private async showRoot(): Promise<void> {
    this.mode = "root";
    this.clearLines();
    this.hintText.setText("Mouse or keys: N new · C continue · L load · O settings · Esc quit tip");
    let y = this.scale.height * 0.55;
    this.addMenuButton(y, "New Game", () => void this.showDifficulty());
    y += 52;
    this.addMenuButton(y, "Continue (autosave)", () => void this.continueAutosave());
    y += 52;
    this.addMenuButton(y, "Load Game", () => void this.showLoad());
    y += 52;
    this.addMenuButton(y, "Settings", () => void this.showSettings());
  }

  private async showDifficulty(): Promise<void> {
    this.mode = "difficulty";
    this.clearLines();
    this.hintText.setText("Choose difficulty — Classic or Road-Weary");
    let y = this.scale.height * 0.55;
    for (const d of listDifficulties()) {
      this.addMenuButton(y, `${d.label} — ${d.blurb}`, () => {
        playSfx("ui-confirm");
        this.scene.start("StrategicMap", {
          seed: Date.now() % 1_000_000,
          difficulty: d.id as DifficultyId,
        });
      });
      y += 56;
    }
    this.addMenuButton(y + 8, "Back", () => void this.showRoot());
  }

  private async showLoad(): Promise<void> {
    this.mode = "load";
    this.clearLines();
    this.slots = await listSaveSlots();
    this.hintText.setText("Click a slot · 0 is autosave");
    let y = this.scale.height * 0.52;
    for (const slot of this.slots) {
      const label = slot.occupied
        ? `Slot ${slot.slot}: ${slot.label ?? "Save"} · T${slot.turn} · ${slot.difficulty}`
        : `Slot ${slot.slot}: (empty)`;
      this.addMenuButton(y, label, () => void this.loadSlot(slot.slot));
      y += 48;
    }
    this.addMenuButton(y + 8, "Back", () => void this.showRoot());
  }

  private async showSettings(): Promise<void> {
    this.mode = "settings";
    this.clearLines();
    const settings = (this.registry.get("settings") as GameSettings | undefined) ?? {
      fullscreen: false,
      masterVolume: 0.7,
      sfxVolume: 0.8,
      musicVolume: 0.5,
      showTutorialTips: true,
      showStatTooltips: true,
      autosave: true,
      targetWidth: 1920,
      targetHeight: 1080,
    };
    this.hintText.setText("Display targets 1080p logical; window scales with FIT");
    let y = this.scale.height * 0.52;
    this.addMenuButton(
      y,
      `Fullscreen: ${settings.fullscreen ? "ON" : "OFF"}`,
      () => {
        void this.scene.start("Settings");
      },
    );
    y += 52;
    this.addMenuButton(y, "Open full settings…", () => this.scene.start("Settings"));
    y += 52;
    this.addMenuButton(y, "Back", () => void this.showRoot());
  }

  private async continueAutosave(): Promise<void> {
    await this.loadSlot(AUTOSAVE_SLOT);
  }

  private async loadSlot(slot: number): Promise<void> {
    const file = await readSave(slot);
    if (!file) {
      this.hintText.setText(`Slot ${slot} is empty`);
      playSfx("ui-cancel");
      return;
    }
    playSfx("ui-confirm");
    this.registry.set("loadedSave", file);
    this.scene.start("StrategicMap", { loadSlot: slot });
  }

  private async onKey(key: string): Promise<void> {
    if (this.mode === "root") {
      if (key === "n") await this.showDifficulty();
      if (key === "c") await this.continueAutosave();
      if (key === "l") await this.showLoad();
      if (key === "o" || key === "s") this.scene.start("Settings");
    } else if (key === "escape" || key === "backspace") {
      await this.showRoot();
    }
  }
}
