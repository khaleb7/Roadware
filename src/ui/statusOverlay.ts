import type { Game } from "../core/game";
import type { StatusSnapshot } from "../core/types";
import { RESOURCE_IDS } from "../core/types";

const PANEL_ID = "asphalt-status-overlay";

function ensurePanel(): HTMLDivElement {
  let el = document.getElementById(PANEL_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = PANEL_ID;
    el.setAttribute(
      "style",
      [
        "position:absolute",
        "inset:0",
        "pointer-events:none",
        "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
        "color:#d7c7a3",
        "z-index:5",
      ].join(";"),
    );
    const host = document.getElementById("game") ?? document.body;
    host.style.position = host.style.position || "relative";
    host.appendChild(el);
  }
  return el;
}

function fmtResources(status: StatusSnapshot): string {
  return RESOURCE_IDS.map((id) => `${id}:${status.resources[id]}`).join("  ");
}

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function renderStatusOverlay(game: Game): StatusSnapshot {
  const result = game.dispatch({ type: "status" });
  const status = result.status!;
  const panel = ensurePanel();

  const neighbors = status.neighbors
    .map((n) => `${n.name} · ${n.miles}mi ${n.terrain} · fuel ${n.fuelCost}`)
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
    ? `<div style="margin-top:10px;padding:8px;border:1px solid #6a3b2a;background:rgba(40,16,10,0.9);color:#f0c2a0;">
        <b>ENCOUNTER:</b> ${escapeHtml(status.pendingEncounter.name)}
        <div style="opacity:0.9;margin-top:4px;">${escapeHtml(status.pendingEncounter.description)}</div>
        <div style="margin-top:4px;">str ${status.pendingEncounter.strength} · morale ${status.pendingEncounter.morale} · ${status.pendingEncounter.actions.join(" / ")}</div>
        <div style="margin-top:4px;color:#c8b48a;">F fight · E evade · N negotiate · T trade</div>
      </div>`
    : "";

  const battle = status.lastBattleReport
    ? `<div style="margin-top:8px;font-size:10px;color:#b8c4a8;">
        <b>Last battle:</b> ${escapeHtml(status.lastBattleReport.summary)}<br/>
        ${status.lastBattleReport.lines.map((l) => escapeHtml(l)).join("<br/>")}
      </div>`
    : "";

  const log = status.recentLog
    .map((e) => `[${e.turn}] ${e.kind}: ${escapeHtml(e.message)}`)
    .join("<br/>");

  panel.innerHTML = `
    <div style="position:absolute;left:12px;top:12px;right:12px;padding:12px 14px;background:rgba(8,10,12,0.82);border:1px solid #3a3428;pointer-events:auto;max-height:48%;overflow:auto;">
      <div style="font-size:13px;letter-spacing:0.04em;color:#e6d3a3;">${escapeHtml(status.locationName)}</div>
      <div style="font-size:11px;opacity:0.85;margin-top:4px;">Turn ${status.turn} · crew ${status.crewCount} · vehicles ${status.vehicleCount}${status.stranded ? " · STRANDED" : ""}</div>
      <div style="font-size:11px;margin-top:8px;">${fmtResources(status)}</div>
      <div style="font-size:11px;margin-top:8px;opacity:0.9;">${escapeHtml(intel)}</div>
      ${encounter}
      ${battle}
      <div style="font-size:11px;margin-top:10px;color:#9aa3ad;"><b style="color:#c8b48a;">Roads</b><br/>${neighbors || "(none)"}</div>
      <div style="font-size:10px;margin-top:10px;opacity:0.75;line-height:1.35;">${log}</div>
      <div style="font-size:10px;margin-top:8px;color:#6b737c;">Keys: 1 search · 2 loot · 3 rest · 4 attack · M move · S refresh</div>
    </div>
  `;

  return status;
}

export function destroyStatusOverlay(): void {
  document.getElementById(PANEL_ID)?.remove();
}
