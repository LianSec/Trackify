// @ts-nocheck
import { MARTIAL, METRICS, TT, autoMetric, chartData, exKey, exNames, exSeries, lineChart, metricPts, prsOf, tc, tcfg, trSorted, trSummary, ttOf, weekBars } from "./training";
import { MON, WD, addDays, esc, fromKey, todayKey, wdOf } from "../lib/util";
import { fmtNum, kpi } from "../views/stats";
import { fmtDate } from "./monk";
import { S, ui } from "../state";
import { shotBox } from "./screenshot";

// Entwurf lokal sichern, falls die Seite beim Training neu lädt
export const DRAFT_KEY = "trackify-trdraft";

export function trDraftSave(){ try { if (ui.trEdit) localStorage.setItem(DRAFT_KEY, JSON.stringify(ui.trEdit)); else localStorage.removeItem(DRAFT_KEY); } catch(e){} }

export function trDraftLoad(){ try { const v = localStorage.getItem(DRAFT_KEY); if (v && !ui.trEdit){ ui.trEdit = JSON.parse(v); return true; } } catch(e){} return false; }

export function lastTime(name, d){
  const k = exKey(name); if (!k) return null;
  for (const s of trSorted()) if (s.id !== d.id && s.k <= d.k) for (const e of s.ex || []) if (exKey(e.n) === k && (e.sets || []).length) return { k: s.k, sets: e.sets };
  return null;
}

export function exInfo(e, d){
  const lt = lastTime(e.n, d), bits = [];
  if (e.plan) bits.push(`<span><span class="label">Plan</span> <b class="num">${e.plan} × ${esc(e.target || "?")}</b></span>`);
  if (lt) bits.push(`<span><span class="label">Letztes Mal</span> <span class="num">${lt.sets.map(x => `${fmtNum(+x[0])}×${x[1]}`).join(", ")}</span> <span class="muted">${fmtDate(lt.k)}</span></span>`);
  if (e.note) bits.push(`<span class="muted">${esc(e.note)}</span>`);
  return bits.length ? `<div class="row" style="gap:4px 14px;font-size:12.5px">${bits.join("")}</div>` : "";
}

