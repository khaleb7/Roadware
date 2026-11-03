import Phaser from "phaser";
import { WORKING_TITLE } from "../config";
import type { Game } from "../core/game";
import { facingLabel } from "../core/tactical/actions";
import type {
  TacticalAction,
  TacticalBattle,
  TacticalUnit,
} from "../core/tactical/types";

const CELL = 36;

/**
 * Top-down orthogonal road fight. Core rules live in src/core/tactical;
 * this scene is a thin controller + renderer.
 */
export class TacticalCombatScene extends Phaser.Scene {
  private sim!: Game;
  private statusText!: Phaser.GameObjects.Text;
  private gridGfx!: Phaser.GameObjects.Graphics;
  private unitTexts: Phaser.GameObjects.Text[] = [];
  private selectedId: string | null = null;

  constructor() {
    super({ key: "TacticalCombat" });
  }

  create(): void {
    this.sim = this.registry.get("sim") as Game;
    if (!this.sim?.getState().tacticalBattle) {
      this.scene.start("StrategicMap");
      return;
    }

    const { width } = this.scale;
    this.add.rectangle(
      width / 2,
      this.scale.height / 2,
      width,
      this.scale.height,
      0x12151a,
    );
    this.add
      .text(16, 10, `${WORKING_TITLE} — Tactical`, {
        fontFamily: "Georgia, serif",
        fontSize: "18px",
        color: "#e6d3a3",
      })
      .setOrigin(0, 0);

    this.gridGfx = this.add.graphics();
    this.statusText = this.add
      .text(16, this.scale.height - 110, "", {
        fontFamily: "ui-monospace, monospace",
        fontSize: "11px",
        color: "#c8b48a",
        wordWrap: { width: width - 32 },
      })
      .setOrigin(0, 0);

    this.add
      .text(
        16,
        this.scale.height - 28,
        "A autoDeploy · B begin · arrows/click move · F fire · R ram · C board · E end · Q flee · Esc map",
        {
          fontFamily: "system-ui",
          fontSize: "10px",
          color: "#6b737c",
        },
      )
      .setOrigin(0, 0);

    this.input.keyboard?.on("keydown", (ev: KeyboardEvent) => this.onKey(ev));
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onClick(p));

