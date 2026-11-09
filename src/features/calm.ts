// @ts-nocheck
import { S, ui } from "../state";
import { markDirty } from "../storage/persist";
import { fmtClock } from "./sos";
import { $, addDays, esc, toast, todayKey } from "../lib/util";
import { render } from "../views/render";
import { invalidate, setVal, valOf } from "../domain/habits";
import { fmtNum, kpi } from "../views/stats";
import { fmtDate } from "./monk";

// ---------- Meditation & Atem ----------
export const BREATH = [
  { id: "box", kj: "静", name: "Box Breathing", use: "Fokus unter Druck, vor Prüfungen", phases: [["in",4],["hold",4],["out",4],["hold",4]] },
  { id: "478", kj: "眠", name: "4-7-8", use: "Runterfahren, zum Einschlafen", phases: [["in",4],["hold",7],["out",8]] },
  { id: "coh", kj: "和", name: "Kohärenz", use: "Achtsamkeit, Balance, nach dem Training", phases: [["in",5.5],["out",5.5]] },
  { id: "sigh", kj: "息", name: "Doppeltes Seufzen", use: "Akuter Stress, Nervosität, Wut", phases: [["in",2],["in2",1],["out",6]] },
  { id: "act", kj: "起", name: "Aktivierung", use: "Mittagstief, vor dem Training", phases: [["in",4],["out",2]] },
  { id: "power", kj: "火", name: "Energie-Runden", use: "Maximale Wachheit am Morgen", rounds: true }
];

export const PH_LABEL = { in: "Einatmen", in2: "Nochmal kurz einatmen", hold: "Halten", out: "Ausatmen", fast: "", holdout: "Ausgeatmet halten", holdin: "Eingeatmet halten", med: "Sitz still. Atme natürlich." };

export function fmtDur(sec){ sec = Math.round(sec); if (sec < 60) return `${sec} Sek`; const m = Math.floor(sec / 60), r = sec % 60; return r ? `${m} Min ${r} Sek` : `${m} Min`; }

export const AMB = [["none","Stille"],["sea","Meer"],["rain","Regen"],["drone","Tiefer Ton"]];

export function cs(){
  const st = S.calm.settings || {};
  let hid = st.hid;
  if (hid === undefined){ const m = S.habits.find(h => !h.archived && /medit/i.test(h.name)); hid = m ? m.id : ""; }
  return { hid, minMin: st.minMin ?? 5, countBreath: st.countBreath ?? true, amb: st.amb ?? "sea", vol: st.vol ?? 0.5, cueVol: st.cueVol ?? 0.7, voice: st.voice ?? false,
    interval: st.interval ?? 0, medMin: st.medMin ?? 10, brMin: st.brMin ?? 5, pid: st.pid ?? "box", rounds: st.rounds ?? 3 };
}

export function setCs(patch){ S.calm.settings = { ...(S.calm.settings || {}), ...patch }; markDirty("calm"); }

export function rhythm(b){ return b.rounds ? "30× schnell · halten · erholen" : b.phases.map(p => String(p[1]).replace(".", ",")).join(" · "); }

export function buildSeq(b, mins, rounds){
  const seq = [];
  if (b.rounds){
    for (let r = 0; r < rounds; r++){
      for (let i = 0; i < 30; i++){ seq.push(["in", 1.5, i+1]); seq.push(["out", 1.5, i+1]); }
      seq.push(["holdout", 30]); seq.push(["in", 2]); seq.push(["holdin", 15]); seq.push(["out", 3]);
    }
    return seq;
  }
  const cyc = b.phases.reduce((a, p) => a + p[1], 0), n = Math.max(1, Math.round(mins * 60 / cyc));
  for (let i = 0; i < n; i++) for (const p of b.phases) seq.push([p[0], p[1]]);
  return seq;
}

// ---- Audio (Web Audio, alles synthetisch erzeugt)
export const AU = { ctx: null, amb: null, ambOut: null, cue: null, nodes: [], ambKind: null };

export function audio(){
  try {
    if (!AU.ctx){ const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; AU.ctx = new C(); AU.amb = AU.ctx.createGain(); AU.amb.connect(AU.ctx.destination); AU.cue = AU.ctx.createGain(); AU.cue.connect(AU.ctx.destination); }
    if (AU.ctx.state === "suspended") AU.ctx.resume();
    const c = cs(); AU.amb.gain.value = c.vol * 0.9; AU.cue.gain.value = c.cueVol;
    return AU.ctx;
  } catch(e){ return null; }
}