export function trEditor(){
  const d = ui.trEdit, isGym = d.type === "gym", mar = MARTIAL.has(d.type);
  const titles = [...new Set(S.train.sess.filter(x => x.type === "gym" && x.title).map(x => x.title))];
  const exl = exNames();
  const exHtml = isGym ? `<div style="display:flex;flex-direction:column;gap:8px">
      ${d.ex.map((e, i) => `<div class="exb">
        <div class="top"><input id="tr-ex-${i}" list="tr-exlist" value="${esc(e.n)}" placeholder="Übung, z. B. Bankdrücken" aria-label="Übung ${i + 1}"><button class="xbtn" type="button" data-tr="rmex" data-a="${i}" aria-label="Übung entfernen">✕</button></div>
        ${exInfo(e, d)}
        <div class="sets"><span class="sh">#</span><span class="sh">kg</span><span class="sh">Wdh.</span><span></span>
        ${e.sets.map((st, j) => `<span class="n">${j + 1}</span><input id="tr-w-${i}-${j}" inputmode="decimal" value="${esc(st[0])}" placeholder="0" aria-label="Gewicht Satz ${j + 1}"><input id="tr-r-${i}-${j}" inputmode="numeric" value="${esc(st[1])}" placeholder="${esc(e.target || "0")}" aria-label="Wiederholungen Satz ${j + 1}"><button class="xbtn" type="button" data-tr="rmset" data-a="${i}|${j}" aria-label="Satz entfernen">−</button>`).join("")}
        </div>
        <div class="row"><button class="btn" type="button" data-tr="addset" data-a="${i}">+ Satz</button></div>
      </div>`).join("")}
      <div class="row"><button class="btn" type="button" data-tr="addex">+ Übung</button><button class="btn ghost" type="button" data-tr="copy">Wie letztes Mal${d.title ? ` (${esc(d.title)})` : ""}</button></div>
      <datalist id="tr-exlist">${exl.map(x => `<option value="${esc(x.n)}"></option>`).join("")}</datalist>
    </div>` : "";
  return `<div class="card ted">
    <div class="row" style="justify-content:space-between"><h3>${S.train.sess.some(x => x.id === d.id) ? "Einheit bearbeiten" : "Training eintragen"}</h3><input type="date" id="tr-date" value="${d.k}" style="width:auto"></div>
    <div class="chiprow">${TT.map(tt => `<button class="pill tchip" style="--tc:${tc(tt[0])}" data-tr="type" data-a="${tt[0]}" aria-pressed="${d.type === tt[0]}"><i></i>${tt[1]}</button>`).join("")}</div>
    ${isGym ? `<div class="field"><label class="label" for="tr-title">Name der Einheit</label><input id="tr-title" list="tr-titles" value="${esc(d.title)}" placeholder="z. B. Fullbody A"><datalist id="tr-titles">${titles.map(x => `<option value="${esc(x)}"></option>`).join("")}</datalist></div>` : ""}
    ${isGym && ui.shotOK ? shotBox() : ""}
    ${exHtml}
    <div class="grid2">
      <div class="field"><label class="label" for="tr-dur">Dauer (Min)${isGym ? " · optional" : ""}</label><input id="tr-dur" inputmode="numeric" value="${esc(d.dur)}" placeholder="${isGym ? "z. B. 75" : "z. B. 60"}"></div>
      ${mar ? `<div class="field"><label class="label" for="tr-rounds">Sparring-Runden</label><input id="tr-rounds" inputmode="numeric" value="${esc(d.rounds)}" placeholder="0"></div>` : ""}
      ${d.type === "cardio" ? `<div class="field"><label class="label" for="tr-dist">Distanz (km, optional)</label><input id="tr-dist" inputmode="decimal" value="${esc(d.dist)}"></div>` : ""}
    </div>
    ${!isGym ? `<div class="chiprow">${[30,45,60,90,120].map(m => `<button class="pill" data-tr="dur" data-a="${m}" aria-pressed="${String(d.dur) === String(m)}">${m} Min</button>`).join("")}</div>` : ""}
    ${d.type === "bjj" ? `<div class="chiprow">${[["gi","Gi"],["nogi","No-Gi"]].map(([v, l]) => `<button class="pill" data-tr="gi" data-a="${v}" aria-pressed="${d.gi === v}">${l}</button>`).join("")}</div>` : ""}
    ${mar ? `<div class="field"><span class="label">Intensität (1 = locker, 10 = am Limit)</span><div class="chiprow">${Array.from({ length: 10 }, (_, i) => `<button class="pill" data-tr="rpe" data-a="${i + 1}" aria-pressed="${d.rpe === i + 1}" style="min-width:38px">${i + 1}</button>`).join("")}</div></div>
      <div class="field"><label class="label" for="tr-focus">Techniken / Fokus</label><input id="tr-focus" value="${esc(d.focus)}" placeholder="z. B. Guard Passing, Jab-Cross-Low-Kick"></div>` : ""}
    ${d.type === "cardio" || d.type === "other" ? `<div class="field"><label class="label" for="tr-focus">Was?</label><input id="tr-focus" value="${esc(d.focus)}" placeholder="z. B. Rudern, Laufen"></div>` : ""}
    <div class="field"><label class="label" for="tr-notes">Notizen</label><textarea id="tr-notes" placeholder="Wie lief es? Was nimmst du mit?">${esc(d.notes)}</textarea></div>
    <div class="row"><button class="btn primary" data-tr="save">Speichern</button><button class="btn ghost" data-tr="cancel">Abbrechen</button>${S.train.sess.some(x => x.id === d.id) ? `<button class="btn danger" data-tr="del" data-a="${d.id}">Löschen</button>` : ""}</div>
  </div>`;
}

export const OTHER_EQ = /\((anderes Gym|anderes Gerät|anderer Kabelturm|leichter Kabelturm)\)/;

export function exSelectOpts(exl){
  const opt = x => `<option value="${esc(x.n)}" ${exKey(x.n) === exKey(ui.trEx) ? "selected" : ""}>${esc(x.n)} (${x.c}×)</option>`;
  const other = exl.filter(x => OTHER_EQ.test(x.n)), main = exl.filter(x => !OTHER_EQ.test(x.n));
  const often = main.filter(x => x.c >= 3), rare = main.filter(x => x.c < 3);
  return [["Häufig", often], ["Selten (unter 3×)", rare], ["Andere Geräte & Gyms", other]].filter(g => g[1].length).map(([l, g]) => `<optgroup label="${l}">${g.map(opt).join("")}</optgroup>`).join("");
}

