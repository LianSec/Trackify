// @ts-nocheck
import { CHECK_SVG, addDays, esc, fromKey, toast, todayKey, uid } from "../lib/util";
import { S, ui } from "../state";
import { markDirty } from "../storage/persist";
import { trigInsight } from "./sos";
import { fmtNum } from "../views/stats";
import { toNum } from "./import";
import { render } from "../views/render";

// ---------- Monk Mode ----------
export const MONK_FIXED = [
  { id: "pmo", name: "Kein PMO" },
  { id: "vape", name: "Kein Vapen" },
  { id: "short", name: "Kein Short-Form-Content", sub: "Reels, TikTok, YouTube Shorts" }
];

export const MONK_DURS = [15, 30, 45, 60, 90];

export const RANKS = [[0,"入門","Novize"],[7,"見習い","Lehrling"],[15,"修行者","Übender"],[30,"僧","Mönch"],[60,"師範","Meister"],[90,"達人","Großmeister"]];

export const MILESTONES = new Set([7,15,30,45,60,90]);

export const rankOf = n => { let r = RANKS[0]; for (const x of RANKS) if (n >= x[0]) r = x; return r; };

export const fmtDate = k => fromKey(k).toLocaleDateString("de-DE", { day: "numeric", month: "short" });

export function mComplete(run, k){ const e = run.days[k]; return !!e && run.rules.every(r => e[r.id] === 1); }

export function monkEvaluate(){
  const run = S.monk.run;
  if (!run) return { count: 0, yPending: false };
  const t = todayKey(), y = addDays(t, -1);
  if (run.status !== "active") return { count: run.goal, yPending: false };
  let changed = false, count = 0, k = run.streakStart, g = 0;
  // Tage vor gestern sind abgeschlossen: unvollständig = Reset
  while (k < y && g++ < 5000){
    if (mComplete(run, k)){ count++; if (count >= run.goal) break; }
    else { run.attempts.push({ from: run.streakStart, to: k, reached: count }); run.streakStart = addDays(k, 1); count = 0; changed = true; }
    k = addDays(k, 1);
  }
  let yPending = false;
  if (count < run.goal){
    for (const kk of [y, t]){
      if (kk < run.streakStart || kk < k) continue;
      if (mComplete(run, kk)) count++;
      else if (kk === y) yPending = true;
    }
  }
  if (count > (run.best || 0)){ run.best = count; changed = true; }
  if (count >= run.goal && run.status === "active"){ run.status = "done"; run.doneAt = t; changed = true; }
  if (changed) markDirty("monk");
  return { count: Math.min(count, run.goal), yPending };
}

export function cleanDays(run){ return Object.keys(run.days).filter(k => mComplete(run, k)).length; }

export function sumUrges(run){ return Object.values(run.urges || {}).reduce((a, b) => a + b, 0); }

export function ruleButtons(run, k, locked){
  const e = run.days[k] || {};
  return `<div class="mk-rules">${run.rules.map(r => {
    const on = e[r.id] === 1, fx = MONK_FIXED.find(f => f.id === r.id);
    return `<button class="mk-rule" data-mk="tog" data-a="${k}|${r.id}" aria-pressed="${on}" ${locked?"disabled":""}><span class="bx">${CHECK_SVG}</span><span class="nm">${esc(r.name)}${fx && fx.sub ? `<span class="sb">${fx.sub}</span>` : ""}</span></button>`;
  }).join("")}</div>`;
}

