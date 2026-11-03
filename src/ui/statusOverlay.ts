import { playSfx } from "../audio/procedural";
import type { Game } from "../core/game";
import type { GameCommand, StatusSnapshot } from "../core/types";
import { RESOURCE_IDS } from "../core/types";
import { getDifficulty } from "../core/difficulty";
import type { GameSettings } from "../settings/types";
import { PALETTE_CSS } from "../art/palette";
import { STAT_TOOLTIPS, tipForTurn } from "./tooltips";

const PANEL_ID = "asphalt-status-overlay";

export type OverlayActionHandler = (command: GameCommand, label: string) => void;

interface OverlayCallbacks {
  onStage: OverlayActionHandler;
  onConfirm: () => void;
  onUndo: () => void;
  onRefresh: () => void;
  onSave?: () => void;
  onOpenSettings?: () => void;
  settings?: GameSettings;
}

let callbacks: OverlayCallbacks | null = null;

function ensurePanel(): HTMLDivElement {
  let el = document.getElementById(PANEL_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = PANEL_ID;
    el.setAttribute(
      "style",
      [
        "position:fixed",
        "inset:0",
        // Root must accept hits: some Chromium/automation paths ignore
        // pointer-events:auto descendants under a none ancestor.
        "pointer-events:auto",
        "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
        `color:${PALETTE_CSS.sand}`,
        // Above Phaser canvas (FIT letterboxing) so Save/Settings clicks land on DOM buttons
        "z-index:1000",
      ].join(";"),
    );
    // Attach to body so canvas transform/margins cannot swallow overlay hit-testing
    document.body.appendChild(el);
    // Event delegation — survives innerHTML rewrites via renderStatusOverlay
    el.addEventListener(
      "click",
      (ev) => {
        const target = (ev.target as HTMLElement | null)?.closest?.(
          "button[data-action]",
        ) as HTMLButtonElement | null;
        if (!target || !el!.contains(target)) return;
        ev.preventDefault();
        ev.stopPropagation();
        try {
          playSfx("ui-click");
        } catch {
          /* ignore */
        }
        handleAction(target.dataset.action ?? "");
      },
      true,
    );
  }
  return el;
}

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function tipAttr(key: string, settings?: GameSettings): string {
  if (settings && !settings.showStatTooltips) return "";
  const tip = STAT_TOOLTIPS[key];
  if (!tip) return "";
  return ` title="${escapeHtml(tip)}"`;
}

function btn(
  label: string,
  dataAction: string,
  title?: string,
): string {
  const t = title ? ` title="${escapeHtml(title)}"` : "";
  return `<button type="button" data-action="${escapeHtml(dataAction)}"${t}
    style="pointer-events:auto;cursor:pointer;margin:2px 4px 2px 0;padding:4px 8px;background:${PALETTE_CSS.oil};color:${PALETTE_CSS.amber};border:1px solid ${PALETTE_CSS.rust};font:inherit;font-size:11px;">${escapeHtml(label)}</button>`;
}

function fmtResources(status: StatusSnapshot, settings?: GameSettings): string {
  return RESOURCE_IDS.map((id) => {
    return `<span${tipAttr(id, settings)} style="margin-right:10px;border-bottom:1px dotted ${PALETTE_CSS.rust};cursor:help;">${id}:${status.resources[id]}</span>`;
  }).join("");
}

export function setOverlayCallbacks(cb: OverlayCallbacks): void {
  callbacks = cb;
}

