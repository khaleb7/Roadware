import Phaser from "phaser";
import { VERSION, WORKING_TITLE } from "../config";

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: "MainMenu" });
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0b0d10);
    this.add.rectangle(width / 2, height * 0.62, width, 2, 0x2a2318, 0.6);

    this.add
      .text(width / 2, height * 0.38, WORKING_TITLE, {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "56px",
        color: "#e6d3a3",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.48, "Convoy strategy — strategic map online", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#9aa3ad",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.72, "Press any key to roll out of Denver", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#6b737c",
      })
      .setOrigin(0.5);

    this.add
      .text(16, height - 28, `v${VERSION}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: "#4a525a",
      })
      .setOrigin(0, 0.5);

    this.input.keyboard?.once("keydown", () => {
      this.scene.start("StrategicMap", { seed: 2026 });
    });
  }
}
