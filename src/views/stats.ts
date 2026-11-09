// @ts-nocheck
import { S, ui } from "../state";
import { emptyState } from "./today";
import { dayScore, habitStats, hc, overallStats, scheduled, startOf, stateOf, valOf } from "../domain/habits";
import { MON, MON_S, WD, WD_LONG, addDays, esc, fromKey, keyOf, todayKey, wdOf } from "../lib/util";

// ----- Stats -----
export function vStats(){
  if (!S.habits.length) return emptyState();
  const list = S.habits;
  const h = ui.statSel === "all" ? null : list.find(x => x.id === ui.statSel);
  if (!h && ui.statSel !== "all") ui.statSel = "all";
  const chips = `<div class="chips"><button class="chip" data-sel="all" aria-pressed="${ui.statSel==="all"}">Alle</button>${list.map(x=>`<button class="chip" style="--hc:${hc(x)}" data-sel="${x.id}" aria-pressed="${ui.statSel===x.id}"><span class="sw"></span>${esc(x.name)}${x.archived?' <span class="muted">(arch.)</span>':""}</button>`).join("")}</div>`;
  let kpis;
  const o = overallStats();
  if (h){
    const s = habitStats(h);
    kpis = kpi("Aktuelle Serie", s.cur, "Tage") + kpi("Beste Serie", s.best, "Tage") + kpi("Quote gesamt", Math.round(s.rate*100), "%") + kpi("Letzte 30 Tage", Math.round(s.rate30*100), "%") + (h.type==="number" ? kpi("Summe", fmtNum(s.total), esc(h.unit||"")) : kpi("Erledigt", s.done, "mal"));
  } else {
    kpis = kpi("Getrackte Tage", o.tracked, "") + kpi("Ø Erfüllung", Math.round(o.avg*100), "%") + kpi("Perfekte Tage", o.perfect, "") + kpi("Perfekt in Folge", o.perfCur, `· Best ${o.perfBest}`);
  }
  // years
  const y0 = Number((h ? startOf(h) : o.first).slice(0,4)), y1 = new Date().getFullYear();
  if (ui.statYear < y0 || ui.statYear > y1) ui.statYear = y1;
  let yb = ""; for (let y = y1; y >= y0; y--) yb += `<button class="btn ${y===ui.statYear?"primary":""}" data-year="${y}">${y}</button>`;
  return `${chips}<div class="kpis">${kpis}</div>
  <div class="card" style="display:flex;flex-direction:column;gap:12px">
    <div class="row" style="justify-content:space-between"><div><h3>Jahresübersicht</h3><p class="cap">${h ? "Jeder Tag einzeln." : "Anteil der an dem Tag erledigten Gewohnheiten."}</p></div><div class="yearbtns">${yb}</div></div>
    ${heatmap(h, ui.statYear)}
  </div>
  <div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
    <div class="card" style="display:flex;flex-direction:column;gap:12px;min-width:0"><h3>Nach Wochentag</h3><p class="cap">Anteil erledigter Gewohnheiten in %, seit Beginn. Der andersfarbige Balken ist dein schwächster Tag.</p>${weekdayBars(h)}</div>
    <div class="card" style="display:flex;flex-direction:column;gap:12px;min-width:0"><h3>Letzte 12 Monate</h3><p class="cap">Anteil erledigter Gewohnheiten pro Monat in %.</p>${monthBars(h)}</div>
  </div>`;
}

export const fmtNum = n => (Math.round(n*10)/10).toLocaleString("de-DE");

export function kpi(l, v, unit){ return `<div class="kpi"><span class="label">${l}</span><span class="v">${v}<small>${unit}</small></span></div>`; }

export const bucket = p => p >= 1 ? 4 : p >= 0.8 ? 3 : p >= 0.5 ? 2 : p > 0 ? 1 : 0;

export const pctTxt = p => `${Math.round(p*100)} %`;

