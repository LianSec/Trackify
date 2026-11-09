// @ts-nocheck
import { S, ui } from "../state";
import { MON_S, addDays, esc, fromKey, keyOf, pad, toast, todayKey, uid, wdOf } from "../lib/util";
import { fmtNum } from "../views/stats";
import { setVal, valOf } from "../domain/habits";
import { toNum } from "./import";
import { markDirty } from "../storage/persist";
import { trDraftSave } from "./training-editor";
import { fmtDate } from "./monk";
import { shotApply } from "./screenshot";
import { render } from "../views/render";

// ---------- Training ----------
export const TT = [["gym","Gym",0],["bjj","BJJ",1],["mma","MMA",2],["kick","Kickboxen",3],["cardio","Kardio",4],["other","Sonstiges",5]];

export const ttOf = id => TT.find(t => t[0] === id) || TT[5];

export const tc = id => `var(--t${ttOf(id)[2]})`;

export const MARTIAL = new Set(["bjj","mma","kick"]);

export const e1rm = (w, r) => (!w || !r) ? 0 : r === 1 ? w : w * (1 + r / 30);

export const exKey = n => String(n || "").trim().toLowerCase();

export function tcfg(){ const c = S.train.cfg || {}; let hid = c.hid; if (hid === undefined){ const m = S.habits.find(h => !h.archived && /sport|training|gym/i.test(h.name)); hid = m ? m.id : ""; } return { hid }; }

export function trSorted(){ return S.train.sess.slice().sort((a, b) => a.k < b.k ? 1 : a.k > b.k ? -1 : (b.ts || 0) - (a.ts || 0)); }

export function exNames(){
  const m = new Map();
  for (const s of S.train.sess) for (const e of s.ex || []){ const k = exKey(e.n); if (!k) continue; const o = m.get(k) || { n: e.n.trim(), c: 0 }; o.c++; m.set(k, o); }
  return [...m.values()].sort((a, b) => b.c - a.c);
}

export function sessBest(e){ let best = 0, top = null, reps = 0; for (const [w, r] of e.sets || []){ const v = e1rm(+w || 0, +r || 0); if (v > best){ best = v; top = [w, r]; } reps = Math.max(reps, +r || 0); } return { best, top, reps }; }

export function exSeries(name){
  // Rohdaten pro Tag: bestes geschätztes 1RM, schwerstes Gewicht und die meisten Wdh. bei diesem Gewicht
  const k = exKey(name), by = {};
  for (const s of S.train.sess) for (const e of s.ex || []) if (exKey(e.n) === k){
    const sets = (e.sets || []).map(x => [+x[0] || 0, +x[1] || 0]).filter(x => x[1] > 0); if (!sets.length) continue;
    const b = sessBest(e), topW = Math.max(...sets.map(x => x[0])), topR = Math.max(...sets.filter(x => x[0] === topW).map(x => x[1]));
    const vs = sets.reduce((a, x) => x[0] * x[1] > a[0] * a[1] ? x : a, sets[0]);
    const p = { k: s.k, e1: Math.round(b.best * 10) / 10, best: b.top, topW, topR, bw: topW === 0, reps: Math.max(...sets.map(x => x[1])), vol: Math.round(vs[0] * vs[1]), volSet: vs };
    const o = by[s.k];
    if (!o || p.e1 > o.e1 || (p.e1 === o.e1 && p.topR > o.topR)) by[s.k] = p;
  }
  return Object.values(by).sort((a, b) => a.k < b.k ? -1 : 1);
}

export const METRICS = [["e1rm","Geschätztes 1RM"],["vol","Gewicht × Wdh."],["top","Schwerstes Gewicht"],["reps","Wdh. pro Gewicht"]];

export function autoMetric(ser){
  if (!ser.length) return "e1rm";
  if (ser.every(p => p.bw) || ser.filter(p => p.bw).length >= ser.length * 0.3) return "reps";
  const r = ser.map(p => p.topR).sort((a, b) => a - b), med = r[Math.floor(r.length / 2)];
  return med > 12 ? "vol" : "e1rm";
}

