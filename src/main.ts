import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, WORKING_TITLE } from "./config";
import { BootScene } from "./scenes/BootScene";
import { MainMenuScene } from "./scenes/MainMenuScene";

document.title = WORKING_TITLE;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#0b0d10",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MainMenuScene],
};

const game = new Phaser.Game(config);

// Retain reference for debugging / future hot-dispose hooks
void game;