export function allTime(){
  const ss = S.train.sess; if (!ss.length) return "";
  const t = todayKey(), first = ss.reduce((a, x) => x.k < a ? x.k : a, t);
  const rows = TT.map(([id, l]) => { const xs = ss.filter(x => x.type === id); const min = xs.reduce((a, x) => a + (+x.dur || 0), 0), nod = xs.filter(x => !(+x.dur)).length; return { id, l, n: xs.length, min, nod, first: xs.reduce((a, x) => !a || x.k < a ? x.k : a, null) }; }).filter(r => r.n);
  const totMin = rows.reduce((a, r) => a + r.min, 0), noDur = rows.reduce((a, r) => a + r.nod, 0);
  const estMin = rows.reduce((a, r) => a + r.min + (r.n - r.nod ? r.nod * r.min / (r.n - r.nod) : 0), 0);
  const martial = ss.filter(x => MARTIAL.has(x.type)).length;
  let sets = 0, reps = 0, ton = 0;
  for (const x of ss) for (const e of x.ex || []) for (const st of e.sets || []){ sets++; reps += +st[1] || 0; ton += (+st[0] || 0) * (+st[1] || 0); }
  // Wochen mit mindestens einer Einheit, längste Serie
  const wk = k => addDays(k, -wdOf(k)), weeks = new Set(ss.map(x => wk(x.k)));
  let best = 0, cur = 0, run = 0;
  for (let w = wk(first); w <= wk(t); w = addDays(w, 7)){ if (weeks.has(w)){ run++; best = Math.max(best, run); } else run = 0; }
  for (let w = wk(t); weeks.has(w) || w === wk(t); w = addDays(w, -7)){ if (weeks.has(w)) cur++; else if (w !== wk(t)) break; if (w < first) break; }
  const totWeeks = Math.max(1, Math.round((fromKey(t) - fromKey(first)) / (7 * 864e5)));
  const h = m => fmtNum(Math.round(m / 6) / 10);
  const d = k => fromKey(k).toLocaleDateString("de-DE", { month: "short", year: "numeric" });
  return `<div class="card" style="display:flex;flex-direction:column;gap:12px">
    <div><h3>Gesamt seit ${d(first)}</h3><p class="cap">Alle Einheiten aus deinen Importen und Einträgen. ${noDur ? `${noDur} Einheiten (vor allem aus WhatsApp) haben keine Dauer. Mit deiner Ø-Dauer geschätzt kommst du auf <b class="num">ca. ${fmtNum(Math.round(estMin / 60))} Std</b>.` : ""}</p></div>
    <div class="kpis">${kpi("Einheiten", ss.length, "")}${kpi(noDur ? "Erfasst trainiert" : "Trainiert", h(totMin), "Std")}${kpi("Im Gym", rows.find(r => r.id === "gym")?.n || 0, "×")}${kpi("Kampfsport", martial, "Einheiten")}</div>
    <div class="tablewrap"><table><thead><tr><th>Art</th><th>Einheiten</th><th>Stunden</th><th>Ø Dauer</th><th>Seit</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><span class="tchip" style="--tc:${tc(r.id)}"><i></i>${r.l}</span></td><td class="num">${r.n}</td><td class="num">${h(r.min)}</td><td class="num">${r.n - r.nod ? Math.round(r.min / (r.n - r.nod)) + " Min" : "–"}</td><td class="num muted">${d(r.first)}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="row" style="gap:6px 22px;font-size:13.5px">
      <span><span class="label">Sätze</span> <b class="num">${sets.toLocaleString("de-DE")}</b></span>
      <span><span class="label">Wiederholungen</span> <b class="num">${reps.toLocaleString("de-DE")}</b></span>
      <span><span class="label">Bewegtes Gewicht</span> <b class="num">${fmtNum(Math.round(ton / 100) / 10)} t</b></span>
      <span><span class="label">Ø pro Woche</span> <b class="num">${fmtNum(Math.round(ss.length / totWeeks * 10) / 10)}</b> Einheiten</span>
      <span><span class="label">Längste Serie</span> <b class="num">${best}</b> Wochen am Stück</span>
      <span><span class="label">Aktuell</span> <b class="num">${cur}</b> ${cur === 1 ? "Woche" : "Wochen"} am Stück</span>
    </div>
  </div>`;
}

