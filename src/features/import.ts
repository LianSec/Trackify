// @ts-nocheck
import { S, ui } from "../state";
import { NCOL, addDays, esc, fromKey, keyOf, toast, todayKey, uid } from "../lib/util";
import { TT, tc } from "./training";
import { fmtNum } from "../views/stats";
import { fmtDate } from "./monk";
import { P, markDirty, monthDocId } from "../storage/persist";
import { render } from "../views/render";
import { startOf } from "../domain/habits";

export function trImportFixedView(){
  const ss = ui.trImp.sessions, ks = ss.map(x => x.k).sort(), withEx = ss.filter(x => (x.ex || []).length).length;
  const by = {}; ss.forEach(x => by[x.type] = (by[x.type] || 0) + 1);
  const already = S.train.sess.filter(x => String(x.id).startsWith("imp-")).length;
  return `<div class="card" style="display:flex;flex-direction:column;gap:14px">
    <div class="row" style="justify-content:space-between"><h3>Trainingsdaten importieren</h3><button class="btn ghost" data-trimp="cancel">Abbrechen</button></div>
    <p style="margin:0"><b class="num">${ss.length}</b> Einheiten von <b>${fromKey(ks[0]).toLocaleDateString("de-DE")}</b> bis <b>${fromKey(ks[ks.length - 1]).toLocaleDateString("de-DE")}</b>. <b class="num">${withEx}</b> davon mit Übungen, der Rest nur mit Datum und Dauer.</p>
    <div class="chiprow">${TT.filter(t => by[t[0]]).map(t => `<span class="tchip pill" style="--tc:${tc(t[0])}"><i></i>${t[1]} <b class="num">${by[t[0]]}</b></span>`).join("")}</div>
    ${already ? `<p class="note-warn">Deine ${already} bisher importierten Einheiten werden ersetzt. Was du selbst eingetragen hast, bleibt.</p>` : ""}
    <div class="row"><button class="btn primary" data-trimp="go">Training importieren</button></div>
  </div>`;
}

export function trImportView(){
  if (ui.trImp.fixed) return trImportFixedView();
  const ex = ui.trImp.sessions.reduce((a, x) => a + (x.ex || []).length, 0), names = new Set(ui.trImp.sessions.flatMap(x => (x.ex || []).map(e => e.n)));
  const already = S.train.sess.filter(x => String(x.id).startsWith("imp-")).length;
  return `<div class="card" style="display:flex;flex-direction:column;gap:14px">
    <div class="row" style="justify-content:space-between"><h3>Trainingsdaten importieren</h3><button class="btn ghost" data-trimp="cancel">Abbrechen</button></div>
    <p class="cap" style="margin:0"><b class="num">${ui.trImp.sessions.length}</b> Einheiten · <b class="num">${ex}</b> Übungen · <b class="num">${names.size}</b> verschiedene Übungsnamen. In den Tabellen stehen keine Daten, deshalb werden sie geschätzt.</p>
    <div class="chiprow"><button class="pill" data-trimp="mode" data-a="spread" aria-pressed="${ui.trImp.mode === "spread"}">Gleichmäßig verteilen</button><button class="pill" data-trimp="mode" data-a="blocks" aria-pressed="${ui.trImp.mode === "blocks"}">Ein Block pro Woche</button></div>
    ${ui.trImp.mode === "spread" ? (() => {
      const kb = ui.trImp.blocks.find(b => b.id === ui.trImp.keep), rest = ui.trImp.sessions.filter(x => x.b !== ui.trImp.keep).length, days = Math.round((fromKey(ui.trImp.to) - fromKey(ui.trImp.from)) / 864e5);
      return `<p class="cap" style="margin:0">Alle Blöcke außer „${esc(kb ? kb.name : "")}“ werden in ihrer Reihenfolge gleichmäßig auf den Zeitraum verteilt. Das passt, wenn du Einheiten nachgeholt hast und nicht jede Woche alle geschafft hast.</p>
      <div class="grid2">
        <div class="field"><label class="label" for="trimp-from">Erste Einheit</label><input type="date" id="trimp-from" value="${ui.trImp.from}" style="border:1px solid var(--line);border-radius:8px;background:var(--bg);padding:7px 10px"></div>
        <div class="field"><label class="label" for="trimp-to">Letzte Einheit vor der Pause</label><input type="date" id="trimp-to" value="${ui.trImp.to}" style="border:1px solid var(--line);border-radius:8px;background:var(--bg);padding:7px 10px"></div>
        ${kb ? `<div class="field"><label class="label" for="trimp-${kb.id}">${esc(kb.name)}: Start (Montag)</label><input type="date" id="trimp-${kb.id}" value="${kb.start}" style="border:1px solid var(--line);border-radius:8px;background:var(--bg);padding:7px 10px"></div>` : ""}
      </div>
      <p class="cap" style="margin:0"><b class="num">${rest}</b> Einheiten auf <b class="num">${days}</b> Tage, also etwa alle <b class="num">${fmtNum(Math.round(days / Math.max(1, rest - 1) * 10) / 10)}</b> Tage eine (<b class="num">${fmtNum(Math.round(rest / Math.max(1, days) * 70) / 10)}</b> pro Woche).</p>`;
    })() : `<div class="tablewrap"><table><thead><tr><th>Block</th><th>Einheiten</th><th>Start (Montag)</th><th>Ende ca.</th></tr></thead><tbody>
      ${ui.trImp.blocks.map(b => `<tr><td><b>${esc(b.name)}</b></td><td class="num">${b.count}</td><td><input type="date" id="trimp-${b.id}" value="${b.start}"></td><td class="num muted">${fmtDate(addDays(b.start, (b.weeks || 1) * 7 - 1))} ${addDays(b.start, (b.weeks || 1) * 7 - 1).slice(0,4)}</td></tr>`).join("")}
    </tbody></table></div>`}
    ${already ? `<p class="note-warn">Du hast schon ${already} importierte Einheiten. Sie werden durch diesen Import ersetzt, selbst eingetragene bleiben.</p>` : ""}
    <div class="row"><button class="btn primary" data-trimp="go">Training importieren</button></div>
  </div>`;
}