export function noiseBuf(kind){
  const ctx = AU.ctx, len = ctx.sampleRate * 8, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  let last = 0, b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++){
    const w = Math.random() * 2 - 1;
    if (kind === "brown"){ last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    else { b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164; b2 = 0.57000 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11; }
  }
  // weicher Übergang am Loop-Ende
  const f = Math.floor(ctx.sampleRate * 0.05); for (let i = 0; i < f; i++){ const a = i / f; d[len - f + i] = d[len - f + i] * (1 - a) + d[i] * a; }
  return buf;
}

export function ambientStart(kind){
  const ctx = audio(); if (!ctx) return;
  if (AU.ambKind === kind && AU.ambOut) return;
  ambientStop(0.8);
  if (kind === "none"){ AU.ambKind = kind; return; }
  const out = ctx.createGain(); out.gain.setValueAtTime(0, ctx.currentTime); out.gain.linearRampToValueAtTime(1, ctx.currentTime + 3); out.connect(AU.amb);
  const srcs = [];
  const loop = (k) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf(k); s.loop = true; srcs.push(s); return s; };
  if (kind === "sea"){
    const s = loop("brown"), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700;
    const g = ctx.createGain(); g.gain.value = 0.5; const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09; const lg = ctx.createGain(); lg.gain.value = 0.38;
    lfo.connect(lg); lg.connect(g.gain); s.connect(lp); lp.connect(g); g.connect(out); srcs.push(lfo);
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.05; const lg2 = ctx.createGain(); lg2.gain.value = 350; lfo2.connect(lg2); lg2.connect(lp.frequency); srcs.push(lfo2);
  } else if (kind === "rain"){
    const s = loop("pink"), hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 400; const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.value = 0.55; s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out);
    const s2 = loop("brown"), g2 = ctx.createGain(); g2.gain.value = 0.25; s2.connect(g2); g2.connect(out);
  } else if (kind === "drone"){
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; lp.connect(out);
    [[110,.13],[165,.07],[220.4,.05],[330.2,.022],[55,.08]].forEach(([f, v], i) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = v;
      const l = ctx.createOscillator(); l.frequency.value = 0.06 + i * 0.023; const lg = ctx.createGain(); lg.gain.value = v * 0.45; l.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(lp); srcs.push(o, l);
    });
  }
  srcs.forEach(n => n.start());
  AU.ambOut = { out, srcs }; AU.ambKind = kind;
}

export function ambientStop(fade = 2){
  if (!AU.ambOut || !AU.ctx) { AU.ambKind = null; return; }
  const { out, srcs } = AU.ambOut, t = AU.ctx.currentTime;
  out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(0, t + fade);
  srcs.forEach(n => { try { n.stop(t + fade + 0.1); } catch(e){} });
  AU.ambOut = null; AU.ambKind = null;
}

export function bell(t, f, dur = 4, vol = 0.35){
  const ctx = AU.ctx; if (!ctx) return;
  [[1,1],[2.01,.42],[2.76,.28],[5.4,.09],[8.93,.04]].forEach(([m, v]) => {
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f * m; const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur / m ** 0.35);
    o.connect(g); g.connect(AU.cue); o.start(t); o.stop(t + dur + 0.1); AU.nodes.push(o);
  });
}

export function glide(t, f0, f1, dur, vol = 0.22){
  const ctx = AU.ctx; if (!ctx) return;
  const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(AU.cue); o.start(t); o.stop(t + dur + 0.05); AU.nodes.push(o);
}

export function cueAt(type, t, fast){
  if (fast) return glide(t, type === "in" ? 520 : 440, type === "in" ? 560 : 400, 0.18, 0.06);
  if (type === "in") glide(t, 330, 494, 0.9);
  else if (type === "in2") glide(t, 494, 587, 0.4, 0.18);
  else if (type === "out") glide(t, 494, 330, 0.9);
  else bell(t, 660, 1.6, 0.16);
}

export function cancelCues(){ AU.nodes.forEach(o => { try { o.stop(); } catch(e){} }); AU.nodes = []; }

export const sElapsed = () => { if (!ui.sess) return 0; const now = ui.sess.pausedAt || Date.now(); return Math.max(0, (now - ui.sess.start - ui.sess.paused) / 1000); };