export function monkPanel(){
  const run = S.monk.run;
  if (!run) return monkIntro();
  if (run.status === "done") return monkDone(run);
  const t = todayKey(), y = addDays(t, -1), c = ui.mState.count, rk = rankOf(c);
  const next = RANKS.find(x => x[0] > c && x[0] <= run.goal);
  const relapsedToday = run.relapseDay === t;
  const todayDone = !relapsedToday && mComplete(run, t);
  const open = run.rules.filter(r => !((run.days[t] || {})[r.id] === 1)).length;
  let seals = "";
  for (let i = 0; i < run.goal; i++){
    const k = addDays(run.streakStart, i);
    let cls = "";
    if (k <= t && mComplete(run, k)) cls = "ok";
    else if (k === t) cls = "today";
    else if (k === y && ui.mState.yPending) cls = "pend";
    if (MILESTONES.has(i + 1)) cls += " ms";
    if (ui.monkFlash === k && cls.includes("ok")) cls += " fresh";
    seals += `<span class="seal ${cls}" title="Tag ${i+1} · ${fmtDate(k)}">${cls.includes("ok") ? "済" : ""}</span>`;
  }
  const clean = cleanDays(run), urgesToday = (run.urges || {})[t] || 0;
  const pend = ui.mState.yPending && !relapsedToday ? `<div class="mk-pend"><span><b>Gestern (${fmtDate(y)}) ist noch offen.</b> Trag es bis Mitternacht nach, sonst fällst du auf Tag 0 zurück.</span>${ruleButtons(run, y, false)}</div>` : "";
  const today = relapsedToday
    ? `<p class="mk-status" style="margin:0">Heute Rückfall eingestanden. Morgen beginnt Tag 1. Dass du ehrlich warst, zählt.</p>`
    : `<div style="display:flex;flex-direction:column;gap:8px"><div class="row" style="justify-content:space-between"><span class="mk-lbl">Heute · ${fmtDate(t)}</span><span class="mk-status ${todayDone?"ok":""}">${todayDone ? "Tag besiegelt 済" : `Noch ${open} von ${run.rules.length} offen`}</span></div>${ruleButtons(run, t, false)}</div>`;
  const att = run.attempts.slice().reverse();
  const confirm = ui.monkConfirm === "relapse"
    ? `<div class="mk-confirm"><b>Du verlierst deinen Lauf von ${c - (todayDone?1:0)} ${c - (todayDone?1:0) === 1 ? "Tag" : "Tagen"}.</b><span class="mk-muted" style="font-size:13.5px">Der Zähler springt auf 0, dein Ziel von ${run.goal} Tagen bleibt. Was war der Auslöser? Ohne Grund kein Reset, denn nur so lernst du daraus.</span><label class="mk-lbl" for="mk-note">Auslöser (Pflicht)</label><input id="mk-note" required maxlength="200" placeholder="z. B. spät abends allein am Handy, gelangweilt" value="${esc(ui.monkNote)}"><div class="row"><button class="mk-btn red" data-mk="do-relapse" id="mk-relapse-go" ${ui.monkNote.trim().length >= 3 ? "" : "disabled"}>Zurücksetzen</button><button class="mk-btn ghost" data-mk="cancel">Abbrechen</button></div></div>`
    : ui.monkConfirm === "abort"
    ? `<div class="mk-confirm"><b>Monk Mode wirklich beenden?</b><span class="mk-muted" style="font-size:13.5px">Dein bester Lauf (${run.best || 0} Tage) wird im Verlauf gespeichert.</span><div class="row"><button class="mk-btn red" data-mk="do-abort">Beenden</button><button class="mk-btn ghost" data-mk="cancel">Weitermachen</button></div></div>`
    : `<div class="row"><button class="mk-btn ghost" data-mk="relapse">Rückfall eingestehen</button><button class="mk-btn ghost" data-mk="abort">Monk Mode beenden</button></div>`;
  return `<section class="monk" id="monk" aria-label="Monk Mode">
    <div class="mk-eye">修行 · Monk Mode · ${run.goal} Tage</div>
    <div class="mk-top">
      <div class="mk-count">${c}<small>/ ${run.goal}</small></div>
      <div class="mk-rank"><span class="kj">${rk[1]}</span><span class="mk-muted" style="font-size:13px">${rk[2]}${next ? ` · noch ${next[0]-c} ${next[0]-c===1?"Tag":"Tage"} bis ${next[1]} ${next[2]}` : ` · noch ${run.goal - c} bis zum Ziel`}</span></div>
    </div>
    <div class="mk-bar"><i style="width:${Math.round(c/run.goal*100)}%"></i></div>
    <div class="seals" aria-label="${c} von ${run.goal} Tagen besiegelt">${seals}</div>
    ${run.why ? `<div style="display:flex;flex-direction:column;gap:4px"><span class="mk-lbl">Dein Warum</span><div class="mk-why">${esc(run.why)}</div></div>` : ""}
    ${pend}
    ${today}
    <div class="mk-urge"><a class="mk-btn red" href="#sos" style="text-decoration:none">Drang gerade aktiv? SOS</a><button class="mk-btn" data-mk="urge">+1 überstanden</button><span style="font-size:13.5px">Heute <b class="num">${urgesToday}</b> · gesamt <b class="num">${sumUrges(run)}</b>. Jeder Drang, dem du nicht nachgibst, macht den nächsten schwächer.</span></div>
    ${trigInsight()}
    <div class="mk-stats">
      <div class="mk-stat"><span class="mk-lbl">Bester Lauf</span><span class="v">${run.best || 0}</span></div>
      <div class="mk-stat"><span class="mk-lbl">Versuch</span><span class="v">${run.attempts.length + 1}</span></div>
      <div class="mk-stat"><span class="mk-lbl">Saubere Tage</span><span class="v">${clean}</span></div>
      ${run.cost ? `<div class="mk-stat"><span class="mk-lbl">Gespart</span><span class="v">${fmtNum(clean * run.cost)} €</span></div>` : ""}
    </div>
    ${run.reward ? `<p style="margin:0;font-size:14px"><span class="mk-lbl">Belohnung bei Tag ${run.goal}</span><br>${esc(run.reward)}</p>` : ""}
    ${att.length ? `<details><summary>Frühere Versuche (${att.length})</summary><div class="mk-list">${att.map(a => `<div><b class="num">${a.reached} ${a.reached===1?"Tag":"Tage"}</b><span class="mk-muted">${fmtDate(a.from)} – ${fmtDate(a.to)}</span>${a.note ? `<span>Auslöser: ${esc(a.note)}</span>` : `<span class="mk-muted">${a.reached || a.to !== a.from ? "Tag nicht abgehakt" : ""}</span>`}</div>`).join("")}</div></details>` : ""}
    ${confirm}
  </section>`;
}

