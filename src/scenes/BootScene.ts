import Phaser from "phaser";
import { registerProceduralTextures } from "../art/procedural";
import { WORKING_TITLE } from "../config";
import { PALETTE, PALETTE_CSS } from "../art/palette";
import { loadSettings, applyDisplaySettings } from "../persistence/settingsStore";
import { setAudioVolumes } from "../audio/procedural";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "Boot" });
  }

  preload(): void {
    // SVG icons / vehicles from assets (served from project root in Vite)
    const svgs = [
      "icon-food",
      "icon-fuel",
      "icon-gun",
      "icon-crew",
      "veh-bike",
      "veh-hardtop",
      "veh-hauler",
      "veh-bus",
      "veh-tanker",
      "veh-armored",
    ];
    for (const key of svgs) {
      this.load.svg(key, `svg/${key}.svg`);
    }
    this.load.json("asset-manifest", "manifest.json");
  }

  create(): void {
    registerProceduralTextures(this.textures);

    const { width, height } = this.scale;

    if (this.textures.exists("tex-map-dust")) {
      this.add.image(width / 2, height / 2, "tex-map-dust").setDisplaySize(width, height);
    } else {
      this.add.rectangle(width / 2, height / 2, width, height, PALETTE.night);
    }

    this.add
      .text(width / 2, height / 2, WORKING_TITLE, {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "36px",
        color: PALETTE_CSS.amber,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 48, "Loading convoy systems…", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: PALETTE_CSS.chrome,
      })
      .setOrigin(0.5);

    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    const settings = await loadSettings();
    this.registry.set("settings", settings);
    setAudioVolumes(settings.masterVolume, settings.sfxVolume);
    await applyDisplaySettings(settings);

    this.time.delayedCall(350, () => {
      this.scene.start("MainMenu");
    });
  }
}