export function metricPts(ser, m){
  return ser.map(p => {
    if (m === "e1rm") return { k: p.k, v: p.e1, top: p.best, bw: p.bw };
    if (m === "vol") return { k: p.k, v: p.vol, top: p.volSet, bw: p.bw };
    if (m === "top") return { k: p.k, v: p.topW, top: [p.topW, p.topR], bw: p.bw };
    return { k: p.k, v: p.bw ? p.reps : p.topR, top: [p.topW, p.topR], bw: p.bw, w: p.topW };
  });
}

export function prsOf(sess){
  // Übungen dieser Einheit mit neuem Bestwert gegenüber allen früheren Einheiten
  const out = [];
  for (const e of sess.ex || []){
    const b = sessBest(e).best; if (!b) continue;
    let prev = 0, any = false;
    for (const s of S.train.sess) if (s !== sess && (s.k < sess.k || (s.k === sess.k && (s.ts || 0) < (sess.ts || 0)))) for (const x of s.ex || []) if (exKey(x.n) === exKey(e.n)){ any = true; prev = Math.max(prev, sessBest(x).best); }
    if (any && b > prev + 0.05) out.push({ n: e.n, v: b });
  }
  return out;
}

export function trSummary(s){
  if (s.type === "gym" && (s.ex || []).length) return s.ex.map(e => { const b = sessBest(e); const bwx = (e.sets || []).every(x => !(+x[0])); return `<b>${esc(e.n)}</b> ${bwx ? `${b.reps} Wdh.` : b.top ? `${fmtNum(+b.top[0])} kg × ${b.top[1]}` : `${(e.sets||[]).length} Sätze`}`; }).join(" · ");
  const bits = [];
  if (s.dur) bits.push(`${s.dur} Min`);
  if (s.rpe) bits.push(`Intensität ${s.rpe}/10`);
  if (s.rounds) bits.push(`${s.rounds} Runden Sparring`);
  if (s.gi) bits.push(s.gi === "gi" ? "Gi" : "No-Gi");
  if (s.dist) bits.push(`${fmtNum(s.dist)} km`);
  if (s.focus) bits.push(esc(s.focus));
  return bits.join(" · ");
}

export function newDraft(type){ return { id: uid(), k: todayKey(), type: type || "gym", title: "", dur: "", rpe: 0, rounds: "", gi: "nogi", focus: "", dist: "", notes: "", ex: type === "gym" || !type ? [{ n: "", sets: [["", ""]] }] : [] }; }

export function trSyncHabit(k){
  const c = tcfg(), h = S.habits.find(x => x.id === c.hid); if (!h) return "";
  const mins = S.train.sess.filter(x => x.k === k).reduce((a, x) => a + (+x.dur || 0), 0);
  if (h.type === "number") setVal(k, h.id, Math.max(+valOf(h, k) || 0, mins || 1)); else setVal(k, h.id, 1);
  return ` „${esc(h.name)}“ abgehakt.`;
}

export function trSave(){
  const d = ui.trEdit; if (!d) return;
  const clean = { ...d, title: d.title.trim(), focus: d.focus.trim(), notes: d.notes.trim(), dur: toNum(d.dur) || 0, rounds: toNum(d.rounds) || 0, dist: toNum(d.dist) || 0, rpe: d.rpe || 0 };
  clean.ex = d.type === "gym" ? d.ex.map(e => ({ n: e.n.trim(), sets: e.sets.map(([w, r]) => [toNum(w) || 0, Math.round(toNum(r) || 0)]).filter(x => x[1] > 0) })).filter(e => e.n && e.sets.length) : [];
  if (d.type !== "gym"){ clean.ex = []; }
  if (d.type === "gym" && !clean.ex.length && !clean.dur){ toast("Trag mindestens eine Übung mit Wiederholungen ein."); return; }
  if (d.type !== "gym" && !clean.dur){ toast("Trag die Dauer in Minuten ein."); return; }
  if (!MARTIAL.has(d.type)){ delete clean.rounds; delete clean.rpe; }
  if (d.type !== "bjj") delete clean.gi;
  const old = S.train.sess.find(x => x.id === d.id);
  clean.ts = old ? old.ts : Date.now();
  if (old && old.k !== clean.k) markDirty("t-" + old.k.slice(0, 7));
  S.train.sess = S.train.sess.filter(x => x.id !== d.id).concat([clean]);
  markDirty("t-" + clean.k.slice(0, 7));
  const prs = prsOf(clean), sync = trSyncHabit(clean.k);
  ui.trEdit = null; trDraftSave();
  toast(prs.length ? `Neuer Bestwert: ${prs.map(p => `${p.n} (geschätztes 1RM ${fmtNum(Math.round(p.v * 10) / 10)} kg)`).join(", ")}!${sync}` : `Gespeichert.${sync}`);
  if (prs.length && !ui.trEx) ui.trEx = prs[0].n;
}