export function renderStatusOverlay(game: Game): StatusSnapshot {
  const result = game.dispatch({ type: "status" });
  const status = result.status!;
  const panel = ensurePanel();
  const settings = callbacks?.settings;
  const staged = game.getStaged();
  const diff = getDifficulty(status.difficulty);

  const neighbors = status.neighbors
    .map(
      (n, i) =>
        `${btn(`→ ${n.name}`, `move:${n.id}`, `${n.miles}mi ${n.terrain} · fuel ${n.fuelCost}`)} <span style="opacity:0.7;font-size:10px;">${n.miles}mi ${n.terrain} fuel ${n.fuelCost}${i === 0 ? " [M]" : ""}</span>`,
    )
    .join("<br/>");

  const city = status.city;
  const intel = [
    `pop: ${city.population ?? "??"}`,
    `danger: ${city.danger ?? "??"}`,
    `faction: ${city.factionLabel ?? "unknown"}`,
    `recruits: ${city.recruitCount ?? "??"}`,
    `sites: ${city.specialLocations?.join(", ") ?? "??"}`,
  ].join(" · ");

  const encounter = status.pendingEncounter
    ? `<div style="margin-top:10px;padding:8px;border:1px solid ${PALETTE_CSS.bloodRust};background:rgba(40,16,10,0.9);color:#f0c2a0;">
        <b>ENCOUNTER:</b> ${escapeHtml(status.pendingEncounter.name)}
        <div style="opacity:0.9;margin-top:4px;">${escapeHtml(status.pendingEncounter.description)}</div>
        <div style="margin-top:4px;">str ${status.pendingEncounter.strength} · morale ${status.pendingEncounter.morale}</div>
        <div style="margin-top:6px;">
          ${btn("Quick fight [F]", "fight:quick")}
          ${btn("Tactical [V]", "fight:tactical")}
          ${btn("Evade [E]", "resolve:evade")}
          ${btn("Negotiate [N]", "resolve:negotiate")}
          ${btn("Trade [T]", "resolve:trade")}
        </div>
      </div>`
    : "";

  const battle = status.lastBattleReport
    ? `<div style="margin-top:8px;font-size:10px;color:${PALETTE_CSS.fadedGreen};">
        <b>Last battle:</b> ${escapeHtml(status.lastBattleReport.summary)}<br/>
        ${status.lastBattleReport.lines.map((l) => escapeHtml(l)).join("<br/>")}
      </div>`
    : "";

  const camp = status.campaign;
  const campaignBlock = `<div style="margin-top:8px;font-size:10px;color:#a8b8c8;"${tipAttr("campaign", settings)}>
      <b>Campaign</b> [${camp.stage}] strength ${camp.gangStrength}/${camp.strengthThreshold}
      · sci ${camp.scientistsDelivered}/${camp.scientistsTotal} delivered
      · aboard ${camp.scientistsAboard}
      · found ${camp.scientistsRevealed}
      ${camp.bunkerName ? `· bunker ${escapeHtml(camp.bunkerName)}` : "· remnant silent"}
      ${camp.turnsRemaining !== null ? `· deadline ${camp.turnsRemaining}t` : ""}
      ${
        camp.scientistsHere
          .filter((s) => s.revealed && !s.aboard && !s.delivered)
          .map(
            (s) =>
              `<br/>${btn(`Extract ${s.name} [X]`, `extract:${s.id}`, "Secure revealed scientist")}`,
          )
          .join("")
      }
      ${
        camp.contactedFederal && camp.bunkerCityId === status.locationId
          ? `<br/>${btn("Deliver [D]", "deliver", "Unload scientists at bunker")}`
          : ""
      }
    </div>`;

  const log = status.recentLog
    .map((e) => `[${e.turn}] ${e.kind}: ${escapeHtml(e.message)}`)
    .join("<br/>");

  const phaseNote =
    status.phase === "won" ? " · WON" : status.phase === "lost" ? " · LOST" : "";

  const stagedBlock = staged
    ? `<div style="margin-top:8px;padding:8px;border:1px solid ${PALETTE_CSS.amber};background:rgba(40,30,10,0.95);">
        Staged: <b>${escapeHtml(staged.label)}</b>
        ${btn("Confirm [Enter]", "confirm")}
        ${btn("Undo [U]", "undo")}
      </div>`
    : "";

  const tutorial =
    settings?.showTutorialTips !== false
      ? `<div style="margin-top:8px;font-size:10px;color:${PALETTE_CSS.dust};font-style:italic;">Tip: ${escapeHtml(tipForTurn(status.turn))}</div>`
      : "";

  panel.innerHTML = `
    <div style="position:absolute;left:16px;top:16px;right:16px;padding:14px 16px;background:rgba(8,10,12,0.88);border:1px solid ${PALETTE_CSS.rust};pointer-events:auto;max-height:52%;overflow:auto;">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
        <div>
          <div style="font-size:15px;letter-spacing:0.04em;color:${PALETTE_CSS.amber};">${escapeHtml(status.locationName)}</div>
          <div style="font-size:11px;opacity:0.85;margin-top:4px;">
            Turn ${status.turn} ·
            <span${tipAttr("crew", settings)} style="cursor:help;border-bottom:1px dotted ${PALETTE_CSS.rust};">crew ${status.crewCount}</span> ·
            <span${tipAttr("vehicles", settings)} style="cursor:help;border-bottom:1px dotted ${PALETTE_CSS.rust};">vehicles ${status.vehicleCount}</span>
            ${status.stranded ? " · STRANDED" : ""}${phaseNote}
            · <span${tipAttr("difficulty", settings)} style="cursor:help;">${escapeHtml(diff.label)}</span>
          </div>
        </div>
        <div>
          ${btn("Save", "save-manual", "Write current slot")}
          ${btn("Settings", "settings")}
        </div>
      </div>
      <div style="font-size:11px;margin-top:8px;">${fmtResources(status, settings)}</div>
      <div style="font-size:11px;margin-top:8px;opacity:0.9;">${escapeHtml(intel)}</div>
      ${campaignBlock}
      ${encounter}
      ${battle}
      ${stagedBlock}
      <div style="margin-top:10px;">
        ${btn("Search [1]", "cmd:search")}
        ${btn("Loot [2]", "cmd:loot")}
        ${btn("Rest [3]", "cmd:rest")}
        ${btn("Attack [4]", "cmd:attack")}
        ${btn("Refresh [S]", "refresh")}
      </div>
      <div style="font-size:11px;margin-top:10px;color:${PALETTE_CSS.chrome};"><b style="color:${PALETTE_CSS.sand};">Roads</b><br/>${neighbors || "(none)"}</div>
      <div style="font-size:10px;margin-top:10px;opacity:0.8;line-height:1.35;max-height:120px;overflow:auto;border-top:1px solid ${PALETTE_CSS.asphalt};padding-top:6px;">
        <b style="color:${PALETTE_CSS.sand};">Log / history</b><br/>${log}
      </div>
      ${tutorial}
      <div style="font-size:10px;margin-top:8px;color:#6b737c;">Stage with buttons/keys · Enter confirm · U undo · Esc clears stage</div>
    </div>
  `;

  return status;
}