export function scheduleFrom(el){
  const ctx = audio(); if (!ctx) return;
  cancelCues();
  const base = ctx.currentTime + 0.05 - el;
  if (ui.sess.kind === "med"){
    if (el < 0.5) bell(base + 0.1, 196, 6, 0.4);
    if (ui.sess.interval) for (let k = ui.sess.interval * 60; k < ui.sess.total - 1; k += ui.sess.interval * 60) if (k >= el) bell(base + k, 294, 4, 0.22);
  } else {
    let t = 0;
    for (const ph of ui.sess.seq){ if (t >= el - 0.02) cueAt(ph[0], base + t, ph[2] !== undefined); t += ph[1]; }
  }
  if (ui.sess.total >= el){ bell(base + ui.sess.total, 196, 6, 0.4); bell(base + ui.sess.total + 2.2, 196, 6, 0.3); }
}

export async function lockScreen(){ try { if ("wakeLock" in navigator) ui.wakeLock = await navigator.wakeLock.request("screen"); } catch(e){ ui.wakeLock = null; } }

export function unlockScreen(){ try { ui.wakeLock && ui.wakeLock.release(); } catch(e){} ui.wakeLock = null; }

export function startSession(kind){
  const c = cs();
  let s;
  if (kind === "med") s = { kind, title: "瞑想 · Meditation", total: c.medMin * 60, interval: c.interval, seq: [["med", c.medMin * 60]] };
  else {
    const b = BREATH.find(x => x.id === c.pid) || BREATH[0], seq = buildSeq(b, c.brMin, c.rounds);
    s = { kind: "breath", pid: b.id, title: `${b.kj} · ${b.name}`, seq, total: seq.reduce((a, p) => a + p[1], 0) };
  }
  // Szalen für den Kreis vorberechnen
  let sc = 0.55; s.scales = s.seq.map(([ty]) => { const a = sc; if (ty === "in") sc = 1; else if (ty === "in2") sc = 1.1; else if (ty === "out") sc = 0.55; return [a, sc]; });
  ui.sess = { ...s, start: Date.now(), paused: 0, pausedAt: null, idx: -1, dim: false, done: null };
  audio(); ambientStart(c.amb); scheduleFrom(0); lockScreen();
  renderSession();
  ui.sessInt = setInterval(sessTick, 200);
  const loop = () => { paintSession(); ui.sessRaf = requestAnimationFrame(loop); }; ui.sessRaf = requestAnimationFrame(loop);
}

export function phaseAt(el){
  let t = 0;
  for (let i = 0; i < ui.sess.seq.length; i++){ const d = ui.sess.seq[i][1]; if (el < t + d) return { i, p: (el - t) / d, left: t + d - el }; t += d; }
  return { i: ui.sess.seq.length - 1, p: 1, left: 0 };
}

export function sessTick(){
  if (!ui.sess || ui.sess.done) return;
  const el = sElapsed();
  if (el >= ui.sess.total){ finishSession(true); return; }
  if (ui.sess.kind === "breath" && cs().voice && !ui.sess.pausedAt){
    const { i } = phaseAt(el);
    if (i !== ui.sess.idx){ ui.sess.idx = i; const ty = ui.sess.seq[i][0]; if (ui.sess.seq[i][2] === undefined && PH_LABEL[ty]) speak(PH_LABEL[ty]); }
  }
}

export function speak(txt){ try { const u = new SpeechSynthesisUtterance(txt); u.lang = "de-DE"; u.rate = 0.9; u.volume = cs().cueVol; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch(e){} }

export const ease = x => 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, x))) / 2;

export function paintSession(){
  if (!ui.sess || ui.sess.done) return;
  const el = sElapsed(), orb = document.getElementById("ss-orb"); if (!orb) return;
  const left = Math.max(0, ui.sess.total - el);
  document.getElementById("ss-left").textContent = fmtClock(left);
  const lab = document.getElementById("ss-label"), sec = document.getElementById("ss-sec");
  if (ui.sess.kind === "med"){
    const sc = 0.78 + 0.04 * Math.sin(el / 8 * Math.PI * 2);
    orb.style.transform = `scale(${sc.toFixed(3)})`;
    lab.textContent = ui.sess.pausedAt ? "Pausiert" : PH_LABEL.med;
    sec.textContent = ui.sess.interval ? `Gong alle ${ui.sess.interval} Min` : "";
    return;
  }
  const { i, p, left: pl } = phaseAt(el), ph = ui.sess.seq[i], [a, b] = ui.sess.scales[i];
  orb.style.transform = `scale(${(a + (b - a) * ease(p)).toFixed(3)})`;
  if (ui.sess.pausedAt){ lab.textContent = "Pausiert"; sec.textContent = ""; return; }
  if (ph[2] !== undefined){ lab.textContent = ph[0] === "in" ? "Tief ein" : "Locker aus"; sec.textContent = `Atemzug ${ph[2]} von 30`; }
  else { lab.textContent = PH_LABEL[ph[0]]; sec.textContent = String(Math.ceil(pl)); }
}