export function monkHistory(){
  const h = S.monk.history; if (!h.length) return "";
  return `<details><summary>Abgeschlossene Monk Modes (${h.length})</summary><div class="mk-list">${h.slice().reverse().map(x => `<div><b>${x.result === "geschafft" ? "済 Geschafft" : "Beendet"}</b><span>${x.goal} Tage · bester Lauf ${x.best}</span><span class="mk-muted">${fmtDate(x.start)} – ${fmtDate(x.end)} · ${x.attempts} ${x.attempts===1?"Versuch":"Versuche"}</span></div>`).join("")}</div></details>`;
}

export function monkIntro(){
  if (!ui.monkSetup){
    const best = S.monk.history.reduce((m, x) => Math.max(m, x.best || 0), 0);
    return `<section class="monk" id="monk" aria-label="Monk Mode">
      <div class="mk-eye">修行 · Monk Mode</div>
      <h2>Ein Versprechen an dich selbst</h2>
      <p class="mk-muted" style="margin:0;max-width:52ch">Wähl deine Regeln, zum Beispiel kein PMO, kein Vapen oder kein Short-Form-Content, und bis zu drei eigene. Jeden Tag alles abhaken. Ein Fehltag setzt dich auf Tag 0 zurück.</p>
      ${best ? `<p style="margin:0;font-size:14px">Dein bisher bester Lauf: <b class="num">${best}</b> Tage. Zeit, ihn zu schlagen.</p>` : ""}
      <div class="row"><button class="mk-btn red" data-mk="open">Monk Mode einrichten</button></div>
      ${monkHistory()}
    </section>`;
  }
  const m = ui.monkSetup;
  return `<section class="monk" id="monk" aria-label="Monk Mode einrichten">
    <div class="mk-eye">修行 · Monk Mode einrichten</div>
    <div class="mk-form">
      <div><span class="mk-lbl" style="display:block;margin-bottom:6px">Dauer in Tagen</span><div class="mk-durs">${MONK_DURS.map(d => `<button class="mk-dur" data-mk="goal" data-a="${d}" aria-pressed="${m.goal===d}">${d}</button>`).join("")}</div></div>
      <div><span class="mk-lbl" style="display:block;margin-bottom:6px">Vorschläge, tippe zum An- oder Abwählen</span><div class="mk-durs">${MONK_FIXED.map(f => `<button class="mk-dur" style="width:auto;padding:8px 12px" data-mk="fixed" data-a="${f.id}" aria-pressed="${m.fixed.includes(f.id)}">${f.name}</button>`).join("")}</div></div>
      <div class="grid2">
        ${[0, 1, 2].map(i => `<div><label class="mk-lbl" for="mk-own-${i}">Eigene Regel ${i + 1} (optional)</label><input id="mk-own-${i}" value="${esc(m.own[i] || "")}" maxlength="60" placeholder="${["z. B. Jeden Tag 30 Min lesen", "z. B. Vor 7 Uhr aufstehen", "z. B. Kein Zucker"][i]}"></div>`).join("")}
      </div>
      ${!m.fixed.length && !m.own.some(x => x.trim()) ? `<p class="mk-muted" style="margin:0;font-size:13px">Wähl mindestens eine Regel.</p>` : ""}
      <div><label class="mk-lbl" for="mk-why">Warum machst du das?</label><textarea id="mk-why" maxlength="400" placeholder="Wer willst du nach diesen Tagen sein? Das steht jeden Tag vor dir.">${esc(m.why)}</textarea></div>
      <div class="grid2">
        <div><label class="mk-lbl" for="mk-reward">Belohnung, wenn du es schaffst</label><input id="mk-reward" value="${esc(m.reward)}" maxlength="120" placeholder="z. B. Neue Boxhandschuhe"></div>
        <div><label class="mk-lbl" for="mk-cost">Was sparst du pro Tag, z. B. durch kein Vapen? (€, optional)</label><input id="mk-cost" inputmode="decimal" value="${esc(m.cost)}" placeholder="z. B. 2,50"></div>
      </div>
      <label class="mk-pact" for="mk-pact"><input type="checkbox" id="mk-pact" ${m.pact?"checked":""}><span>Ich ziehe die ${m.goal} Tage durch. Ich bin ehrlich zu mir. Ein Fehltag setzt mich auf Tag 0 zurück.</span></label>
      <div class="row"><button class="mk-btn red" data-mk="start" ${m.pact?"":"disabled"}>Schwur ablegen und starten</button><button class="mk-btn ghost" data-mk="close">Abbrechen</button></div>
    </div>
  </section>`;
}

