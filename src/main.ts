import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, WORKING_TITLE } from "./config";
import { BootScene } from "./scenes/BootScene";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { StrategicMapScene } from "./scenes/StrategicMapScene";
import { TacticalCombatScene } from "./scenes/TacticalCombatScene";

document.title = WORKING_TITLE;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#0b0d10",
  scale: {
    // Resolution-independent 1080p logical target
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MainMenuScene, SettingsScene, StrategicMapScene, TacticalCombatScene],
};

const game = new Phaser.Game(config);

void game;