export function renderSession(){
  const box = $("#session");
  if (!ui.sess){ box.hidden = true; box.innerHTML = ""; document.body.style.overflow = ""; return; }
  box.hidden = false; document.body.style.overflow = "hidden";
  box.classList.toggle("dim", !!ui.sess.dim && !ui.sess.done);
  if (ui.sess.done){
    const d = ui.sess.done;
    box.innerHTML = `<div class="sess-top"><span class="mk-eye">${esc(ui.sess.title)}</span></div>
      <div class="sess-stage"><div class="mk-done"><div class="big" style="color:var(--calm-orb)">終</div><h2>${d.natural ? "Geschafft." : "Beendet."}</h2>
      <p class="mk-muted" style="margin:0">${d.dur} ${ui.sess.kind === "med" ? "meditiert" : "geatmet"}.</p>
      <p style="margin:0;max-width:40ch">${d.sync}</p></div></div>
      <div class="sess-bot"><button class="mk-btn red" data-calm="close">Schließen</button></div>`;
    return;
  }
  box.innerHTML = `<div class="sess-top"><span class="mk-eye">${esc(ui.sess.title)}</span><span class="left"><span id="ss-left">${fmtClock(ui.sess.total)}</span> übrig</span></div>
    <div class="sess-stage"><div class="orbwrap"><div class="orb" id="ss-orb"></div></div><div class="ss-label" id="ss-label" aria-live="polite"></div><div class="ss-sec" id="ss-sec"></div></div>
    <p class="hint">${ui.sess.dim ? "Tippe irgendwo, um die Anzeige zurückzuholen." : "Bei jedem Wechsel ertönt ein Klang, du kannst die Augen schließen."}</p>
    <div class="sess-bot"><button class="mk-btn" data-calm="pause">${ui.sess.pausedAt ? "Weiter" : "Pause"}</button><button class="mk-btn" data-calm="dim">Augen zu</button><button class="mk-btn ghost" data-calm="stop">Beenden</button></div>`;
  paintSession();
}

export function finishSession(natural){
  if (!ui.sess) return;
  const sec = Math.round(Math.min(sElapsed(), ui.sess.total));
  clearInterval(ui.sessInt); ui.sessInt = null; cancelAnimationFrame(ui.sessRaf); ui.sessRaf = null;
  if (!natural) cancelCues();
  setTimeout(() => ambientStop(3), natural ? 4000 : 0);
  unlockScreen(); try { speechSynthesis.cancel(); } catch(e){}
  let sync = "Zu kurz zum Speichern.";
  if (sec >= 1){
    S.calm.sessions = [...S.calm.sessions, { k: todayKey(), kind: ui.sess.kind, pid: ui.sess.pid || null, sec }].slice(-3000);
    markDirty("calm");
    sync = calmSync();
  }
  ui.sess.done = { natural, dur: fmtDur(sec), sync };
  renderSession(); render();
}

export function minsToday(){
  const c = cs(), t = todayKey();
  return S.calm.sessions.filter(x => x.k === t && (x.kind === "med" || c.countBreath)).reduce((a, x) => a + x.sec, 0) / 60;
}

export function calmSync(){
  const c = cs(), h = S.habits.find(x => x.id === c.hid);
  if (!h) return "Gespeichert. Verknüpfe unten eine Gewohnheit, dann wird sie automatisch abgehakt.";
  const last = S.calm.sessions[S.calm.sessions.length - 1];
  if (last.kind === "breath" && !c.countBreath) return "Gespeichert. Breathwork zählt laut Einstellung nicht für „" + esc(h.name) + "“.";
  const t = todayKey(), m = minsToday();
  if (h.type === "number"){
    const v = valOf(h, t), nv = Math.max(typeof v === "number" ? v : 0, Math.round(m * 10) / 10), tg = h.target || 1;
    setVal(t, h.id, nv); invalidate();
    return nv >= tg ? `„${esc(h.name)}“ ist für heute abgehakt ✓ (${fmtNum(nv)} von ${fmtNum(tg)} Min)` : `„${esc(h.name)}“: heute ${fmtNum(nv)} von ${fmtNum(tg)} Min. Noch ${fmtDur(Math.ceil((tg - nv) * 60))}, dann wird abgehakt.`;
  }
  if (m >= c.minMin){ setVal(t, h.id, 1); return `„${esc(h.name)}“ ist für heute abgehakt ✓`; }
  return `Heute ${Math.floor(m)} von ${c.minMin} Min für „${esc(h.name)}“. Noch ${Math.ceil(c.minMin - m)} Min, dann wird abgehakt.`;
}