export function trImportRun(){
  const old = S.train.sess.filter(x => String(x.id).startsWith("imp-"));
  old.forEach(x => P.dirty.add("t-" + x.k.slice(0, 7)));
  const starts = Object.fromEntries(ui.trImp.blocks.map(b => [b.id, b.start]));
  const rest = ui.trImp.fixed ? [] : ui.trImp.sessions.filter(x => x.b !== ui.trImp.keep), span = ui.trImp.fixed ? 0 : Math.round((fromKey(ui.trImp.to) - fromKey(ui.trImp.from)) / 864e5);
  const spreadK = new Map(rest.map((x, i) => [x.id, addDays(ui.trImp.from, rest.length > 1 ? Math.round(i * span / (rest.length - 1)) : 0)]));
  const fresh = ui.trImp.fixed ? ui.trImp.sessions.map((x, i) => ({ ...x, focus: x.focus || "", ex: x.ex || [], dur: x.dur || 0, ts: i })) : ui.trImp.sessions.map((x, i) => ({ id: x.id, k: ui.trImp.mode === "spread" && spreadK.has(x.id) ? spreadK.get(x.id) : addDays(starts[x.b], x.off), type: x.type || "gym", title: x.title || "", notes: x.notes || "", ex: x.ex || [], dur: 0, ts: i }));
  S.train.sess = S.train.sess.filter(x => !String(x.id).startsWith("imp-")).concat(fresh);
  fresh.forEach(x => P.dirty.add("t-" + x.k.slice(0, 7)));
  markDirty("tcfg");
  const n = fresh.length; ui.trImp = null; ui.trEx = null;
  toast(`${n} Einheiten importiert.`);
  location.hash = "training";
}

