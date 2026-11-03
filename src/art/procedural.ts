import type Phaser from "phaser";
import { PALETTE } from "./palette";

/** Draw a dusty continental map backdrop into a canvas. */
export function drawMapDust(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#1a1814");
  g.addColorStop(0.45, "#2a2318");
  g.addColorStop(1, "#12151a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Speckle dust
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const a = 0.04 + Math.random() * 0.12;
    ctx.fillStyle = `rgba(194,168,120,${a})`;
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1);
  }

  // Faint green wash (scrub / dead fields)
  ctx.fillStyle = "rgba(107,127,90,0.06)";
  ctx.beginPath();
  ctx.ellipse(w * 0.35, h * 0.55, w * 0.4, h * 0.25, 0.2, 0, Math.PI * 2);
  ctx.fill();
}

export function drawRoadStrip(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#2A2E32";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#D4A017";
  ctx.setLineDash([8, 10]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "#8B4513";
  ctx.lineWidth = 3;
  ctx.strokeRect(1, 1, w - 2, h - 2);
}

export function drawCityNode(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  ctx.clearRect(0, 0, w, h);
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(w, h) * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = "#8B4513";
  ctx.fill();
  ctx.strokeStyle = "#D4A017";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(w, h) * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = "#C2A878";
  ctx.fill();
}

export function drawVehicleSilhouette(
  canvas: HTMLCanvasElement,
  classId: string,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#8B4513";
  ctx.strokeStyle = "#C2A878";
  ctx.lineWidth = 2;

  const bodyY = h * 0.35;
  const bodyH = h * 0.35;
  switch (classId) {
    case "bike":
      ctx.beginPath();
      ctx.moveTo(w * 0.2, h * 0.65);
      ctx.lineTo(w * 0.45, h * 0.35);
      ctx.lineTo(w * 0.75, h * 0.65);
      ctx.stroke();
      break;
    case "hauler":
      ctx.fillRect(w * 0.1, bodyY, w * 0.55, bodyH);
      ctx.fillStyle = "#6A2E1F";
      ctx.fillRect(w * 0.65, bodyY + 4, w * 0.2, bodyH - 4);
      break;
    case "bus":
      ctx.fillStyle = "#6B7F5A";
      ctx.fillRect(w * 0.08, bodyY, w * 0.84, bodyH);
      break;
    case "tanker":
      ctx.beginPath();
      ctx.ellipse(w * 0.45, h * 0.5, w * 0.35, h * 0.22, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#2A2E32";
      ctx.fill();
      ctx.strokeStyle = "#D4A017";
      ctx.stroke();
      break;
    case "armored":
      ctx.fillStyle = "#3A3428";
      ctx.beginPath();
      ctx.moveTo(w * 0.1, h * 0.7);
      ctx.lineTo(w * 0.2, h * 0.3);
      ctx.lineTo(w * 0.8, h * 0.3);
      ctx.lineTo(w * 0.9, h * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    default:
      ctx.fillRect(w * 0.15, bodyY, w * 0.7, bodyH);
      break;
  }

  // Wheels
  ctx.fillStyle = "#1A1C1E";
  ctx.strokeStyle = "#9AA3AD";
  for (const x of [0.25, 0.75]) {
    ctx.beginPath();
    ctx.arc(w * x, h * 0.72, h * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

/** Register procedural textures on a Phaser texture manager. */
export function registerProceduralTextures(
  textures: Phaser.Textures.TextureManager,
): void {
  const make = (key: string, w: number, h: number, draw: (c: HTMLCanvasElement) => void) => {
    if (textures.exists(key)) return;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    draw(canvas);
    textures.addCanvas(key, canvas);
  };

  make("tex-map-dust", 512, 288, drawMapDust);
  make("tex-road", 128, 32, drawRoadStrip);
  make("tex-city-node", 48, 48, drawCityNode);

  for (const id of ["bike", "hardtop", "hauler", "bus", "tanker", "armored"]) {
    make(`tex-veh-${id}`, 96, 48, (c) => drawVehicleSilhouette(c, id));
  }

  void PALETTE;
}
