// @ts-nocheck
import "./styles.css";
import { boot, accAction, sendLink } from "./features/account";
import { TT, chartData, trAction } from "./features/training";
import { fmtNum } from "./views/stats";
import { $, WD, addDays, toast, todayKey, uid, wdOf } from "./lib/util";
import { fmtDate, monkAction } from "./features/monk";
import { render } from "./views/render";
import { S, ui } from "./state";
import { active, saveHabits, scheduled, setNote, setVal, stateOf, valOf } from "./domain/habits";
import { migrateChecks } from "./views/habits";
import { backupJSON, handleFiles, runImport, setFile, toNum, trImportRun } from "./features/import";
import { AU, calmAction, lockScreen, renderSession, setCs } from "./features/calm";
import { sosAction, sosReset, sosStop } from "./features/sos";
import { P, markDirty, monthDocId } from "./storage/persist";
import { trDraftLoad, trDraftSave } from "./features/training-editor";
import { shotRun } from "./features/screenshot";

// Tooltips für Diagramme
document.addEventListener("pointermove", e => {
  const box = e.target.closest && e.target.closest(".chart-box"); if (!box) return;
  const cd = chartData[box.dataset.chart]; if (!cd) return;
  const svg = box.querySelector("svg"), r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * svg.viewBox.baseVal.width, tip = box.querySelector(".tip");
  const scale = r.width / svg.viewBox.baseVal.width;
  if (cd.pts){
    if (!e.target.classList.contains("hit")){ tip.hidden = true; svg.querySelector(".xh").setAttribute("visibility", "hidden"); svg.querySelector(".xd").setAttribute("visibility", "hidden"); return; }
    let best = cd.pts[0]; for (const p of cd.pts) if (Math.abs(p.x - sx) < Math.abs(best.x - sx)) best = p;
    const xh = svg.querySelector(".xh"), xd = svg.querySelector(".xd");
    xh.setAttribute("x1", best.x); xh.setAttribute("x2", best.x); xh.setAttribute("visibility", "visible");
    xd.setAttribute("cx", best.x); xd.setAttribute("cy", best.y); xd.setAttribute("visibility", "visible");
    tip.innerHTML = `<b>${fmtNum(best.v)} ${cd.unit}</b><br>${WD[wdOf(best.k)]}, ${fmtDate(best.k)} ${best.k.slice(0, 4)}${best.top && !best.bw ? `<br>${cd.unit === "kg" && best.top[0] !== best.v ? "Bester Satz" : "Satz"} ${fmtNum(+best.top[0])} kg × ${best.top[1]}` : ""}`;
    tip.style.left = best.x * scale + "px"; tip.style.top = best.y * scale + "px"; tip.hidden = false;
  } else if (cd.bars){
    const hb = e.target.closest(".hitb"); if (!hb){ tip.hidden = true; return; }
    const b = cd.bars[+hb.dataset.i];
    tip.innerHTML = `<b>Woche ab ${fmtDate(b.a)}</b><br>${TT.filter(tt => b.by[tt[0]]).map(tt => `${tt[1]}: ${b.by[tt[0]]} Min`).join("<br>") || "Kein Training"}`;
    tip.style.left = b.x * scale + "px"; tip.style.top = b.y * scale + "px"; tip.hidden = false;
  }
});

document.addEventListener("pointerleave", e => { if (e.target.classList && e.target.classList.contains("chart-box")){ const tip = e.target.querySelector(".tip"); if (tip) tip.hidden = true; } }, true);

// ---------- events ----------
export function go(k){ ui.cur = k; render(); }

export function toggle(hid){
  const h = S.habits.find(x => x.id === hid); if (!h) return;
  const st = stateOf(h, ui.cur);
  if (h.type === "number") setVal(ui.cur, hid, st === "done" ? undefined : (h.target||1));
  else setVal(ui.cur, hid, st === "done" ? undefined : 1);
  render();
}