export function vImport(){
  if (ui.trImp) return `<h2>Import &amp; Backup</h2>${trImportView()}`;
  let body = "";
  if (!ui.imp){
    body = `${ui.impErr ? `<div class="banner warn" role="alert" style="margin:0">${esc(ui.impErr)}</div>` : ""}<div class="drop" id="drop">
      <h3>Notion-Export hier ablegen</h3>
      <p class="muted" style="margin:0;font-size:13.5px">.zip, .csv oder ein Trackify-Backup (.json)</p>
      <label class="btn primary" for="file">Datei auswählen</label>
      <input type="file" id="file" accept=".csv,.zip,.json,text/csv,application/zip,application/json" multiple hidden>
    </div>
    <div class="card" style="display:flex;flex-direction:column;gap:8px">
      <h3>So exportierst du aus Notion</h3>
      <ol class="steps">
        <li>Öffne die Habit-Tracker-Datenbank als ganze Seite.</li>
        <li>Oben rechts auf <b>···</b> → <b>Exportieren</b>.</li>
        <li>Format <b>Markdown &amp; CSV</b>, Unterseiten einbeziehen ist nicht nötig.</li>
        <li>Die heruntergeladene .zip hier ablegen. Entpacken musst du sie nicht.</li>
      </ol>
      <p class="muted" style="margin:0;font-size:13px">Im nächsten Schritt siehst du alle Spalten und legst fest, welche als Gewohnheit übernommen werden. Checkbox-Spalten (Yes/No) werden automatisch erkannt.</p>
    </div>`;
  } else body = importMapping();
  return `<h2>Import &amp; Backup</h2>${body}
  <div class="card row" style="justify-content:space-between">
    <div style="min-width:0;flex:1"><h3>Backup</h3><p class="muted" style="margin:0;font-size:13px">Alle Gewohnheiten und Tage als JSON. Kann hier wieder importiert werden.</p></div>
    <div class="row"><button class="btn" data-export>Backup speichern</button><button class="btn ghost" data-copy>Kopieren</button></div>
  </div>`;
}

