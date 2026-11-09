// @ts-nocheck
import { S, ui } from "../state";
import { esc, pad, toast, todayKey } from "../lib/util";
import { render } from "../views/render";
import { active } from "../domain/habits";
import { markDirty } from "../storage/persist";

// ---------- Drang-Hilfe (SOS) ----------
export const SOS_TRIG = ["Langeweile","Müde","Stress","Einsam","Frust","Handy im Bett","Gewohnheit","Anderes"];

export const SOS_DEFAULT = [
  { c: "Körper", t: "20 Liegestütze, sofort" },
  { c: "Körper", t: "3 Runden Schattenboxen à 2 Min" },
  { c: "Körper", t: "10 Min raus, Handy bleibt drinnen" },
  { c: "Körper", t: "Kalt duschen" },
  { c: "Körper", t: "Großes Glas Wasser trinken" },
  { c: "Kopf", t: "10 Anki-Karten" },
  { c: "Kopf", t: "5 Seiten lesen" },
  { c: "Kopf", t: "10 Japanisch-Vokabeln" },
  { c: "Kopf", t: "3 Sätze aufschreiben: Was brauche ich gerade wirklich?" },
  { c: "Ruhe", t: "5 Min meditieren" },
  { c: "Ruhe", t: "Zimmer 5 Min aufräumen" },
  { c: "Menschen", t: "Jemandem schreiben oder anrufen" }
];

export const sosAlts = () => S.monk.alts || SOS_DEFAULT;

export function sosReset(){ sosStop(); ui.sos = { phase: "go", trig: null, pick: null, start: null, dur: 600, edit: false, adding: "" }; }

export function sosStop(){ if (ui.sosInt){ clearInterval(ui.sosInt); ui.sosInt = null; } }