export function heatmap(h, year){
  const list = h ? [h] : S.habits, t = todayKey();
  const jan1 = `${year}-01-01`, dec31 = `${year}-12-31`;
  let k = addDays(jan1, -wdOf(jan1));
  const color = h ? hc(h) : "var(--accent)";
  let cells = "", months = "", lastM = -1;
  while (k <= dec31){
    if (wdOf(k) === 0){
      const m = fromKey(k < jan1 ? jan1 : k).getMonth();
      months += `<span>${m !== lastM ? MON_S[m] : ""}</span>`; lastM = m;
    }
    const inYear = k >= jan1 && k <= dec31;
    const dl = `${fromKey(k).getDate()}. ${MON_S[fromKey(k).getMonth()]}`;
    let cls = "x", style = "", tip = "";
    if (inYear && k <= t){
      if (h){
        if (scheduled(h,k)){
          const st = stateOf(h,k); cls = st === "skip" ? "s" : "";
          if (st === "done") style = `background:${color}`; else if (st === "part") style = `background:color-mix(in srgb,${color} 40%,var(--sunk))`;
          tip = `${dl}: ${st === "done" ? "erledigt" : st === "skip" ? "ausgesetzt" : st === "part" ? "teilweise" : "nicht erledigt"}`;
        }
      } else {
        const sc = dayScore(k, list);
        if (sc.p === null){
          const anySkip = list.some(x => scheduled(x,k) && stateOf(x,k) === "skip");
          if (anySkip){ cls = "s"; tip = `${dl}: alles ausgesetzt`; }
        } else { cls = "q" + bucket(sc.p); tip = `${dl}: ${sc.d}/${sc.s} · ${pctTxt(sc.p)}`; }
      }
    } else if (inYear) cls = "";
    const sel = ui.heatInfo === k ? " sel" : "";
    cells += (tip ? `<i class="${cls}${sel}" style="${style}" title="${tip}" data-hk="${k}"></i>` : `<i class="${cls}" style="${style}"></i>`);
    k = addDays(k, 1);
  }
  const legend = h
    ? `<div class="legend"><span><i style="background:var(--sunk)"></i>nicht erledigt</span><span><i style="background:${color}"></i>erledigt</span><span><i style="background:repeating-linear-gradient(45deg,var(--muted) 0 1px,transparent 1px 3px)"></i>ausgesetzt</span></div>`
    : `<div class="legend" aria-label="Legende"><span><i class="q0"></i>0 %</span><span><i class="q1"></i>1–49 %</span><span><i class="q2"></i>50–79 %</span><span><i class="q3"></i>80–99 %</span><span><i class="q4"></i>100 %</span><span><i style="background:repeating-linear-gradient(45deg,var(--muted) 0 1px,transparent 1px 3px)"></i>ausgesetzt</span></div>`;
  return `<div class="heatwrap"><div class="months">${months}</div><div class="heat">${cells}</div></div>${legend}${heatInfoLine(h)}`;
}

export function heatInfoLine(h){
  if (!ui.heatInfo) return `<p class="hinfo muted">Tippe auf einen Tag, um den genauen Wert zu sehen.</p>`;
  const k = ui.heatInfo, d = fromKey(k), dl = `${WD_LONG[wdOf(k)]}, ${d.getDate()}. ${MON[d.getMonth()]} ${d.getFullYear()}`;
  let txt;
  if (h){
    const st = scheduled(h,k) ? stateOf(h,k) : "off";
    const v = valOf(h,k);
    txt = st === "done" ? "erledigt" : st === "skip" ? "ausgesetzt" : st === "off" ? "nicht geplant" : st === "part" ? `teilweise (${v}${h.unit?" "+esc(h.unit):""})` : "nicht erledigt";
  } else {
    const sc = dayScore(k, S.habits);
    txt = sc.p === null ? "nichts geplant oder ausgesetzt" : `${sc.d} von ${sc.s} erledigt · <span class="pct">${pctTxt(sc.p)}</span>`;
  }
  return `<p class="hinfo"><b>${dl}</b><span>${txt}</span><button class="btn" data-open="${k}">Tag öffnen</button></p>`;
}

export function barChart(items, dense){
  const n = items.length;
  const cols = `grid-template-columns:repeat(${n},1fr)`;
  const slots = items.map(o => o.p == null
    ? `<div class="slot"><span class="bv empty">–</span></div>`
    : `<div class="slot"><div class="col ${o.low?"low":""}" style="height:${Math.round(o.p*100)}%" title="${o.title}: ${pctTxt(o.p)}"><span class="bv">${Math.round(o.p*100)}${dense?"":" "}%</span></div></div>`).join("");
  return `<div class="chart ${dense?"dense":""}" role="img" aria-label="${items.map(o=>`${o.title} ${o.p==null?"keine Daten":pctTxt(o.p)}`).join(", ")}">
    <div class="yax" aria-hidden="true"><span>100 %</span><span>75 %</span><span>50 %</span><span>25 %</span><span>0 %</span></div>
    <div class="plot" style="${cols}">${slots}</div>
    <div></div><div class="xl" style="${cols}">${items.map(o=>`<span>${o.l}</span>`).join("")}</div>
  </div>`;
}

export function weekdayBars(h){
  const list = h ? [h] : S.habits, t = todayKey();
  const sc = Array(7).fill(0), dn = Array(7).fill(0);
  let first = t; for (const x of list) if (startOf(x) < first) first = startOf(x);
  let k = first, g = 0;
  while (k < t && g++ < 20000){ const r = dayScore(k, list); const w = wdOf(k); sc[w] += r.s; dn[w] += r.d; k = addDays(k,1); }
  const p = sc.map((v,i) => v ? dn[i]/v : null), valid = p.filter(v => v != null), mn = valid.length ? Math.min(...valid) : null;
  return barChart(p.map((v,i) => ({ l: WD[i], title: WD_LONG[i], p: v, low: v != null && v === mn && valid.length > 1 })), false);
}

export function monthBars(h){
  const list = h ? [h] : S.habits, t = todayKey(), now = fromKey(t);
  const out = [];
  for (let i = 11; i >= 0; i--){
    const m = new Date(now.getFullYear(), now.getMonth()-i, 1, 12);
    let k = keyOf(m), s = 0, d = 0; const mm = m.getMonth();
    while (fromKey(k).getMonth() === mm && k <= t){ const sc = dayScore(k, list); s += sc.s; d += sc.d; k = addDays(k,1); }
    out.push({ l: MON_S[mm].slice(0,1), title: `${MON[mm]} ${m.getFullYear()}`, p: s ? d/s : null });
  }
  return barChart(out, true);
}