function handleAction(action: string): void {
  if (!callbacks) return;
  if (action === "confirm") {
    playSfx("ui-confirm");
    callbacks.onConfirm();
    return;
  }
  if (action === "undo") {
    playSfx("ui-cancel");
    callbacks.onUndo();
    return;
  }
  if (action === "refresh") {
    callbacks.onRefresh();
    return;
  }
  if (action === "save-manual") {
    callbacks.onSave?.();
    return;
  }
  if (action === "settings") {
    callbacks.onOpenSettings?.();
    return;
  }
  if (action.startsWith("move:")) {
    const id = action.slice(5);
    callbacks.onStage({ type: "move", destinationId: id }, `Move to ${id}`);
    return;
  }
  if (action.startsWith("fight:")) {
    const mode = action.slice(6) as "quick" | "tactical";
    callbacks.onStage(
      { type: "resolveEncounter", action: "fight", mode },
      mode === "quick" ? "Quick fight" : "Tactical fight",
    );
    return;
  }
  if (action.startsWith("resolve:")) {
    const a = action.slice(8) as "evade" | "negotiate" | "trade";
    callbacks.onStage({ type: "resolveEncounter", action: a }, a);
    return;
  }
  if (action.startsWith("cmd:")) {
    const t = action.slice(4);
    if (t === "search") callbacks.onStage({ type: "search" }, "Search");
    if (t === "loot") callbacks.onStage({ type: "loot" }, "Loot");
    if (t === "rest") callbacks.onStage({ type: "rest" }, "Rest");
    if (t === "attack") callbacks.onStage({ type: "attack" }, "Attack");
    return;
  }
  if (action.startsWith("extract:")) {
    const scientistId = action.slice(8);
    callbacks.onStage(
      { type: "extractScientist", scientistId },
      `Extract ${scientistId}`,
    );
    return;
  }
  if (action === "deliver") {
    callbacks.onStage({ type: "deliverScientists" }, "Deliver scientists");
  }
}

export function destroyStatusOverlay(): void {
  document.getElementById(PANEL_ID)?.remove();
  callbacks = null;
}
