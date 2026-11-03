import Phaser from "phaser";
import { WORKING_TITLE } from "../config";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "Boot" });
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2, WORKING_TITLE, {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "28px",
        color: "#c8b48a",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 40, "Loading…", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: "#8a9099",
      })
      .setOrigin(0.5);

    this.time.delayedCall(400, () => {
      this.scene.start("MainMenu");
    });
  }
}