export function trAction(a, arg){
  const d = ui.trEdit;
  setTimeout(trDraftSave, 0);
  switch (a){
    case "new": ui.trEdit = newDraft(arg); break;
    case "cancel": ui.trEdit = null; trDraftSave(); break;
    case "type": d.type = arg; if (arg === "gym" && !d.ex.length) d.ex = [{ n: "", sets: [["", ""]] }]; break;
    case "edit": { const s = S.train.sess.find(x => x.id === arg); if (!s) return; ui.trEdit = JSON.parse(JSON.stringify({ ...newDraft(s.type), ...s, dur: s.dur || "", rounds: s.rounds || "", dist: s.dist || "", ex: (s.ex || []).map(e => ({ n: e.n, sets: e.sets.map(x => [String(x[0]), String(x[1])]) })) })); if (s.type === "gym" && !ui.trEdit.ex.length) ui.trEdit.ex = [{ n: "", sets: [["", ""]] }]; window.scrollTo(0, 0); break; }
    case "del": { const s = S.train.sess.find(x => x.id === arg); if (!s) return; S.train.sess = S.train.sess.filter(x => x.id !== arg); markDirty("t-" + s.k.slice(0, 7)); ui.trEdit = null; toast("Einheit gelöscht."); break; }
    case "save": trSave(); break;
    case "addex": d.ex.push({ n: "", sets: [["", ""]] }); break;
    case "rmex": d.ex.splice(+arg, 1); break;
    case "addset": { const e = d.ex[+arg]; const last = e.sets[e.sets.length - 1] || ["", ""]; e.sets.push([last[0], last[1]]); break; }
    case "rmset": { const [i, j] = arg.split("|").map(Number); d.ex[i].sets.splice(j, 1); if (!d.ex[i].sets.length) d.ex[i].sets.push(["", ""]); break; }
    case "rpe": d.rpe = d.rpe === +arg ? 0 : +arg; break;
    case "gi": d.gi = arg; break;
    case "dur": d.dur = arg; break;
    case "copy": {
      const prev = trSorted().find(x => x.type === "gym" && x.id !== d.id && (!d.title.trim() || exKey(x.title) === exKey(d.title)) && (x.ex || []).length);
      if (!prev){ toast("Keine passende frühere Einheit gefunden."); return; }
      d.title = d.title || prev.title || ""; d.ex = prev.ex.map(e => ({ n: e.n, sets: e.sets.map(x => [String(x[0]), String(x[1])]) }));
      toast(`Übungen von ${fmtDate(prev.k)} übernommen. Passe Gewicht und Wiederholungen an.`); break;
    }
    case "ex": ui.trEx = arg; break;
    case "more": ui.trMore = true; break;
    case "metric": ui.trMetric = arg; break;
    case "shotstop": if (ui.shot && ui.shot.ctl) ui.shot.ctl.abort(); ui.shot = null; break;
    case "shotday": { const dd = ui.shot && ui.shot.days && ui.shot.days[+arg]; ui.shot = null; if (dd) shotApply(dd); break; }
  }
  render();
}