export function monkDone(run){
  const ext = MONK_DURS.filter(d => d > run.goal);
  return `<section class="monk" id="monk" aria-label="Monk Mode geschafft">
    <div class="mk-done">
      <div class="mk-eye">修行 · Monk Mode abgeschlossen</div>
      <div class="big">達成</div>
      <h2>${run.goal} Tage. Durchgezogen.</h2>
      <p class="mk-muted" style="margin:0;max-width:46ch">${run.attempts.length ? `Nach ${run.attempts.length + 1} Versuchen. ` : "Im ersten Anlauf. "}${sumUrges(run)} Mal Drang überstanden${run.cost ? `, ${fmtNum(cleanDays(run) * run.cost)} € gespart` : ""}.</p>
      ${run.reward ? `<p style="margin:0">Deine Belohnung: <b>${esc(run.reward)}</b>. Du hast sie dir verdient.</p>` : ""}
    </div>
    ${ext.length ? `<div style="display:flex;flex-direction:column;gap:8px"><span class="mk-lbl">Weitermachen, ohne den Lauf zu verlieren</span><div class="mk-durs">${ext.map(d => `<button class="mk-dur" data-mk="extend" data-a="${d}">${d}</button>`).join("")}</div></div>` : ""}
    <div class="row"><button class="mk-btn red" data-mk="finish">Abschließen</button></div>
  </section>`;
}