export function calmAction(a, arg){
  const c = cs();
  switch (a){
    case "med": return startSession("med");
    case "breath": return startSession("breath");
    case "pid": setCs({ pid: arg }); break;
    case "medMin": setCs({ medMin: +arg }); break;
    case "brMin": setCs({ brMin: +arg }); break;
    case "rounds": setCs({ rounds: +arg }); break;
    case "interval": setCs({ interval: +arg }); break;
    case "minMin": setCs({ minMin: +arg }); break;
    case "amb": setCs({ amb: arg }); if (AU.ambKind) ambientStart(arg); break;
    case "test": { const ctx = audio(); if (!ctx) { toast("Dein Browser kann hier keine Töne abspielen."); return; } ambientStart(c.amb); const t = ctx.currentTime + 0.1; cueAt("in", t); cueAt("hold", t + 1.2); cueAt("out", t + 2.4); setTimeout(() => { if (!ui.sess) ambientStop(1.5); }, 6000); return; }
    case "pause": {
      if (!ui.sess || ui.sess.done) return;
      if (ui.sess.pausedAt){ ui.sess.paused += Date.now() - ui.sess.pausedAt; ui.sess.pausedAt = null; scheduleFrom(sElapsed()); }
      else { ui.sess.pausedAt = Date.now(); cancelCues(); }
      renderSession(); return;
    }
    case "dim": if (ui.sess){ ui.sess.dim = true; renderSession(); } return;
    case "stop": return finishSession(false);
    case "close": ui.sess = null; renderSession(); render(); return;
  }
  render();
}