document.addEventListener("click", e => {
  const t = e.target.closest("[data-acc],[data-trimp],[data-tr],[data-migrate],[data-calm],[data-sos],[data-mk],[data-hk],[data-open],[data-tog],[data-step],[data-go],[data-skip],[data-inc],[data-sel],[data-year],[data-edit],[data-mv],[data-arch],[data-del],[data-delok],[data-delno],[data-impcancel],[data-impgo],[data-export],[data-copy]");
  if (!t) return;
  const d = t.dataset;
  if (d.migrate){ const h = S.habits.find(x => x.id === d.migrate); const n = h ? migrateChecks(h) : 0; toast(`${n} Tage übernommen.`); return render(); }
  if (d.acc) return accAction(d.acc);
  if (d.trimp){
    if (d.trimp === "cancel"){ ui.trImp = null; return render(); }
    if (d.trimp === "mode"){ ui.trImp.mode = d.a; return render(); }
    if (!ui.trImp.fixed && ui.trImp.mode === "spread" && ui.trImp.to <= ui.trImp.from){ toast("Die letzte Einheit muss nach der ersten liegen."); return; }
    return trImportRun();
  }
  if (d.tr) return trAction(d.tr, d.a);
  if (d.calm) return calmAction(d.calm, d.a);
  if (d.sos) return sosAction(d.sos, d.a);
  if (d.mk) return monkAction(d.mk, d.a);
  if (d.hk){ ui.heatInfo = ui.heatInfo === d.hk ? null : d.hk; return render(); }
  if (d.open){ ui.cur = d.open; ui.heatInfo = null; location.hash = "heute"; return; }
  if (d.tog) return toggle(d.tog);
  if (d.step) return go(addDays(ui.cur, +d.step));
  if (d.go) return go(d.go);
  if (d.skip){ const h = S.habits.find(x=>x.id===d.skip); setVal(ui.cur, d.skip, stateOf(h,ui.cur)==="skip" ? undefined : "s"); return render(); }
  if (d.inc){ const h = S.habits.find(x=>x.id===d.inc); const v = valOf(h,ui.cur); const n = Math.max(0, (typeof v==="number"?v:0) + (+d.d)); setVal(ui.cur, d.inc, n || undefined); return render(); }
  if (d.sel){ ui.statSel = d.sel; ui.heatInfo = null; return render(); }
  if (d.year){ ui.statYear = +d.year; return render(); }
  if (d.edit){ ui.editing = ui.editing === d.edit ? null : d.edit; ui.confirmDel = null; return render(); }
  if (d.mv){ const i = S.habits.findIndex(x=>x.id===d.mv), j = i + (+d.d); if (j<0||j>=S.habits.length) return; [S.habits[i], S.habits[j]] = [S.habits[j], S.habits[i]]; saveHabits(); return render(); }
  if (d.arch){ const h = S.habits.find(x=>x.id===d.arch); h.archived = !h.archived; saveHabits(); return render(); }
  if (d.del){ ui.confirmDel = d.del; return render(); }
  if (d.delno !== undefined){ ui.confirmDel = null; return render(); }
  if (d.delok){
    const id = d.delok; S.habits = S.habits.filter(x=>x.id!==id);
    for (const k in S.days){ if (id in S.days[k]){ delete S.days[k][id]; if (!Object.keys(S.days[k]).length) delete S.days[k]; P.dirty.add(monthDocId(k)); } }
    ui.confirmDel = null; ui.editing = null; saveHabits(); toast("Gewohnheit gelöscht."); return render();
  }
  if (d.impcancel !== undefined){ ui.imp = null; return render(); }
  if (d.impgo !== undefined) return runImport();
  if (d.export !== undefined) return doExport();
  if (d.copy !== undefined){
    const txt = backupJSON();
    try { navigator.clipboard.writeText(txt).then(()=>toast("Backup in die Zwischenablage kopiert."), ()=>toast("Kopieren nicht erlaubt. Nutze „Backup speichern“.")); }
    catch(err){ toast("Kopieren nicht erlaubt. Nutze „Backup speichern“."); }
  }
});