export function importMapping(){
  const f = ui.imp.files[ui.imp.fi];
  const fileSel = ui.imp.files.length > 1 ? `<div class="field"><label class="label" for="imp-file">Tabelle</label><select id="imp-file">${ui.imp.files.map((x,i)=>`<option value="${i}" ${i===ui.imp.fi?"selected":""}>${esc(x.name)} (${x.data.length} Zeilen)</option>`).join("")}</select></div>` : `<p class="muted" style="margin:0">${esc(f.name)} · ${f.data.length} Zeilen</p>`;
  const pv = previewImport();
  const opts = (c) => {
    const o = [["skip","Ignorieren"],["check","Gewohnheit (abhaken)"],["number","Gewohnheit (Zahl)"],["multi","Mehrfachauswahl → je Option eine Gewohnheit"],["note","Als Tagesnotiz"]];
    return o.map(([v,l]) => `<option value="${v}" ${c.action===v?"selected":""}>${l}</option>`).join("");
  };
  const rows = f.cols.map((c,i) => i === ui.imp.dateCol ? "" : `<tr>
    <td><b>${esc(c.name)}</b><span class="s">${esc(c.sample)}</span></td>
    <td><span class="tag">${c.kindLabel}</span></td>
    <td><select id="imp-act-${i}" data-act="${i}" aria-label="Aktion für ${esc(c.name)}">${opts(c)}</select></td>
    <td>${c.action==="check"||c.action==="number"?`<input id="imp-name-${i}" data-hname="${i}" value="${esc(c.habitName)}" aria-label="Name der Gewohnheit">`:""}${c.action==="number"?` <input id="imp-tgt-${i}" data-htgt="${i}" value="${c.target}" style="width:60px" aria-label="Ziel">`:""}${c.action==="multi"?`<span class="s">${c.options.length} Optionen: ${esc(c.options.slice(0,4).join(", "))}${c.options.length>4?"…":""}</span>`:""}</td>
  </tr>`).join("");
  return `<div class="card" style="display:flex;flex-direction:column;gap:14px">
    <div class="row" style="justify-content:space-between"><h3>Spalten zuordnen</h3><button class="btn ghost" data-impcancel>Andere Datei</button></div>
    ${fileSel}
    <div class="grid2">
      <div class="field"><label class="label" for="imp-date">Datumsspalte</label><select id="imp-date">${f.cols.map((c,i)=>`<option value="${i}" ${i===ui.imp.dateCol?"selected":""}>${esc(c.name)}${c.dateScore>0?` (${Math.round(c.dateScore*100)} % lesbar)`:""}</option>`).join("")}</select></div>
      ${ui.imp.slash ? `<div class="field"><label class="label" for="imp-order">Bei 03/04/2025 ist…</label><select id="imp-order"><option value="mdy" ${ui.imp.order==="mdy"?"selected":""}>Monat/Tag (US, Notion-Standard)</option><option value="dmy" ${ui.imp.order==="dmy"?"selected":""}>Tag/Monat</option></select></div>` : ""}
      <div class="field"><label class="label" for="imp-sick">Krankheitstage aus Spalte</label><select id="imp-sick"><option value="-1">Nicht erkennen</option>${f.cols.map((c,i)=>i===ui.imp.dateCol||c.kind==="check"||c.kind==="number"?"":`<option value="${i}" ${i===ui.imp.sickCol?"selected":""}>${esc(c.name)}${c.sickHits?` (${c.sickHits} Treffer)`:""}</option>`).join("")}</select></div>
      ${ui.imp.sickCol>=0?`<div class="field"><label class="label" for="imp-follow">Folgetage ohne „Ende“-Eintrag</label><select id="imp-follow">${[0,1,2,3,4,5].map(n=>`<option value="${n}" ${n===ui.imp.follow?"selected":""}>${n===0?"Nur der Tag selbst":"+ "+n+(n===1?" Tag":" Tage")}</option>`).join("")}</select></div>`:""}
      <div class="field"><label class="label" for="imp-mode">Vorhandene Daten</label><select id="imp-mode"><option value="merge" ${ui.imp.mode==="merge"?"selected":""}>Zusammenführen</option><option value="replace" ${ui.imp.mode==="replace"?"selected":""}>Alles ersetzen</option></select></div>
    </div>
    <div class="tablewrap"><table><thead><tr><th>Spalte</th><th>Erkannt</th><th>Übernehmen als</th><th>Name / Ziel</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="banner ${pv.bad>pv.ok*0.05?"warn":""}" style="margin:0">
      ${pv.ok ? `<b class="num">${pv.ok}</b> Tage von <b>${pv.from}</b> bis <b>${pv.to}</b> · <b class="num">${pv.habits}</b> Gewohnheiten · <b class="num">${pv.marks}</b> Häkchen/Werte` : "Mit dieser Datumsspalte konnte kein Datum gelesen werden. Wähle eine andere Spalte."}
      ${ui.imp.sickCol>=0 ? `<br><b class="num">${pv.sickDays}</b> Krankheitstage erkannt · <b class="num">${pv.sickApplied}</b> offene Einträge werden ausgesetzt (Erledigtes bleibt erledigt).` : ""}
      ${pv.bad ? `<br><span>${pv.bad} Zeilen ohne lesbares Datum werden übersprungen${pv.badEx?` (z. B. „${esc(pv.badEx)}“)`:""}.</span>` : ""}
    </div>
    <div class="row"><button class="btn primary" data-impgo ${pv.ok&&pv.habits?"":"disabled"}>Importieren</button>${ui.imp.mode==="replace"&&S.habits.length?'<span class="muted" style="font-size:13px">Ersetzt alle aktuellen Gewohnheiten und Einträge.</span>':""}</div>
  </div>`;
}

