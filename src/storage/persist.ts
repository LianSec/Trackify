// @ts-nocheck
import { $, toast } from "../lib/util";
import { S } from "../state";
import { render } from "../views/render";
import type { Backend, DocData } from "./backend";

// ---------- Persistenz ----------
// Der Zustand ist in Dokumente aufgeteilt: "config" (Gewohnheiten), "m-JJJJ-MM" (Tage eines Monats),
// "t-JJJJ-MM" (Trainings eines Monats), "monk", "calm", "tcfg". Geändert wird immer nur das betroffene Dokument.
export const P = { backend: null as Backend | null, dirty: new Set<string>(), inflight: new Set<string>(), timer: null, flushing: false, unsub: null };

export function setSave(t: string){ $("#save").textContent = t; }

export function monthDocId(k: string){ return "m-" + k.slice(0, 7); }

export function buildDoc(id: string): DocData {
  if (id === "config") return { habits: S.habits, v: 1 };
  if (id.startsWith("t-")){ const pre = id.slice(2) + "-"; return { sessions: S.train.sess.filter(x => x.k.startsWith(pre)) }; }
  if (id === "tcfg") return { ...S.train.cfg };
  if (id === "calm") return { sessions: S.calm.sessions, settings: S.calm.settings };
  if (id === "monk") return { run: S.monk.run, history: S.monk.history, alts: S.monk.alts || null, log: S.monk.log || [] };
  const pre = id.slice(2) + "-"; const days = {};
  for (const k in S.days) if (k.startsWith(pre)) days[k] = S.days[k];
  return { days };
}

/** Übernimmt ein gespeichertes Dokument in den Zustand. */
export function applyDoc(id: string, body: any){
  body = body || {};
  if (id.startsWith("t-")){ const pre = id.slice(2) + "-"; S.train.sess = S.train.sess.filter(x => !x.k.startsWith(pre)).concat((body.sessions || []).map(x => JSON.parse(JSON.stringify(x)))); return; }
  if (id === "tcfg"){ S.train.cfg = { ...body }; return; }
  if (id === "calm"){ S.calm = { sessions: Array.isArray(body.sessions) ? body.sessions.slice() : [], settings: body.settings && typeof body.settings === "object" ? { ...body.settings } : {} }; return; }
  if (id === "monk"){ S.monk = { run: body.run ? JSON.parse(JSON.stringify(body.run)) : null, history: Array.isArray(body.history) ? body.history.slice() : [], alts: Array.isArray(body.alts) ? body.alts.map(a => ({ ...a })) : null, log: Array.isArray(body.log) ? body.log.slice() : [] }; return; }
  if (id === "config"){ S.habits = Array.isArray(body.habits) ? body.habits.map(h => ({ ...h, days: [...(h.days || [])] })) : []; return; }
  if (id.startsWith("m-")){
    const pre = id.slice(2) + "-";
    for (const k of Object.keys(S.days)) if (k.startsWith(pre)) delete S.days[k];
    const days = body.days || {};
    for (const k in days) S.days[k] = { ...days[k] };
  }
}

/** Alle Dokument-IDs, die der aktuelle Zustand belegt (für Backup-Import und Migration). */
export function allDocIds(): string[] {
  const ids = new Set(["config", "monk", "calm", "tcfg"]);
  for (const k in S.days) ids.add(monthDocId(k));
  for (const x of S.train.sess) ids.add("t-" + x.k.slice(0, 7));
  return [...ids];
}

export function markDirty(id: string){ P.dirty.add(id); clearTimeout(P.timer); setSave("Ungespeichert"); P.timer = setTimeout(flush, 450); }

export async function flush(){
  if (!P.backend || P.flushing) return;
  P.flushing = true; setSave("Speichert…");
  let failed = false;
  try {
    while (P.dirty.size){
      const id = P.dirty.values().next().value; P.dirty.delete(id); P.inflight.add(id);
      try { await P.backend.save(id, buildDoc(id)); }
      catch (e){
        failed = true; P.dirty.add(id);
        console.error("Speichern fehlgeschlagen", id, e);
        P.inflight.delete(id);
        break;
      }
      P.inflight.delete(id);
    }
  } finally {
    P.flushing = false;
    if (failed){
      setSave("Nicht gespeichert");
      toast("Speichern fehlgeschlagen. Prüf deine Verbindung, ich versuche es gleich nochmal.");
      clearTimeout(P.timer); P.timer = setTimeout(flush, 5000);
    } else setSave(P.backend.kind === "local" ? "Lokal gespeichert" : "Gespeichert");
  }
}

export function banner(html: string, cls?: string){ $("#banner").innerHTML = html ? `<div class="banner ${cls || ""}">${html}</div>` : ""; }

export async function init(backend: Backend){
  P.backend = backend;
  if (P.unsub) P.unsub();
  try {
    const docs = await backend.load();
    for (const [id, body] of Object.entries(docs)) applyDoc(id, body);
  } catch (e){
    console.error(e);
    banner("Deine Daten konnten nicht geladen werden. Prüf die Verbindung und lade die Seite neu.", "warn");
  }
  P.unsub = backend.subscribe((id, body) => {
    if (P.dirty.has(id) || P.inflight.has(id)) return;
    applyDoc(id, body); render();
  });
  S.loaded = true;
  setSave(backend.kind === "local" ? "Lokal" : "Gespeichert");
  banner(backend.kind === "local" ? `Du nutzt Trackify ohne Konto. Deine Daten liegen nur in diesem Browser. Mach regelmäßig ein Backup unter <a href="#import">Import &amp; Backup</a>.` : "", "warn");
  render();
}
