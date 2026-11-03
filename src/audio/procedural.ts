/**
 * Procedural SFX via Web Audio API (no external samples required).
 * Hooks: UI click/confirm/cancel, engine idle blip, gunfire burst.
 */

type SfxId = "ui-click" | "ui-confirm" | "ui-cancel" | "engine" | "gunfire";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let muted = false;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    masterGain = ctx.createGain();
    sfxGain = ctx.createGain();
    sfxGain.connect(masterGain);
    masterGain.connect(ctx.destination);
    masterGain.gain.value = 0.7;
    sfxGain.gain.value = 0.8;
  }
  return ctx;
}

export function setAudioVolumes(master: number, sfx: number): void {
  ensure();
  if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, master));
  if (sfxGain) sfxGain.gain.value = Math.max(0, Math.min(1, sfx));
}

export function setAudioMuted(value: boolean): void {
  muted = value;
}

export async function resumeAudio(): Promise<void> {
  const c = ensure();
  if (c && c.state === "suspended") {
    await c.resume();
  }
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType,
  gain = 0.15,
  sweepTo?: number,
): void {
  if (muted) return;
  const c = ensure();
  if (!c || !sfxGain) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  if (sweepTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), c.currentTime + duration);
  }
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start();
  osc.stop(c.currentTime + duration + 0.02);
}

function noiseBurst(duration: number, gain = 0.2): void {
  if (muted) return;
  const c = ensure();
  if (!c || !sfxGain) return;
  const len = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1800;
  g.gain.value = gain;
  src.connect(filter);
  filter.connect(g);
  g.connect(sfxGain);
  src.start();
}

export function playSfx(id: SfxId): void {
  void resumeAudio();
  switch (id) {
    case "ui-click":
      tone(660, 0.04, "square", 0.08);
      break;
    case "ui-confirm":
      tone(520, 0.06, "triangle", 0.1);
      tone(780, 0.08, "triangle", 0.08);
      break;
    case "ui-cancel":
      tone(320, 0.07, "sawtooth", 0.06, 180);
      break;
    case "engine":
      tone(90, 0.25, "sawtooth", 0.05, 70);
      tone(45, 0.3, "sine", 0.04);
      break;
    case "gunfire":
      noiseBurst(0.08, 0.35);
      tone(220, 0.05, "square", 0.06, 80);
      break;
    default:
      break;
  }
}

export type { SfxId };