    this.redraw();
  }

  private battle(): TacticalBattle | null {
    return this.sim.getState().tacticalBattle;
  }

  private dispatchTac(action: TacticalAction): void {
    const result = this.sim.dispatch({ type: "tactical", action });
    if (!result.ok) console.warn(result.error);
    if (!this.sim.getState().tacticalBattle) {
      this.scene.start("StrategicMap");
      return;
    }
    this.redraw();
  }

  private redraw(): void {
    const b = this.battle();
    if (!b) return;
    this.gridGfx.clear();
    for (const t of this.unitTexts) t.destroy();
    this.unitTexts = [];

    const ox = 40;
    const oy = 48;
    for (let y = 0; y < b.height; y += 1) {
      for (let x = 0; x < b.width; x += 1) {
        const px = ox + x * CELL;
        const py = oy + y * CELL;
        this.gridGfx.lineStyle(1, 0x2a3340, 1);
        this.gridGfx.strokeRect(px, py, CELL, CELL);
      }
    }

    for (const u of b.units.filter((x) => x.deployed && !x.destroyed)) {
      this.drawUnit(u, ox, oy);
    }

    const sel = b.units.find((u) => u.id === (this.selectedId ?? b.selectedUnitId));
    const logTail = b.log.slice(-4).join("\n");
    this.statusText.setText(
      [
        `Phase ${b.phase} · round ${b.round} · ${b.activeSide} · ammo ${b.ammo}`,
        sel
          ? `Selected ${sel.name} @${sel.x},${sel.y} face ${facingLabel(sel.facing)} hull ${sel.hull} tires ${sel.tires} moves ${sel.movesLeft} atk ${sel.attacksLeft}`
          : "Select a unit",
        logTail,
      ].join("\n"),
    );
  }

  private drawUnit(u: TacticalUnit, ox: number, oy: number): void {
    const px = ox + u.x * CELL + CELL / 2;
    const py = oy + u.y * CELL + CELL / 2;
    const color = u.side === "player" ? 0x6a9e6a : u.captured ? 0xc8b48a : 0xa35d5d;
    this.gridGfx.fillStyle(color, u.immobilized ? 0.45 : 0.9);
    this.gridGfx.fillCircle(px, py, 12);
    if (u.id === (this.selectedId ?? this.battle()?.selectedUnitId)) {
      this.gridGfx.lineStyle(2, 0xe6d3a3, 1);
      this.gridGfx.strokeCircle(px, py, 14);
    }
    const label = this.add
      .text(px, py, facingLabel(u.facing), {
        fontSize: "10px",
        color: "#0b0d10",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.unitTexts.push(label);
  }

  private onClick(p: Phaser.Input.Pointer): void {
    const b = this.battle();
    if (!b) return;
    const ox = 40;
    const oy = 48;
    const x = Math.floor((p.x - ox) / CELL);
    const y = Math.floor((p.y - oy) / CELL);
    if (x < 0 || y < 0 || x >= b.width || y >= b.height) return;

    const hit = b.units.find(
      (u) => u.deployed && !u.destroyed && u.x === x && u.y === y,
    );
    if (hit) {
      this.selectedId = hit.id;
      this.dispatchTac({ type: "select", unitId: hit.id });
      return;
    }

    const selId = this.selectedId ?? b.selectedUnitId;
    if (!selId) return;
    const sel = b.units.find((u) => u.id === selId);
    if (!sel || sel.side !== "player") return;

    if (b.phase === "deploy" && !sel.deployed) {
      this.dispatchTac({ type: "deploy", unitId: sel.id, x, y });
      return;
    }
    if (b.phase === "combat") {
      this.dispatchTac({ type: "move", unitId: sel.id, x, y });
    }
  }

  private onKey(ev: KeyboardEvent): void {
    const key = ev.key.toLowerCase();
    const b = this.battle();
    if (!b) return;
    const selId = this.selectedId ?? b.selectedUnitId;

    if (key === "escape") {
      // Stay until battle ends — don't abandon orphan state without flee
      return;
    }
    if (key === "a") {
      this.dispatchTac({ type: "autoDeploy" });
      return;
    }
    if (key === "b") {
      this.dispatchTac({ type: "beginCombat" });
      return;
    }
    if (key === "e") {
      this.dispatchTac({ type: "endTurn" });
      return;
    }
    if (key === "q") {
      this.dispatchTac({ type: "fleeQuick" });
      return;
    }
    if (!selId) return;

    if (key === "f") {
      const sel = b.units.find((u) => u.id === selId);
      const enemy = b.units.find(
        (u) => u.side === "enemy" && u.deployed && !u.destroyed && !u.captured,
      );
      if (sel && enemy)
        this.dispatchTac({ type: "shoot", unitId: sel.id, targetId: enemy.id });
      return;
    }
    if (key === "r") {
      const sel = b.units.find((u) => u.id === selId);
      const enemy = b.units.find(
        (u) =>
          u.side === "enemy" &&
          !u.destroyed &&
          Math.abs(u.x - (sel?.x ?? -99)) + Math.abs(u.y - (sel?.y ?? -99)) === 1,
      );
      if (sel && enemy)
        this.dispatchTac({ type: "ram", unitId: sel.id, targetId: enemy.id });
      return;
    }
    if (key === "c") {
      const sel = b.units.find((u) => u.id === selId);
      const enemy = b.units.find(
        (u) =>
          u.side === "enemy" &&
          !u.destroyed &&
          !u.captured &&
          Math.abs(u.x - (sel?.x ?? -99)) + Math.abs(u.y - (sel?.y ?? -99)) === 1,
      );
      if (sel && enemy)
        this.dispatchTac({ type: "board", unitId: sel.id, targetId: enemy.id });
    }
  }
}
