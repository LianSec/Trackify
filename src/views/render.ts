// @ts-nocheck
import { invalidate } from "../domain/habits";
import { S, ui } from "../state";
import { monkEvaluate } from "../features/monk";
import { vTrain } from "../features/training-editor";
import { vCalm } from "../features/calm";
import { sosPaint, vSos } from "../features/sos";
import { vStats } from "./stats";
import { vHabits } from "./habits";
import { vImport } from "../features/import";
import { vToday } from "./today";
import { $ } from "../lib/util";
import { vAccount } from "../features/account";

// ---------- render ----------
export function render(){
  invalidate();
  const navV = ui.view === "import" ? "gewohnheiten" : ui.view;
  document.querySelectorAll("nav.tabs a").forEach(a => { if (a.dataset.v === navV) a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current"); });
  if (!S.loaded) return;
  ui.mState = monkEvaluate();
  const ae = document.activeElement, aid = ae && ae.id, sel = ae && "selectionStart" in ae ? [ae.selectionStart, ae.selectionEnd] : null;
  const html = ui.view === "konto" ? vAccount() : ui.view === "training" ? vTrain() : ui.view === "ruhe" ? vCalm() : ui.view === "sos" ? vSos() : ui.view === "statistik" ? vStats() : ui.view === "gewohnheiten" ? vHabits() : ui.view === "import" ? vImport() : vToday();
  $("#view").innerHTML = html;
  $("#sosfab").hidden = ui.view === "sos";
  if (ui.view === "sos") sosPaint();
  if (aid){ const el = document.getElementById(aid); if (el){ el.focus({preventScroll:true}); if (sel && "setSelectionRange" in el) try{ el.setSelectionRange(sel[0], sel[1]); }catch(e){} } }
}

export function ringSvg(p, color){
  const r = 10, c = 2*Math.PI*r, f = p == null ? 0 : p;
  return `<svg class="ring" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="${r}" fill="none" stroke="var(--sunk)" stroke-width="4"/>${f>0?`<circle cx="13" cy="13" r="${r}" fill="none" stroke="${color||"var(--accent)"}" stroke-width="4" stroke-dasharray="${(c*f).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 13 13)" stroke-linecap="round"/>`:""}</svg>`;
}