export function lineChart(pts, unit, wLabels){
  if (pts.length < 2) return `<p class="cap">${pts.length ? "Ab zwei Einheiten mit dieser Übung siehst du hier die Kurve." : "Noch keine Daten."}</p>`;
  const W = chartW(), H = W < 500 ? 200 : 230, L = 40, R = 60, T = 16, B = 28;
  const t0 = fromKey(pts[0].k).getTime(), t1 = fromKey(pts[pts.length - 1].k).getTime(), span = Math.max(1, t1 - t0);
  let lo = Math.min(...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v));
  const pad = Math.max(1, (hi - lo) * 0.15); lo = Math.max(0, lo - pad); hi = hi + pad;
  const step = niceStep((hi - lo) / 4); lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const x = k => L + (fromKey(k).getTime() - t0) / span * (W - L - R), y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  let grid = ""; for (let v = lo; v <= hi + 1e-9; v += step) grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 8}" y="${y(v) + 3.5}" text-anchor="end">${fmtNum(v)}</text>`;
  // x-Ticks: Monatsanfänge
  let xt = ""; const d0 = fromKey(pts[0].k), d1 = fromKey(pts[pts.length - 1].k), months = (d1.getFullYear() - d0.getFullYear()) * 12 + d1.getMonth() - d0.getMonth();
  const every = Math.max(1, Math.ceil(months / 6));
  if (months > 18){
    for (let y = d0.getFullYear() + 1; y <= d1.getFullYear(); y++){ const k = `${y}-01-01`; xt += `<line x1="${x(k)}" x2="${x(k)}" y1="${H - B}" y2="${H - B + 4}" stroke="var(--muted)"/><text x="${x(k)}" y="${H - 8}" text-anchor="middle">${y}</text>`; }
  } else for (let i = 1; i <= months; i += every){ const m = new Date(d0.getFullYear(), d0.getMonth() + i, 1, 12), k = keyOf(m); xt += `<line x1="${x(k)}" x2="${x(k)}" y1="${H - B}" y2="${H - B + 4}" stroke="var(--muted)"/><text x="${x(k)}" y="${H - 8}" text-anchor="middle">${m.getMonth() === 0 ? m.getFullYear() : MON_S[m.getMonth()]}</text>`; }
  // Lücken über 6 Wochen werden gestrichelt verbunden statt durchgezogen
  let path = "", gaps = "";
  pts.forEach((p, i) => {
    const wchg = wLabels && i && p.w !== pts[i - 1].w;
    const gap = !wchg && i && (fromKey(p.k) - fromKey(pts[i - 1].k)) / 864e5 > 42;
    if (wchg){ path += `M${x(p.k).toFixed(1)},${y(p.v).toFixed(1)}`; return; }
    if (gap) gaps += `M${x(pts[i - 1].k).toFixed(1)},${y(pts[i - 1].v).toFixed(1)}L${x(p.k).toFixed(1)},${y(p.v).toFixed(1)}`;
    path += `${!i || gap ? "M" : "L"}${x(p.k).toFixed(1)},${y(p.v).toFixed(1)}`;
  });
  const area = pts.map((p, i) => `${i ? "L" : "M"}${x(p.k).toFixed(1)},${y(p.v).toFixed(1)}`).join("") + `L${x(pts[pts.length - 1].k).toFixed(1)},${H - B}L${L},${H - B}Z`;
  const last = pts[pts.length - 1], best = pts.reduce((a, p) => p.v > a.v ? p : a, pts[0]);
  // Gewichtswechsel beschriften (nur bei „Wdh. bei Top-Gewicht“)
  let wl = "";
  if (wLabels){ let prevW = null, lastX = -99; pts.forEach(p => { if (p.w !== prevW){ const px = x(p.k); if (px - lastX > 34){ wl += `<circle cx="${px}" cy="${y(p.v)}" r="2.5" fill="var(--t0)"/><text x="${px}" y="${y(p.v) - 9}" text-anchor="middle">${p.w ? fmtNum(p.w) + " kg" : "KG"}</text>`; lastX = px; } prevW = p.w; } }); }
  const dots = pts.length <= 16 ? pts.map(p => `<circle cx="${x(p.k)}" cy="${y(p.v)}" r="3" fill="var(--t0)" stroke="var(--surface)" stroke-width="2"/>`).join("") : "";
  const id = "lc" + uid();
  chartData[id] = { pts: pts.map(p => ({ x: x(p.k), y: y(p.v), k: p.k, v: p.v, top: p.top, bw: p.bw })), W, unit, T, B, H };
  return `<div class="chart-box" data-chart="${id}">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Verlauf, zuletzt ${fmtNum(last.v)} ${unit}, Bestwert ${fmtNum(best.v)} ${unit}">
      ${grid}<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="var(--muted)"/>${xt}
      ${wLabels ? "" : `<path d="${area}" fill="var(--t0)" opacity=".12"/>`}
      <path d="${path}" fill="none" stroke="var(--t0)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${gaps ? `<path d="${gaps}" fill="none" stroke="var(--t0)" stroke-width="1.5" stroke-dasharray="4 4" opacity=".6"/>` : ""}
      ${dots}${wl}
      <circle cx="${x(last.k)}" cy="${y(last.v)}" r="5" fill="var(--t0)" stroke="var(--surface)" stroke-width="2"/>
      <text class="lbl" x="${x(last.k) + 9}" y="${y(last.v) + 4}">${fmtNum(last.v)}${unit.length <= 4 ? " " + unit : ""}</text>
      <line class="xh" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="var(--muted)" stroke-dasharray="3 3" visibility="hidden"/>
      <circle class="xd" r="5" fill="var(--t0)" stroke="var(--surface)" stroke-width="2" visibility="hidden"/>
      <rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent" class="hit"/>
    </svg><div class="tip" hidden></div></div>`;
}