export function doExport(){
  const blob = new Blob([backupJSON()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `trackify-backup-${todayKey()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("Backup gespeichert.");
}

document.addEventListener("input", e => {
  const t = e.target;
  if (ui.monkSetup){
    const own = t.id.match(/^mk-own-(\d)$/); if (own){ ui.monkSetup.own[+own[1]] = t.value; return; }
    if (t.id === "mk-why"){ ui.monkSetup.why = t.value; return; }
    if (t.id === "mk-reward"){ ui.monkSetup.reward = t.value; return; }
    if (t.id === "mk-cost"){ ui.monkSetup.cost = t.value; return; }
  }
  if (ui.trEdit && t.id && t.id.startsWith("tr-")){
    clearTimeout(window.__trds); window.__trds = setTimeout(trDraftSave, 400);
    const d = ui.trEdit, m = t.id.match(/^tr-(ex|w|r)-(\d+)(?:-(\d+))?$/);
    if (m){ const i = +m[2]; if (m[1] === "ex") d.ex[i].n = t.value; else d.ex[i].sets[+m[3]][m[1] === "w" ? 0 : 1] = t.value; return; }
    const f = { "tr-title": "title", "tr-dur": "dur", "tr-rounds": "rounds", "tr-dist": "dist", "tr-focus": "focus", "tr-notes": "notes" }[t.id];
    if (f){ d[f] = t.value; return; }
  }
  if (t.id === "calm-vol" || t.id === "calm-cvol"){
    const v = +t.value; setCs(t.id === "calm-vol" ? { vol: v } : { cueVol: v });
    if (AU.ctx){ if (t.id === "calm-vol") AU.amb.gain.value = v * 0.9; else AU.cue.gain.value = v; }
    const lab = t.parentElement.querySelector(".num"); if (lab) lab.textContent = Math.round(v * 100); return;
  }
  if (t.id === "sos-add" && ui.sos){ ui.sos.adding = t.value; return; }
  if (t.id === "mk-note"){ ui.monkNote = t.value; const b = document.getElementById("mk-relapse-go"); if (b) b.disabled = ui.monkNote.trim().length < 3; return; }
  if (t.id === "note"){ const k = ui.cur, v = t.value; clearTimeout(ui.noteT); ui.noteT = setTimeout(() => setNote(k, v), 500); return; }
  if (t.dataset.num){ const n = toNum(t.value); setVal(ui.cur, t.dataset.num, n && n > 0 ? n : undefined); clearTimeout(ui.noteT); ui.noteT = setTimeout(render, 700); return; }
  if (t.dataset.hname !== undefined && ui.imp){ ui.imp.files[ui.imp.fi].cols[+t.dataset.hname].habitName = t.value; return; }
  if (t.dataset.htgt !== undefined && ui.imp){ ui.imp.files[ui.imp.fi].cols[+t.dataset.htgt].target = t.value; return; }
});

document.addEventListener("change", e => {
  const t = e.target;
  if ((t.id === "tr-shot" || t.id === "tr-shot2") && t.files && t.files[0]){ const f = t.files[0]; t.value = ""; return shotRun(f); }
  if (t.id === "tr-date" && ui.trEdit && t.value){ ui.trEdit.k = t.value; return; }
  if (ui.trImp && (t.id === "trimp-from" || t.id === "trimp-to") && t.value){ ui.trImp[t.id === "trimp-from" ? "from" : "to"] = t.value; return render(); }
  if (ui.trImp && t.id.startsWith("trimp-") && t.value){ const b = ui.trImp.blocks.find(x => "trimp-" + x.id === t.id); if (b){ b.start = t.value; return render(); } }
  if (t.id === "tr-exsel"){ ui.trEx = t.value; ui.trMetric = "auto"; return render(); }
  if (t.id === "tr-hid"){ S.train.cfg = { ...S.train.cfg, hid: t.value }; markDirty("tcfg"); return; }
  if (t.id === "calm-hid"){ setCs({ hid: t.value }); return render(); }
  if (t.id === "calm-cb"){ setCs({ countBreath: t.checked }); return; }
  if (t.id === "calm-voice"){ setCs({ voice: t.checked }); return; }
  if (t.id === "mk-pact" && ui.monkSetup){ ui.monkSetup.pact = t.checked; return render(); }
  if (t.id === "datepick" && t.value) return go(t.value);
  if (t.id === "file"){ const fl = [...t.files]; t.value = ""; return handleFiles(fl); }
  if (!ui.imp) return;
  if (t.id === "imp-file"){ setFile(+t.value); return render(); }
  if (t.id === "imp-date"){ ui.imp.dateCol = +t.value; ui.imp.files[ui.imp.fi].cols[ui.imp.dateCol].action = "skip"; const f = ui.imp.files[ui.imp.fi]; ui.imp.slash = f.data.some(r => /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(r[ui.imp.dateCol]||"")); return render(); }
  if (t.id === "imp-order"){ ui.imp.order = t.value; return render(); }
  if (t.id === "imp-mode"){ ui.imp.mode = t.value; return render(); }
  if (t.id === "imp-sick"){ ui.imp.sickCol = +t.value; return render(); }
  if (t.id === "imp-follow"){ ui.imp.follow = +t.value; return render(); }
  if (t.dataset.act !== undefined){ ui.imp.files[ui.imp.fi].cols[+t.dataset.act].action = t.value; return render(); }
});

document.addEventListener("submit", e => {
  if (e.target.id === "login-form"){ e.preventDefault(); return sendLink($("#login-email").value.trim()); }
  const f = e.target.closest("form[data-form]"); if (!f) return; e.preventDefault();
  const fd = new FormData(f), id = f.dataset.form;
  const name = String(fd.get("name")||"").trim(); if (!name){ toast("Gib der Gewohnheit einen Namen."); return; }
  const days = fd.getAll("wd").map(Number);
  const v = { name, type: fd.get("type"), target: toNum(fd.get("target")) || 1, unit: String(fd.get("unit")||"").trim(), cue: String(fd.get("cue")||"").trim(), days: days.length ? days : [0,1,2,3,4,5,6], color: +fd.get("color") || 0 };
  if (id === "new"){ S.habits.push({ id: uid(), ...v, created: todayKey(), archived: false }); toast("Gewohnheit angelegt."); }
  else {
    const h = S.habits.find(x=>x.id===id), was = h.type;
    Object.assign(h, v); const c = fd.get("created"); if (c) h.created = c;
    const n = (was !== "number" && h.type === "number") ? migrateChecks(h) : 0;
    toast(n ? `Gespeichert. ${n} alte Häkchen zählen als Ziel erreicht.` : "Gespeichert.");
  }
  ui.editing = null; saveHabits(); render();
});

$("#session").addEventListener("click", e => { if (ui.sess && ui.sess.dim && !e.target.closest("button")){ ui.sess.dim = false; renderSession(); } });

document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && ui.sess && !ui.sess.done && !ui.wakeLock) lockScreen(); });

document.addEventListener("dragover", e => { if (ui.view==="import" && !ui.imp){ e.preventDefault(); $("#drop")?.classList.add("over"); } });

document.addEventListener("dragleave", e => { if (e.target.id === "drop") $("#drop").classList.remove("over"); });

document.addEventListener("drop", e => { if (ui.view==="import" && !ui.imp){ e.preventDefault(); handleFiles([...e.dataTransfer.files]); } });

document.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.id === "sos-add"){ e.preventDefault(); return sosAction("add"); }
  if (ui.view !== "heute" || e.target.closest("input,textarea,select") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "ArrowLeft") return go(addDays(ui.cur,-1));
  if (e.key === "ArrowRight") return go(addDays(ui.cur,1));
  if (e.key.toLowerCase() === "t") return go(todayKey());
  if (/^[1-9]$/.test(e.key)){ const on = active().filter(h => scheduled(h, ui.cur)); const h = on[+e.key-1]; if (h) toggle(h.id); }
});

export const VIEWS = ["heute","statistik","gewohnheiten","import","sos","ruhe","training","konto"];

export function route(){
  const h = location.hash.slice(1), prev = ui.view;
  ui.view = VIEWS.includes(h) ? h : "heute";
  if (ui.view === "sos" && (prev !== "sos" || !ui.sos || ui.sos.phase === "done")) sosReset();
  if (ui.view !== "sos") sosStop();
  if (ui.view === "training" && trDraftLoad()) setTimeout(() => toast("Dein angefangenes Training wurde wiederhergestellt."), 300);
  render();
  if (ui.view === "sos") window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);

setInterval(() => { const t = todayKey(); if (t !== ui.lastToday){ if (ui.cur === ui.lastToday) ui.cur = t; ui.lastToday = t; render(); } }, 60000);

route();

boot();
