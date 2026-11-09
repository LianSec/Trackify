// @ts-nocheck
import { S } from "../state";
import { NCOL, addDays, todayKey, wdOf } from "../lib/util";
import { markDirty, monthDocId } from "../storage/persist";

// ---------- domain ----------
export const active = () => S.habits.filter(h => !h.archived);

export const hc = h => `var(--h${(h.color||0)%NCOL})`;

export function startOf(h){ return h.created || todayKey(); }

export function scheduled(h, k){ return k >= startOf(h) && (h.days && h.days.length ? h.days.includes(wdOf(k)) : true); }

export function valOf(h, k){ const e = S.days[k]; return e ? e[h.id] : undefined; }

export function stateOf(h, k){
  const v = valOf(h, k);
  if (v === "s") return "skip";
  if (h.type === "number") return (typeof v === "number" && v >= (h.target||1)) ? "done" : (typeof v === "number" && v > 0 ? "part" : "none");
  return v === 1 ? "done" : "none";
}

export function setVal(k, hid, v){
  const e = S.days[k] || (S.days[k] = {});
  if (v === undefined || v === null || v === 0 || v === "") delete e[hid]; else e[hid] = v;
  if (!Object.keys(e).length) delete S.days[k];
  markDirty(monthDocId(k));
}

export function setNote(k, txt){
  const e = S.days[k] || (S.days[k] = {});
  if (txt.trim()) e._note = txt; else delete e._note;
  if (!Object.keys(e).length) delete S.days[k];
  markDirty(monthDocId(k));
}

export function saveHabits(){ markDirty("config"); }

export const statCache = new Map();

export function invalidate(){ statCache.clear(); }

export function habitStats(h){
  const ck = h.id; if (statCache.has(ck)) return statCache.get(ck);
  const t = todayKey(); let k = startOf(h);
  let curS = 0, best = 0, sched = 0, done = 0, total = 0, sched30 = 0, done30 = 0;
  const lim30 = addDays(t, -29);
  let guard = 0;
  while (k <= t && guard++ < 20000){
    if (scheduled(h, k)){
      const st = stateOf(h, k);
      if (st === "done"){ curS++; best = Math.max(best, curS); sched++; done++; if (k >= lim30){ sched30++; done30++; } }
      else if (st === "skip"){ /* zählt nicht */ }
      else if (k === t){ /* heute noch offen */ }
      else { curS = 0; sched++; if (k >= lim30) sched30++; }
    }
    if (h.type === "number"){ const v = valOf(h,k); if (typeof v === "number") total += v; }
    k = addDays(k, 1);
  }
  const r = { cur: curS, best, rate: sched ? done/sched : 0, rate30: sched30 ? done30/sched30 : 0, done, sched, total };
  statCache.set(ck, r); return r;
}

export function dayScore(k, list){
  let s = 0, d = 0;
  for (const h of list){ if (!scheduled(h,k)) continue; const st = stateOf(h,k); if (st === "skip") continue; s++; if (st === "done") d++; }
  return { s, d, p: s ? d/s : null };
}

export function overallStats(){
  if (statCache.has("__all")) return statCache.get("__all");
  const list = S.habits; const t = todayKey();
  let first = t; for (const h of list) if (startOf(h) < first) first = startOf(h);
  let k = first, tracked = 0, perfect = 0, sum = 0, n = 0, perfCur = 0, perfBest = 0, guard = 0;
  while (k <= t && guard++ < 20000){
    const sc = dayScore(k, list);
    if (S.days[k]) tracked++;
    if (sc.p !== null){
      sum += sc.p; n++;
      if (sc.p === 1){ perfect++; perfCur++; perfBest = Math.max(perfBest, perfCur); }
      else if (k !== t) perfCur = 0;
    }
    k = addDays(k, 1);
  }
  const r = { first, tracked, perfect, avg: n ? sum/n : 0, perfCur, perfBest, span: n };
  statCache.set("__all", r); return r;
}