export const chartData = {};

export const chartW = () => Math.round(Math.min(640, Math.max(320, (window.innerWidth || 640) - 66)));

export function niceStep(raw){ const p = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }

export function weekBars(){
  const t = todayKey(), monday = addDays(t, -wdOf(t)), weeks = [];
  for (let i = 11; i >= 0; i--){ const a = addDays(monday, -7 * i), b = addDays(a, 6); const by = {}; let tot = 0; for (const s of S.train.sess) if (s.k >= a && s.k <= b){ const m = +s.dur || (s.type === "gym" ? 60 : 0); by[s.type] = (by[s.type] || 0) + m; tot += m; } weeks.push({ a, by, tot }); }
  const used = TT.filter(tt => weeks.some(w => w.by[tt[0]]));
  if (!used.length) return `<p class="cap">Noch keine Einheiten in den letzten 12 Wochen.</p>`;
  const W = chartW(), H = 200, L = 36, R = 8, T = 10, B = 26, max = Math.max(60, ...weeks.map(w => w.tot)), step = max >= 240 ? Math.ceil(niceStep(max / 4 / 60)) * 60 : niceStep(max / 4), top = Math.ceil(max / step) * step;
  const y = v => T + (1 - v / top) * (H - T - B), bw = (W - L - R) / weeks.length, gap = 6;
  let grid = ""; for (let v = 0; v <= top + 1e-9; v += step) grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end">${v >= 60 ? fmtNum(v / 60) + "h" : v}</text>`;
  const id = "wb" + uid(); chartData[id] = { bars: [] };
  let bars = "";
  weeks.forEach((w, i) => {
    let acc = 0; const x0 = L + i * bw + gap / 2, wdt = bw - gap;
    for (const tt of used){ const v = w.by[tt[0]] || 0; if (!v) continue; const y1 = y(acc + v), y0 = y(acc); bars += `<rect x="${x0}" y="${y1}" width="${wdt}" height="${Math.max(0, y0 - y1 - 2)}" rx="2" fill="${tc(tt[0])}"/>`; acc += v; }
    const d = fromKey(w.a); bars += `<text x="${x0 + wdt / 2}" y="${H - 8}" text-anchor="middle">${i % 2 === (weeks.length - 1) % 2 ? `${d.getDate()}.${d.getMonth() + 1}.` : ""}</text>`;
    chartData[id].bars.push({ x: x0 + wdt / 2, y: y(w.tot), a: w.a, by: w.by, tot: w.tot });
    bars += `<rect x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" fill="transparent" class="hitb" data-i="${i}"/>`;
  });
  const rows = weeks.slice().reverse().filter(w => w.tot).map(w => `<tr><td>${fmtDate(w.a)}</td>${used.map(tt => `<td class="num">${w.by[tt[0]] || "–"}</td>`).join("")}<td class="num"><b>${w.tot}</b></td></tr>`).join("");
  return `<div class="legend2">${used.map(tt => `<span style="--tc:${tc(tt[0])}"><i></i>${tt[1]}</span>`).join("")}</div>
  <div class="chart-box" data-chart="${id}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Trainingsminuten pro Woche, letzte 12 Wochen">${grid}<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="var(--muted)"/>${bars}</svg><div class="tip" hidden></div></div>
  <details><summary class="cap" style="cursor:pointer">Als Tabelle (Minuten)</summary><div class="tablewrap" style="margin-top:8px"><table class="dtable"><thead><tr><th>Woche ab</th>${used.map(tt => `<th>${tt[1]}</th>`).join("")}<th>Summe</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
}