export function vCalm(){
  const c = cs(), t = todayKey(), ses = S.calm.sessions;
  const wk = addDays(t, -6), sum = f => ses.filter(f).reduce((a, x) => a + x.sec, 0) / 60;
  const today = sum(x => x.k === t), week = sum(x => x.k >= wk), total = sum(() => true);
  let streak = 0; { let k = t; const days = new Set(ses.map(x => x.k)); if (!days.has(k)) k = addDays(k, -1); while (days.has(k)){ streak++; k = addDays(k, -1); } }
  const h = S.habits.find(x => x.id === c.hid);
  const b = BREATH.find(x => x.id === c.pid) || BREATH[0];
  const recent = ses.slice(-6).reverse();
  return `<div class="row" style="justify-content:space-between"><h2>Meditation &amp; Atem</h2>${h ? `<span class="muted" style="font-size:13px">Zählt für „${esc(h.name)}“</span>` : ""}</div>
  <div class="calm-sum">${kpi("Heute", fmtNum(today), "Min")}${kpi("Letzte 7 Tage", Math.round(week), "Min")}${kpi("Tage in Folge", streak, "")}${kpi("Gesamt", fmtNum(total / 60), "Std")}</div>

  <div class="card" style="display:flex;flex-direction:column;gap:12px">
    <div class="row" style="justify-content:space-between"><h3>Stille Meditation</h3><span class="label">瞑想</span></div>
    <div class="field"><span class="label">Dauer</span><div class="chiprow">${[5,10,15,20,30,45].map(m => `<button class="pill" data-calm="medMin" data-a="${m}" aria-pressed="${c.medMin === m}">${m} Min</button>`).join("")}</div></div>
    <div class="field"><span class="label">Zwischengong</span><div class="chiprow">${[[0,"Aus"],[1,"Jede Min"],[5,"Alle 5 Min"],[10,"Alle 10 Min"]].map(([v,l]) => `<button class="pill" data-calm="interval" data-a="${v}" aria-pressed="${c.interval === v}">${l}</button>`).join("")}</div></div>
    <div class="row"><button class="btn primary" data-calm="med">Meditation starten · ${c.medMin} Min</button></div>
  </div>

  <div class="card" style="display:flex;flex-direction:column;gap:12px">
    <div class="row" style="justify-content:space-between"><h3>Breathwork</h3><span class="label">Rhythmus in Sekunden</span></div>
    <div class="bw-grid">${BREATH.map(x => `<button class="bw" data-calm="pid" data-a="${x.id}" aria-pressed="${c.pid === x.id}"><span class="nm"><span>${x.name}</span><span class="kj">${x.kj}</span></span><span class="use">${x.use}</span><span class="rh">${rhythm(x)}</span></button>`).join("")}</div>
    ${b.rounds
      ? `<div class="field"><span class="label">Runden</span><div class="chiprow">${[2,3,4].map(r => `<button class="pill" data-calm="rounds" data-a="${r}" aria-pressed="${c.rounds === r}">${r} Runden</button>`).join("")}</div></div>
         <p class="note-warn">Nur sitzend oder liegend. Nie im Wasser, beim Autofahren oder im Stehen. Bei Schwindel oder Kribbeln sofort normal weiteratmen.</p>`
      : `<div class="field"><span class="label">Dauer</span><div class="chiprow">${[2,3,5,10,15].map(m => `<button class="pill" data-calm="brMin" data-a="${m}" aria-pressed="${c.brMin === m}">${m} Min</button>`).join("")}</div></div>`}
    <div class="row"><button class="btn primary" data-calm="breath">${b.name} starten · ${b.rounds ? `${c.rounds} Runden` : `${c.brMin} Min`}</button></div>
  </div>

  <div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
    <div class="card" style="display:flex;flex-direction:column;gap:12px;min-width:0">
      <h3>Klang</h3>
      <div class="field"><span class="label">Hintergrund</span><div class="chiprow">${AMB.map(([v,l]) => `<button class="pill" data-calm="amb" data-a="${v}" aria-pressed="${c.amb === v}">${l}</button>`).join("")}</div></div>
      <label class="slider" for="calm-vol"><span>Hintergrund</span><input type="range" id="calm-vol" min="0" max="1" step="0.05" value="${c.vol}"><span class="num">${Math.round(c.vol*100)}</span></label>
      <label class="slider" for="calm-cvol"><span>Signale</span><input type="range" id="calm-cvol" min="0" max="1" step="0.05" value="${c.cueVol}"><span class="num">${Math.round(c.cueVol*100)}</span></label>
      <label class="row" for="calm-voice" style="font-size:14px;gap:8px;flex-wrap:nowrap;align-items:flex-start"><input type="checkbox" id="calm-voice" ${c.voice ? "checked" : ""}> Zusätzlich ansagen („Einatmen“, „Halten“ …)</label>
      <div class="row"><button class="btn" data-calm="test">Klang testen</button></div>
    </div>
    <div class="card" style="display:flex;flex-direction:column;gap:12px;min-width:0">
      <h3>Mit dem Tracker verknüpfen</h3>
      <div class="field"><label class="label" for="calm-hid">Gewohnheit</label><select id="calm-hid" style="border:1px solid var(--line);border-radius:8px;background:var(--bg);padding:7px 10px"><option value="">Keine</option>${S.habits.filter(x => !x.archived).map(x => `<option value="${x.id}" ${x.id === c.hid ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div>
      ${h && h.type === "number" ? `<p class="cap">Die Minuten von heute werden in „${esc(h.name)}“ eingetragen. Ab ${fmtNum(h.target || 1)} Min (dein Ziel) ist sie abgehakt.</p>`
        : `<div class="field"><span class="label">Abhaken ab</span><div class="chiprow">${[1,5,10,15,20].map(m => `<button class="pill" data-calm="minMin" data-a="${m}" aria-pressed="${c.minMin === m}">${m} Min</button>`).join("")}</div></div>`}
      <label class="row" for="calm-cb" style="font-size:14px;gap:8px;flex-wrap:nowrap;align-items:flex-start"><input type="checkbox" id="calm-cb" ${c.countBreath ? "checked" : ""}> Breathwork zählt auch</label>
      ${recent.length ? `<div class="slist">${recent.map(x => `<div><span>${x.kind === "med" ? "Meditation" : (BREATH.find(b => b.id === x.pid) || {}).name || "Breathwork"}</span><span class="muted num">${fmtDate(x.k)} · ${fmtDur(x.sec)}</span></div>`).join("")}</div>` : `<p class="cap">Noch keine Sitzungen. Deine erste erscheint hier.</p>`}
    </div>
  </div>`;
}