// CSV parser (RFC 4180, BOM, CRLF)
export function parseCSV(text){
  text = text.replace(/^﻿/, "");
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++){
    const c = text[i];
    if (q){ if (c === '"'){ if (text[i+1] === '"'){ f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ","){ row.push(f); f = ""; }
    else if (c === "\n" || c === "\r"){ if (c === "\r" && text[i+1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f !== "" || row.length){ row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ""));
}

export const MONTHS = {jan:0,january:0,januar:0,"jän":0,feb:1,february:1,februar:1,mar:2,march:2,"mär":2,"märz":2,maerz:2,apr:3,april:3,may:4,mai:4,jun:5,june:5,juni:5,jul:6,july:6,juli:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,okt:9,oktober:9,nov:10,november:10,dec:11,december:11,dez:11,dezember:11};

export function parseDate(raw, order){
  if (!raw) return null;
  let s = String(raw).trim().replace(/^@/, "");
  s = s.split("→")[0].trim();
  let m;
  const mk = (y,mo,d) => { if (y < 100) y += 2000; if (mo<0||mo>11||d<1||d>31||y<1990||y>2100) return null; const dt = new Date(y,mo,d,12); return dt.getMonth()===mo ? keyOf(dt) : null; };
  if ((m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return mk(+m[1], +m[2]-1, +m[3]);
  if ((m = s.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2,4})/))) return mk(+m[3], +m[2]-1, +m[1]);
  if ((m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))){
    let a = +m[1], b = +m[2];
    if (order === "dmy" || a > 12) return mk(+m[3], b-1, a);
    return mk(+m[3], a-1, b);
  }
  if ((m = s.match(/([A-Za-zÄÖÜäöü]+)\.?\s+(\d{1,2}),?\s+(\d{4})/))){ const mo = MONTHS[m[1].toLowerCase()]; if (mo !== undefined) return mk(+m[3], mo, +m[2]); }
  if ((m = s.match(/(\d{1,2})\.?\s+([A-Za-zÄÖÜäöü]+)\.?,?\s+(\d{4})/))){ const mo = MONTHS[m[2].toLowerCase()]; if (mo !== undefined) return mk(+m[3], mo, +m[1]); }
  return null;
}

export const YES = new Set(["yes","true","__yes__","checked","ja","✓","✅","x","wahr"]);

export const NO = new Set(["no","false","__no__","unchecked","nein","","falsch"]);

export const SICK_RE = /krank|magen|erk[aä]lt|corona|covid|grippe|fieber|[uü]bergeb|kotz|migr[aä]ne|sick|\bill\b|flu\b/i;

export const SICK_END_RE = /wieder gesund|gesund|\bende\b|\bend\b|vorbei|over/i;

export const toNum = s => { const v = parseFloat(String(s).replace(",", ".").replace(/[^\d.\-]/g, "")); return isFinite(v) ? v : null; };

export function analyzeTable(name, rows){
  const header = rows[0].map(h => h.trim()), data = rows.slice(1);
  const cols = header.map((h, i) => {
    const vals = data.map(r => (r[i] ?? "").trim());
    const ne = vals.filter(v => v !== "");
    const dateScore = ne.length ? ne.filter(v => parseDate(v, "mdy")).length / ne.length : 0;
    const allBool = ne.length > 0 && ne.every(v => YES.has(v.toLowerCase()) || NO.has(v.toLowerCase()));
    const allNum = ne.length > 0 && ne.every(v => /^-?[\d.,]+\s*%?$/.test(v));
    const hasComma = ne.filter(v => v.includes(",")).length > ne.length * 0.2;
    let kind = "text";
    if (dateScore > 0.8) kind = "date"; else if (allBool) kind = "check"; else if (allNum) kind = "number"; else if (hasComma || (new Set(ne).size < Math.max(12, ne.length*0.3) && ne.length > 3)) kind = "multi";
    const lname = h.toLowerCase();
    let action = "skip";
    if (kind === "check") action = /^(fertig|done|alles|complete|perfekt)/.test(lname) ? "skip" : "check";
    else if (kind === "number") action = (/progress|fortschritt|%|prozent|score|quote|rate|anzahl|count|sum/.test(lname) || ne.some(v=>v.includes("%"))) ? "skip" : "number";
    else if (kind === "multi" && /habit|gewohn|erledigt|done|tags/.test(lname)) action = "multi";
    else if (kind === "text" && /notiz|note|journal|comment|kommentar|tagebuch|reflexion|sonderfall|besonder|ereignis|event/.test(lname)) action = "note";
    const options = kind === "multi" ? [...new Set(ne.flatMap(v => v.split(",").map(x => x.trim()).filter(Boolean)))] : [];
    const nums = kind === "number" ? ne.map(toNum).filter(v => v > 0).sort((a,b)=>a-b) : [];
    const target = nums.length ? nums[Math.floor(nums.length/2)] : 1;
    const kindLabel = {check:"Checkbox", number:"Zahl", date:"Datum", multi:"Auswahl", text:"Text"}[kind];
    const sickHits = ne.filter(v => SICK_RE.test(v)).length;
    return { name: h || `Spalte ${i+1}`, sickHits, kind, kindLabel, action, habitName: h, target, options, dateScore, sample: ne.slice(0,3).join(" · ") };
  });
  let dateCol = 0, best = -1;
  cols.forEach((c, i) => { const bonus = /date|datum|tag|day|created|erstellt/i.test(c.name) ? 0.05 : 0; const sc = c.dateScore + bonus; if (sc > best){ best = sc; dateCol = i; } });
  return { name, header, data, cols, dateCol };
}

// Minimaler ZIP-Leser (ohne externe Bibliothek)
export async function unzip(buf){
  const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
  if (eocd < 0) throw new Error("Die ZIP-Datei ist beschädigt oder unvollständig.");
  const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder("utf-8"), out = [];
  for (let n = 0; n < count; n++){
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + el + cl;
    if (name.endsWith("/")) continue;
    const start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
    const data = u8.subarray(start, start + csize);
    out.push({ name, read: async () => {
      if (method === 0) return data.slice();
      if (method !== 8) throw new Error("Nicht unterstütztes ZIP-Format. Entpacke die Datei und lade die .csv hoch.");
      if (typeof DecompressionStream === "undefined") throw new Error("Dein Browser kann ZIP-Dateien nicht entpacken. Entpacke sie selbst und lade die .csv hoch.");
      const ab = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer();
      return new Uint8Array(ab);
    }});
  }
  return out;
}

export function impError(msg){ ui.impErr = msg; render(); }

export async function handleFiles(fileList){
  ui.impErr = "";
  const tables = [];
  async function fromZip(buf, depth){
    const entries = await unzip(buf);
    const csvs = entries.filter(e => /\.csv$/i.test(e.name));
    const alls = new Set(csvs.filter(e => /_all\.csv$/i.test(e.name)).map(e => e.name.replace(/_all\.csv$/i, ".csv")));
    for (const e of csvs){ if (alls.has(e.name)) continue; tables.push({ name: e.name.split("/").pop(), text: new TextDecoder("utf-8").decode(await e.read()) }); }
    if (depth < 2) for (const e of entries.filter(e => /\.zip$/i.test(e.name))) await fromZip((await e.read()).buffer, depth+1);
  }
  try {
    for (const file of fileList){
      if (/\.json$/i.test(file.name)){
        const txt = await file.text(); let o = null; try { o = JSON.parse(txt); } catch(e){}
        if (o && (o.app === "trackify-training" || o.app === "trackify-training") && o.fixed && Array.isArray(o.sessions)){ ui.trImp = { fixed: true, sessions: o.sessions, blocks: [] }; ui.impErr = ""; render(); return; }
        if (o && (o.app === "trackify-training" || o.app === "trackify-training") && Array.isArray(o.sessions) && Array.isArray(o.blocks)){ ui.trImp = { blocks: o.blocks.map(b => ({ ...b })), sessions: o.sessions, mode: "spread", from: o.blocks[0].start, to: "2026-08-31", keep: o.blocks[o.blocks.length - 1].id }; ui.impErr = ""; render(); return; }
        await importBackup(txt); return;
      }
      if (/\.zip$/i.test(file.name)) await fromZip(await file.arrayBuffer(), 0);
      else tables.push({ name: file.name, text: await file.text() });
    }
  } catch(e){ impError(e.message || "Die Datei konnte nicht gelesen werden."); return; }
  const files = tables.map(t => { const rows = parseCSV(t.text); return rows.length > 1 ? analyzeTable(t.name.replace(/\s[0-9a-f]{32}/i, ""), rows) : null; }).filter(Boolean);
  if (!files.length){ impError("In der Datei wurde keine Tabelle mit Daten gefunden. Exportiere die Datenbank als „Markdown & CSV“."); return; }
  files.sort((a,b) => b.data.length - a.data.length);
  ui.imp = { files, fi: 0, mode: S.habits.length ? "merge" : "replace", order: "mdy" };
  setFile(0); render();
}

export function setFile(i){
  ui.imp.fi = i; const f = ui.imp.files[i]; ui.imp.dateCol = f.dateCol;
  f.cols.forEach((c, j) => { if (j === f.dateCol) c.action = "skip"; });
  ui.imp.slash = f.data.some(r => /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(r[f.dateCol] || ""));
  let sc = -1, bestHits = 0; f.cols.forEach((c, j) => { if (j !== f.dateCol && c.kind !== "check" && c.kind !== "number" && c.sickHits > bestHits){ bestHits = c.sickHits; sc = j; } });
  ui.imp.sickCol = sc; if (ui.imp.follow === undefined) ui.imp.follow = 2;
}

export function buildImport(){
  const f = ui.imp.files[ui.imp.fi], days = {}, habitFirst = {}, habitDefs = [];
  const defs = [];
  f.cols.forEach((c, i) => {
    if (i === ui.imp.dateCol) return;
    if (c.action === "check" || c.action === "number") defs.push({ i, kind: c.action, name: (c.habitName || c.name).trim(), target: toNum(c.target) || 1 });
    if (c.action === "multi") c.options.forEach(o => defs.push({ i, kind: "opt", opt: o, name: o }));
    if (c.action === "note") defs.push({ i, kind: "note", name: c.name });
  });
  let ok = 0, bad = 0, badEx = "", marks = 0, from = null, to = null;
  for (const r of f.data){
    const k = parseDate(r[ui.imp.dateCol], ui.imp.order);
    if (!k){ bad++; if (!badEx) badEx = (r[ui.imp.dateCol]||"").slice(0,30); continue; }
    ok++; if (!from || k < from) from = k; if (!to || k > to) to = k;
    const e = days[k] || (days[k] = {});
    defs.forEach((d, di) => {
      const raw = (r[d.i] ?? "").trim();
      if (d.kind === "note"){ if (raw) e._note = e._note ? e._note + "\n" + raw : raw; return; }
      let v = null;
      if (d.kind === "check") v = YES.has(raw.toLowerCase()) ? 1 : null;
      else if (d.kind === "number"){ const n = toNum(raw); v = n && n > 0 ? n : null; }
      else if (d.kind === "opt") v = raw.split(",").map(x=>x.trim()).includes(d.opt) ? 1 : null;
      if (v !== null){
        const key = "d" + di;
        if (d.kind === "number") e[key] = Math.max(e[key]||0, v); else e[key] = 1;
        marks++; if (!habitFirst[key] || k < habitFirst[key]) habitFirst[key] = k;
      }
    });
  }
  // Krankheitstage: Start-Eintrag öffnet einen Zeitraum bis zum nächsten Ende-Eintrag (max. 14 Tage),
  // sonst zählt der Tag selbst plus imp.follow Folgetage.
  const sick = new Set();
  if (ui.imp.sickCol >= 0){
    const txt = {};
    for (const r of f.data){ const k = parseDate(r[ui.imp.dateCol], ui.imp.order); if (k){ const v = (r[ui.imp.sickCol] ?? "").trim(); if (v) txt[k] = txt[k] ? txt[k] + " " + v : v; } }
    const isEnd = v => SICK_END_RE.test(v) && (SICK_RE.test(v) || /gesund/i.test(v));
    for (const k of Object.keys(txt).sort()){
      const v = txt[k];
      if (!SICK_RE.test(v) && !/gesund/i.test(v)) continue;
      sick.add(k);
      if (isEnd(v)) continue;
      let end = null;
      for (let j = 1; j <= 14; j++){ const kk = addDays(k, j); if (txt[kk] && isEnd(txt[kk])){ end = kk; break; } }
      const last = end || addDays(k, ui.imp.follow || 0);
      for (let kk = addDays(k, 1); kk <= last; kk = addDays(kk, 1)) sick.add(kk);
    }
  }
  let sickApplied = 0;
  for (const k of sick){
    const e = days[k]; if (!e) continue;
    defs.forEach((d, di) => { if (d.kind === "note") return; const key = "d" + di; if (e[key] === undefined){ e[key] = "s"; sickApplied++; } });
  }
  return { defs, days, habitFirst, ok, bad, badEx, marks, from, to, sickDays: [...sick].filter(k => days[k]).length, sickApplied };
}

export function previewImport(){
  const b = buildImport(); const fmt = k => k ? fromKey(k).toLocaleDateString("de-DE") : "";
  return { sickDays: b.sickDays, sickApplied: b.sickApplied, ok: b.ok, bad: b.bad, badEx: b.badEx, marks: b.marks, habits: b.defs.filter(d => d.kind !== "note").length, from: fmt(b.from), to: fmt(b.to) };
}

export function runImport(){
  const b = buildImport();
  if (ui.imp.mode === "replace"){
    const oldMonths = new Set(Object.keys(S.days).map(monthDocId));
    S.habits = []; S.days = {};
    oldMonths.forEach(id => P.dirty.add(id));
  }
  const map = {};
  b.defs.forEach((d, di) => {
    if (d.kind === "note") return;
    const key = "d" + di;
    let h = S.habits.find(x => x.name.trim().toLowerCase() === d.name.toLowerCase());
    const first = b.habitFirst[key] || b.from;
    if (!h){
      h = { id: uid(), name: d.name, type: d.kind === "number" ? "number" : "check", target: d.kind === "number" ? d.target : 1, unit: "", days: [0,1,2,3,4,5,6], color: S.habits.length % NCOL, created: first, archived: false };
      S.habits.push(h);
    } else if (first && first < startOf(h)) h.created = first;
    map[key] = h.id;
  });
  let n = 0;
  for (const k in b.days){
    const src = b.days[k], e = S.days[k] || (S.days[k] = {});
    for (const key in src){
      if (key === "_note"){ e._note = e._note && e._note !== src._note ? e._note + "\n" + src._note : src._note; continue; }
      const hid = map[key]; if (!hid) continue;
      if (src[key] === "s"){ if (e[hid] === undefined) e[hid] = "s"; continue; }
      e[hid] = typeof src[key] === "number" && typeof e[hid] === "number" ? Math.max(e[hid], src[key]) : src[key];
    }
    if (!Object.keys(e).length) delete S.days[k]; else n++;
  }
  P.dirty.add("config");
  new Set(Object.keys(S.days).map(monthDocId)).forEach(id => P.dirty.add(id));
  markDirty("config");
  ui.imp = null; ui.cur = todayKey(); ui.view = "statistik"; ui.statSel = "all";
  location.hash = "statistik";
  toast(`${n} Tage importiert. Wird gespeichert…`);
  render();
}

export async function importBackup(text){
  try {
    const o = JSON.parse(text);
    if (!Array.isArray(o.habits) || typeof o.days !== "object") throw 0;
    const oldMonths = new Set(Object.keys(S.days).map(monthDocId));
    S.habits = o.habits; S.days = o.days;
    if (o.monk && typeof o.monk === "object"){ S.monk = { run: o.monk.run || null, history: o.monk.history || [], alts: o.monk.alts || null, log: o.monk.log || [] }; P.dirty.add("monk"); }
    if (o.train && typeof o.train === "object"){ S.train = { sess: o.train.sess || [], cfg: o.train.cfg || {} }; new Set(S.train.sess.map(x => "t-" + x.k.slice(0,7))).forEach(id => P.dirty.add(id)); P.dirty.add("tcfg"); }
    if (o.calm && typeof o.calm === "object"){ S.calm = { sessions: o.calm.sessions || [], settings: o.calm.settings || {} }; P.dirty.add("calm"); }
    oldMonths.forEach(id => P.dirty.add(id));
    new Set(Object.keys(S.days).map(monthDocId)).forEach(id => P.dirty.add(id));
    markDirty("config"); toast(`Backup geladen: ${S.habits.length} Gewohnheiten, ${Object.keys(S.days).length} Tage.`); ui.view = "heute"; location.hash = "heute"; render();
  } catch(e){ toast("Das ist kein gültiges Trackify-Backup."); }
}

export function backupJSON(){ return JSON.stringify({ app: "trackify", version: 1, exported: new Date().toISOString(), habits: S.habits, days: S.days, monk: S.monk, calm: S.calm, train: S.train }); }
