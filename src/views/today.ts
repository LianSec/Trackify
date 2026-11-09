// @ts-nocheck
import { active, dayScore, habitStats, hc, overallStats, scheduled, startOf, stateOf, valOf } from "../domain/habits";
import { S, ui } from "../state";
import { monkPanel } from "../features/monk";
import { CHECK_SVG, MON, WD, WD_LONG, addDays, esc, fromKey, todayKey, wdOf } from "../lib/util";
import { ringSvg } from "./render";

export function vToday(){
  const list = active();
  if (!S.habits.length) return emptyState() + monkPanel();
  const d = fromKey(ui.cur), t = todayKey();
  const sc = dayScore(ui.cur, list);
  const on = list.filter(h => scheduled(h, ui.cur)), off = list.filter(h => !scheduled(h, ui.cur));
  // week strip: 7 Tage endend mit cur (oder heute, wenn cur in der Woche liegt)
  const wkEnd = ui.cur > addDays(t,-3) ? (ui.cur > t ? ui.cur : t) : addDays(ui.cur, 3);
  let week = "";
  for (let i = 6; i >= 0; i--){
    const k = addDays(wkEnd, -i), s = dayScore(k, list);
    week += `<button class="wk" data-go="${k}" ${k===ui.cur?'aria-current="date"':""} aria-label="${WD_LONG[wdOf(k)]}, ${fromKey(k).getDate()}. ${MON[fromKey(k).getMonth()]}"><span class="wn">${WD[wdOf(k)]}</span>${ringSvg(k>t?null:s.p)}<span class="d num">${fromKey(k).getDate()}</span></button>`;
  }
  const rows = on.map((h,i) => habitRow(h, i)).join("") || `<p class="muted">Für diesen Tag ist nichts geplant.</p>`;
  const offHtml = off.length ? `<details class="off"><summary>${off.length} heute nicht geplant</summary><div class="habits" style="margin-top:8px">${off.map(h=>habitRow(h,-1)).join("")}</div></details>` : "";
  const note = (S.days[ui.cur] && S.days[ui.cur]._note) || "";
  const o = overallStats();
  return `
  <div class="dayhead">
    <div class="daynum">${d.getDate()}</div>
    <div class="daymeta"><span class="wd">${WD_LONG[wdOf(ui.cur)]}${ui.cur===t?' · <span class="muted">heute</span>':""}</span><span class="muted">${MON[d.getMonth()]} ${d.getFullYear()}</span></div>
    ${S.monk.run && S.monk.run.status === "active" ? `<button class="monkpill" data-mk="scroll" aria-label="Zum Monk Mode">修行 <b class="num">${ui.mState.count}</b>/${S.monk.run.goal}</button>` : ""}
    <div class="daynav">
      <button class="iconbtn" data-step="-1" aria-label="Vorheriger Tag">‹</button>
      <input type="date" id="datepick" value="${ui.cur}" aria-label="Datum wählen">
      <button class="iconbtn" data-step="1" aria-label="Nächster Tag">›</button>
      ${ui.cur!==t?`<button class="btn" data-go="${t}">Heute</button>`:""}
    </div>
  </div>
  <div class="week">${week}</div>
  <div class="card progress">
    <div style="display:flex;flex-direction:column;gap:2px;min-width:0;flex:1">
      <div class="row" style="justify-content:space-between"><span><b class="num">${sc.d}</b> <span class="muted">von</span> <b class="num">${sc.s}</b> <span class="muted">erledigt</span></span><span class="label">Perfekte Tage in Folge · <span class="num">${o.perfCur}</span></span></div>
      <div class="pbar"><i style="width:${sc.p==null?0:Math.round(sc.p*100)}%"></i></div>
    </div>
  </div>
  <div class="habits">${rows}</div>
  ${offHtml}
  ${monkPanel()}
  <div class="card" style="display:flex;flex-direction:column;gap:8px">
    <label class="label" for="note">Notiz zum Tag</label>
    <textarea id="note" placeholder="Was lief gut, was nicht? Wie war das Training?">${esc(note)}</textarea>
  </div>
  <p class="muted" style="font-size:12.5px;margin:0">Tastatur: <span class="kbd">1</span>–<span class="kbd">9</span> abhaken · <span class="kbd">←</span> <span class="kbd">→</span> Tag wechseln · <span class="kbd">T</span> heute</p>`;
}

export function missedLast(h, k){
  // letzter geplanter Tag vor k: wurde er verpasst?
  for (let i = 1; i <= 7; i++){ const kk = addDays(k, -i); if (kk < startOf(h)) return false; if (scheduled(h, kk)) return stateOf(h, kk) === "none"; }
  return false;
}

export function habitRow(h, idx){
  const st = stateOf(h, ui.cur), v = valOf(h, ui.cur), s = habitStats(h);
  const twice = st === "none" && scheduled(h, ui.cur) && missedLast(h, ui.cur);
  let dots = "";
  for (let i = 13; i >= 0; i--){
    const k = addDays(ui.cur, -i);
    if (!scheduled(h,k)) { dots += `<i class="n"></i>`; continue; }
    const x = stateOf(h,k); dots += `<i class="${x==="done"?"y":x==="skip"?"s":""}"></i>`;
  }
  const num = h.type === "number";
  const act = num
    ? `<div class="stepper"><button data-inc="${h.id}" data-d="-1" aria-label="${esc(h.name)} weniger">−</button><input id="num-${h.id}" data-num="${h.id}" inputmode="decimal" value="${typeof v==="number"?v:""}" placeholder="0" aria-label="${esc(h.name)} Wert"><button data-inc="${h.id}" data-d="1" aria-label="${esc(h.name)} mehr">+</button></div>`
    : "";
  const hint = idx >= 0 && idx < 9 ? `<span class="kbd">${idx+1}</span>` : "";
  return `<div class="h ${st==="done"?"done":st==="skip"?"skip":""}" style="--hc:${hc(h)}">
    <button class="chk" data-tog="${h.id}" aria-pressed="${st==="done"}" aria-label="${esc(h.name)} ${st==="done"?"erledigt":"offen"}">${CHECK_SVG}</button>
    <div class="hmain" data-tog="${h.id}">
      <span class="hname">${esc(h.name)}${num?` <span class="muted" style="font-weight:400">· Ziel ${h.target||1}${h.unit?" "+esc(h.unit):""}</span>`:""}${twice?'<span class="twice" title="Letztes Mal verpasst. Einmal ist ein Ausrutscher, zweimal der Anfang einer neuen Gewohnheit.">Nicht zweimal verpassen</span>':""}</span>${h.cue?`<span class="cue">→ ${esc(h.cue)}</span>`:""}
      <span class="hsub"><span class="dots" aria-hidden="true">${dots}</span><span class="streak">Serie <b class="num">${s.cur}</b> · Best <span class="num">${s.best}</span></span>${hint}</span>
    </div>
    <div class="hact">${act}<button class="skipbtn" data-skip="${h.id}" aria-pressed="${st==="skip"}">${st==="skip"?"Ausgesetzt":"Aussetzen"}</button></div>
  </div>`;
}

export function emptyState(){
  return `<div class="card empty">
    <h2>Fang mit deinem alten Fortschritt an</h2>
    <p class="muted">Importiere den Notion-Export deines Habit Trackers. Deine Serien und Quoten werden aus den alten Tagen berechnet, du verlierst nichts.</p>
    <div class="row" style="justify-content:center"><a class="btn primary" href="#import">Notion-Export importieren</a><a class="btn" href="#gewohnheiten">Gewohnheit anlegen</a></div>
  </div>`;
}