export function trigCounts(){
  const m = {};
  for (const e of S.monk.log || []) if (e.trig) m[e.trig] = (m[e.trig] || 0) + 1;
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

export function trigInsight(){
  const c = trigCounts().slice(0, 3); if (!c.length) return "";
  return `<div class="trig-insight"><span class="mk-lbl">Deine häufigsten Auslöser</span>${c.map(([t, n]) => `<span>${esc(t)} <b class="num">${n}×</b></span>`).join("")}</div>`;
}

export const fmtClock = sec => `${Math.floor(sec/60)}:${pad(Math.floor(sec%60))}`;

export function sosPaint(){
  if (!ui.sos) return;
  const el = document.getElementById("sos-time"); if (!el) return;
  const R = 60, C = 2 * Math.PI * R;
  let left = ui.sos.dur, phase = "Bereit", sub = "Starte, wenn du bereit bist";
  if (ui.sos.start){
    const el2 = (Date.now() - ui.sos.start) / 1000;
    left = Math.max(0, ui.sos.dur - el2);
    const cyc = el2 % 16, i = Math.floor(cyc / 4), rest = 4 - Math.floor(cyc % 4);
    phase = ["Einatmen","Halten","Ausatmen","Halten"][i]; sub = `${rest} …`;
    if (left <= 0){ sosStop(); ui.sos.start = null; ui.sos.finished = true; toast("Die Welle ist durch. Du bist noch da."); render(); return; }
  } else if (ui.sos.finished){ phase = "Welle vorbei"; sub = "Jetzt den Sieg eintragen"; left = 0; }
  el.textContent = fmtClock(left);
  const ring = document.getElementById("sos-arc"); if (ring) ring.setAttribute("stroke-dasharray", `${(C * (1 - left / ui.sos.dur)).toFixed(1)} ${C.toFixed(1)}`);
  const ph = document.getElementById("sos-phase"); if (ph) ph.textContent = phase;
  const sb = document.getElementById("sos-sub"); if (sb) sb.textContent = sub;
}

export function vSos(){
  if (!ui.sos) sosReset();
  const run = S.monk.run, active = run && run.status === "active";
  if (ui.sos.phase === "done"){
    const n = (S.monk.log || []).length;
    return `<section class="monk" aria-label="Drang besiegt">
      <div class="mk-done">
        <div class="mk-eye">波 · Drang-Hilfe</div>
        <div class="big">勝</div>
        <h2>Besiegt.</h2>
        <p class="mk-muted" style="margin:0;max-width:44ch">Das war Drang Nr. <b class="num" style="color:var(--monk-ink)">${n}</b>, den du hier ausgesessen hast.${active ? ` Dein Lauf steht weiter bei ${ui.mState.count} von ${run.goal} Tagen.` : ""}</p>
        ${ui.sos.pick ? `<p style="margin:0">Jetzt: <b>${esc(ui.sos.pick)}</b>. Fang direkt an.</p>` : ""}
      </div>
      ${trigInsight()}
      <div class="row" style="justify-content:center"><a class="mk-btn red" href="#heute" style="text-decoration:none">Zurück zu Heute</a><button class="mk-btn ghost" data-sos="again">Noch ein Drang</button></div>
    </section>`;
  }
  const alts = sosAlts(), R = 60, C = 2 * Math.PI * R;
  const stake = active ? `<div class="stake"><span class="mk-lbl" style="color:var(--monk-gold)">Was auf dem Spiel steht</span><span class="n">Tag ${ui.mState.count} von ${run.goal}</span>${run.why ? `<div class="mk-why">${esc(run.why)}</div>` : ""}<span class="mk-muted" style="font-size:13.5px">Ein paar Minuten Nachgeben kosten dich ${ui.mState.count} ${ui.mState.count === 1 ? "Tag" : "Tage"} Arbeit. Der Drang ist es nicht wert.</span></div>` : "";
  const edit = ui.sos.edit ? `<div class="alt-edit">${alts.map((a, i) => `<div><span>${esc(a.t)}</span><button class="mk-btn ghost" data-sos="rm" data-a="${i}" aria-label="${esc(a.t)} entfernen">Entfernen</button></div>`).join("")}
      <div style="border:0"><input id="sos-add" maxlength="80" placeholder="Eigene Alternative, z. B. Seilspringen" value="${esc(ui.sos.adding)}"><button class="mk-btn" data-sos="add">Hinzufügen</button></div>
      <div style="border:0"><button class="mk-btn ghost" data-sos="defaults">Standardliste wiederherstellen</button><button class="mk-btn" data-sos="edit">Fertig</button></div></div>`
    : `<div class="alts">${alts.map((a, i) => `<button class="alt" data-sos="pick" data-a="${i}" aria-pressed="${ui.sos.pick === a.t}"><span class="mk-lbl">${esc(a.c || "Eigene")}</span><span>${esc(a.t)}</span></button>`).join("")}</div>
      <div class="row"><button class="mk-btn" data-sos="random">Zufällig wählen</button><button class="mk-btn ghost" data-sos="edit">Liste anpassen</button></div>`;
  return `<section class="monk" aria-label="Drang-Hilfe">
    <div class="mk-eye">波 · Drang-Hilfe</div>
    <h2>Der Drang ist eine Welle. Du musst nur oben bleiben.</h2>
    <p class="mk-muted" style="margin:0;max-width:56ch">Er steigt, erreicht einen Höhepunkt und ebbt wieder ab, auch wenn du nichts tust. Atme mit, bis der Timer durch ist, und mach dann eine der Sachen unten.</p>
    ${stake}
    <div class="sos-timer">
      <div class="sos-ring"><svg viewBox="0 0 136 136" aria-hidden="true"><circle cx="68" cy="68" r="${R}" fill="none" stroke="var(--monk-raise)" stroke-width="8"/><circle id="sos-arc" cx="68" cy="68" r="${R}" fill="none" stroke="var(--monk-red)" stroke-width="8" stroke-linecap="round" stroke-dasharray="0 ${C.toFixed(1)}" transform="rotate(-90 68 68)"/></svg><div class="tm"><b id="sos-time">${fmtClock(ui.sos.dur)}</b><span class="mk-lbl">übrig</span></div></div>
      <div class="sos-breath"><div class="breath ${ui.sos.start ? "run" : ""}" aria-hidden="true" style="${ui.sos.start ? `animation-delay:-${(((Date.now() - ui.sos.start) / 1000) % 16).toFixed(2)}s` : ""}"></div><span class="sos-phase" id="sos-phase" aria-live="polite"></span><span class="mk-muted" id="sos-sub" style="font-size:12.5px"></span></div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <span class="mk-lbl">Dauer</span>
        <div class="sos-chips">${[2,5,10].map(m => `<button class="sos-chip" data-sos="dur" data-a="${m}" aria-pressed="${ui.sos.dur === m*60}" ${ui.sos.start ? "disabled" : ""}>${m} Min</button>`).join("")}</div>
        ${ui.sos.start ? `<button class="mk-btn ghost" data-sos="stop">Timer stoppen</button>` : `<button class="mk-btn red" data-sos="start">${ui.sos.finished ? "Nochmal" : "Welle aussitzen"}</button>`}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px"><span class="mk-lbl">Was steckt dahinter?</span><div class="sos-chips">${SOS_TRIG.map(t => `<button class="sos-chip" data-sos="trig" data-a="${t}" aria-pressed="${ui.sos.trig === t}">${t}</button>`).join("")}</div></div>
    <div style="display:flex;flex-direction:column;gap:8px"><span class="mk-lbl">Mach stattdessen eins davon</span>${ui.sos.pick ? `<div class="sos-task"><span class="mk-lbl">Deine Aufgabe jetzt</span><b>${esc(ui.sos.pick)}</b></div>` : ""}${edit}</div>
    <div class="row"><button class="mk-btn red" data-sos="win" style="padding:11px 20px;font-size:15px">Drang besiegt</button><a class="mk-btn ghost" href="#heute" style="text-decoration:none">Zurück</a></div>
  </section>`;
}

export function sosAction(a, arg){
  if (!ui.sos) sosReset();
  const alts = sosAlts();
  switch (a){
    case "dur": ui.sos.dur = +arg * 60; ui.sos.finished = false; break;
    case "start": ui.sos.start = Date.now(); ui.sos.finished = false; sosStop(); ui.sosInt = setInterval(sosPaint, 250); break;
    case "stop": sosStop(); ui.sos.start = null; break;
    case "trig": ui.sos.trig = ui.sos.trig === arg ? null : arg; break;
    case "pick": ui.sos.pick = alts[+arg] ? (ui.sos.pick === alts[+arg].t ? null : alts[+arg].t) : null; break;
    case "random": { const pool = alts.filter(x => x.t !== ui.sos.pick); const x = pool[Math.floor(Math.random() * pool.length)]; if (x) ui.sos.pick = x.t; break; }
    case "edit": ui.sos.edit = !ui.sos.edit; break;
    case "rm": { const l = alts.slice(); l.splice(+arg, 1); S.monk.alts = l; markDirty("monk"); break; }
    case "add": { const v = ui.sos.adding.trim(); if (!v) return; S.monk.alts = [...alts, { c: "Eigene", t: v }]; ui.sos.adding = ""; markDirty("monk"); break; }
    case "defaults": S.monk.alts = null; markDirty("monk"); break;
    case "win": {
      const t = todayKey();
      S.monk.log = [...(S.monk.log || []), { k: t, h: new Date().getHours(), trig: ui.sos.trig, alt: ui.sos.pick }].slice(-1000);
      const run = S.monk.run;
      if (run && run.status === "active"){ run.urges = run.urges || {}; run.urges[t] = (run.urges[t] || 0) + 1; }
      markDirty("monk"); sosStop(); ui.sos.start = null; ui.sos.phase = "done"; break;
    }
    case "again": sosReset(); break;
  }
  render();
}