export function monkArchive(result){
  const r = S.monk.run;
  S.monk.history.push({ goal: r.goal, start: r.start, end: todayKey(), result, best: r.best || 0, attempts: r.attempts.length + 1, clean: cleanDays(r) });
  S.monk.run = null;
}

export function monkAction(a, arg){
  const run = S.monk.run, t = todayKey();
  switch (a){
    case "scroll": { const el = document.getElementById("monk"); if (el) el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); return; }
    case "open": ui.monkSetup = { goal: 30, fixed: MONK_FIXED.map(f => f.id), own: ["", "", ""], why: "", reward: "", cost: "", pact: false }; break;
    case "close": ui.monkSetup = null; break;
    case "goal": ui.monkSetup.goal = +arg; break;
    case "fixed": { const f = ui.monkSetup.fixed; ui.monkSetup.fixed = f.includes(arg) ? f.filter(x => x !== arg) : [...f, arg]; break; }
    case "start": {
      const m = ui.monkSetup; if (!m || !m.pact) return;
      const own = m.own.map(x => x.trim()).filter(Boolean).slice(0, 3);
      const rules = [...MONK_FIXED.filter(f => m.fixed.includes(f.id)).map(f => ({ id: f.id, name: f.name })), ...own.map((n, i) => ({ id: "c" + (i + 1), name: n }))];
      if (!rules.length){ toast("Wähl mindestens eine Regel."); return; }
      S.monk.run = { id: uid(), goal: m.goal, start: t, streakStart: t, rules,
        why: m.why.trim(), reward: m.reward.trim(), cost: toNum(m.cost) || 0, days: {}, urges: {}, attempts: [], best: 0, status: "active" };
      ui.monkSetup = null; markDirty("monk"); toast(`Monk Mode gestartet: ${m.goal} Tage. Heute ist Tag 1.`); break;
    }
    case "tog": {
      if (!run || run.status !== "active") return;
      const [k, rid] = arg.split("|");
      if (k < run.streakStart || k < addDays(t, -1) || k > t || run.relapseDay === k) return;
      const e = run.days[k] || (run.days[k] = {});
      if (e[rid] === 1) delete e[rid]; else e[rid] = 1;
      if (!Object.keys(e).length) delete run.days[k];
      if (mComplete(run, k)){ ui.monkFlash = k; toast(k === t ? "Tag besiegelt. 済" : "Gestern nachgetragen. Lauf gerettet."); }
      markDirty("monk"); break;
    }
    case "urge": { if (!run) return; run.urges = run.urges || {}; run.urges[t] = (run.urges[t] || 0) + 1; markDirty("monk"); toast("Stark. Der Drang geht vorbei, du bleibst."); break; }
    case "relapse": ui.monkConfirm = "relapse"; ui.monkNote = ""; break;
    case "abort": ui.monkConfirm = "abort"; break;
    case "cancel": ui.monkConfirm = null; break;
    case "do-relapse": {
      if (ui.monkNote.trim().length < 3){ toast("Schreib kurz auf, was der Auslöser war."); document.getElementById("mk-note")?.focus(); return; }
      const reached = ui.mState.count - (mComplete(run, t) ? 1 : 0);
      run.attempts.push({ from: run.streakStart, to: t, reached: Math.max(0, reached), note: ui.monkNote.trim() });
      delete run.days[t]; run.streakStart = addDays(t, 1); run.relapseDay = t;
      ui.monkConfirm = null; markDirty("monk"); toast("Zurückgesetzt. Morgen ist Tag 1."); break;
    }
    case "do-abort": monkArchive("beendet"); ui.monkConfirm = null; markDirty("monk"); break;
    case "extend": run.goal = +arg; run.status = "active"; delete run.doneAt; markDirty("monk"); toast(`Ziel auf ${arg} Tage erhöht.`); break;
    case "finish": monkArchive("geschafft"); markDirty("monk"); break;
  }
  render();
  if (ui.monkFlash){ setTimeout(() => { ui.monkFlash = null; }, 600); }
}