export function vTrain(){
  for (const k in chartData) delete chartData[k];
  const t = todayKey(), monday = addDays(t, -wdOf(t)), wk = S.train.sess.filter(x => x.k >= monday && x.k <= t);
  const martialMin = wk.filter(x => MARTIAL.has(x.type)).reduce((a, x) => a + (+x.dur || 0), 0);
  const monthPre = t.slice(0, 7), prCount = S.train.sess.filter(x => x.k.startsWith(monthPre)).reduce((a, x) => a + prsOf(x).length, 0);
  const exl = exNames(); if (!ui.trEx || !exl.some(x => exKey(x.n) === exKey(ui.trEx))) ui.trEx = exl.length ? (exl.find(x => !OTHER_EQ.test(x.n)) || exl[0]).n : null;
  const raw = ui.trEx ? exSeries(ui.trEx) : [], bw = raw.length && raw.every(p => p.bw);
  const auto = autoMetric(raw), metric = bw ? "reps" : (ui.trMetric && ui.trMetric !== "auto" ? ui.trMetric : auto);
  const ser = metricPts(raw, metric), unit = metric === "reps" ? "Wdh." : metric === "vol" ? "kg×Wdh." : "kg";
  const fmtDY = k => fmtDate(k) + (k.slice(0, 4) !== todayKey().slice(0, 4) ? " " + k.slice(0, 4) : "");
  const setTxt = p => p.top && !p.bw ? `${fmtNum(+p.top[0])} kg × ${p.top[1]}` : `${p.v} Wdh.${metric === "reps" && !bw ? " (KG)" : ""}`;
  let delta = null;
  if (ser.length >= 2){
    const last = ser[ser.length - 1], win = ser.filter(p => p.k >= addDays(last.k, -90));
    const ref = (metric === "reps" ? win.find(p => p.w === last.w) : null) || win[0] || ser[0];
    if (metric === "reps" && !bw && ref.w !== last.w){ const dw = last.w - ref.w; delta = { v: `${dw >= 0 ? "+" : "−"}${fmtNum(Math.abs(dw))} kg`, sub: `Gewicht seit ${fmtDY(ref.k)} (${setTxt(ref)} → ${setTxt(last)})` }; }
    else { const dv = last.v - ref.v; delta = { v: `${dv >= 0 ? "+" : "−"}${fmtNum(Math.abs(Math.round(dv * 10) / 10))} ${unit}`, sub: `seit ${fmtDY(ref.k)}` }; }
  }
  // Bestwert: bei Wdh. zuerst das höchste Gewicht, dann die meisten Wdh.
  const best = ser.length ? ser.reduce((a, p) => (metric === "reps" && !bw ? (p.w > a.w || (p.w === a.w && p.v > a.v)) : p.v > a.v) ? p : a, ser[0]) : null;
  const capTxt = { e1rm: "Geschätztes 1RM pro Einheit (Epley: Gewicht × (1 + Wdh./30)). Gut für 1–10 Wiederholungen.", top: "Schwerstes Gewicht pro Einheit, egal wie viele Wiederholungen.", vol: "Dein bester Satz als Gewicht × Wiederholungen. Steigt, wenn du mehr Gewicht oder mehr Wiederholungen schaffst. Gut für Maschinen und hohe Wiederholungszahlen.", reps: bw ? "Meiste Wiederholungen pro Einheit." : "Meiste Wiederholungen mit deinem schwersten Gewicht der Einheit. Jedes Gewicht hat ein eigenes Linienstück, die Zahl darüber zeigt das Gewicht (KG = nur Körpergewicht)." }[metric];
  const log = trSorted().slice(0, ui.trMore ? 200 : 10), logTotal = S.train.sess.length;
  const c = tcfg();
  return `<div class="row" style="justify-content:space-between"><h2>Training</h2>${ui.trEdit ? "" : `<div class="row"><button class="btn" data-tr="new" data-a="bjj">+ Kampfsport</button><button class="btn primary" data-tr="new" data-a="gym">+ Gym</button>${ui.shotOK ? `<label class="btn" for="tr-shot2" style="cursor:pointer">Aus Screenshot</label><input type="file" id="tr-shot2" accept="image/png,image/jpeg,image/webp" hidden>` : ""}</div>`}</div>
  ${ui.trEdit ? trEditor() : ""}
  <div class="kpis">${kpi("Diese Woche", wk.length, wk.length === 1 ? "Einheit" : "Einheiten")}${kpi("Kampfsport", fmtNum(Math.round(martialMin / 6) / 10), "Std")}${kpi("Gym", wk.filter(x => x.type === "gym").length, "×")}${kpi("Bestwerte", prCount, "im " + MON[new Date().getMonth()])}</div>
  <div class="card" style="display:flex;flex-direction:column;gap:12px">
    <div class="row" style="justify-content:space-between"><div><h3>Kraft-Entwicklung</h3><p class="cap">${capTxt} Gestrichelt: Pause über 6 Wochen.</p></div>
      ${exl.length ? `<select id="tr-exsel" style="border:1px solid var(--line);border-radius:8px;background:var(--bg);padding:7px 10px;max-width:240px" aria-label="Übung wählen">${exSelectOpts(exl)}</select>` : ""}</div>
    ${ui.trEx && !bw ? `<div class="chiprow" role="group" aria-label="Messgröße">${METRICS.map(([v, l]) => `<button class="pill" data-tr="metric" data-a="${v}" aria-pressed="${metric === v}">${l}${v === auto ? " · empfohlen" : ""}</button>`).join("")}</div>` : ""}
    ${ui.trEx ? `${best ? `<div class="row" style="gap:18px"><span><span class="label">Bestwert</span><br><b class="num" style="font-size:18px">${metric === "e1rm" ? `${fmtNum(best.v)} kg` : setTxt(best)}</b>${metric === "vol" ? ` <span class="muted num" style="font-size:12.5px">= ${fmtNum(best.v)}</span>` : ""} <span class="muted" style="font-size:12.5px">${fmtDY(best.k)}${metric === "e1rm" && best.top ? ` · ${setTxt(best)}` : ""}</span></span>${delta ? `<span><span class="label">Veränderung</span><br><b class="num" style="font-size:18px">${delta.v}</b> <span class="muted" style="font-size:12.5px">${delta.sub}</span></span>` : ""}</div>` : ""}${lineChart(ser, unit, metric === "reps" && !bw)}` : `<p class="cap">Trag deine erste Gym-Einheit ein, dann siehst du hier deinen Fortschritt pro Übung.</p>`}
  </div>
  ${allTime()}
  <div class="card" style="display:flex;flex-direction:column;gap:12px"><div><h3>Trainingszeit pro Woche</h3><p class="cap">Minuten der letzten 12 Wochen. Gym ohne Dauer zählt als 60 Min.</p></div>${weekBars()}</div>
  <div class="card row" style="justify-content:space-between"><div style="min-width:0;flex:1"><h3>Mit dem Tracker verknüpfen</h3><p class="cap">Jede eingetragene Einheit hakt diese Gewohnheit für den Tag ab.</p></div><select id="tr-hid" style="border:1px solid var(--line);border-radius:8px;background:var(--bg);padding:7px 10px"><option value="">Keine</option>${S.habits.filter(x => !x.archived).map(x => `<option value="${x.id}" ${x.id === c.hid ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div>
  <div style="display:flex;flex-direction:column;gap:8px"><h3>Letzte Einheiten</h3>
  ${log.length ? `<div class="tlog">${log.map(s => { const prs = prsOf(s); return `<div class="tl"><div class="hd"><span class="tchip" style="--tc:${tc(s.type)}"><i></i>${ttOf(s.type)[1]}${s.title ? ` · ${esc(s.title)}` : ""}${prs.length ? `<span class="pr">PR</span>` : ""}</span><span class="row" style="gap:8px"><span class="muted num" style="font-size:12.5px">${WD[wdOf(s.k)]}, ${fmtDate(s.k)}</span><button class="btn ghost" style="padding:3px 8px;font-size:12.5px" data-tr="edit" data-a="${s.id}">Bearbeiten</button></span></div><div class="ex">${trSummary(s)}</div>${s.notes ? `<div class="ex">${esc(s.notes)}</div>` : ""}</div>`; }).join("")}</div>`
    : `<div class="card empty"><p class="muted">Noch nichts eingetragen. Leg mit deiner nächsten Einheit los.</p></div>`}
  ${logTotal > log.length ? `<div class="row"><button class="btn" data-tr="more">Mehr anzeigen (${logTotal - log.length})</button></div>` : ""}</div>`;
}
