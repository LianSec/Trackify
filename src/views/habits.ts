// @ts-nocheck
import { S, ui } from "../state";
import { habitStats, hc, startOf } from "../domain/habits";
import { NCOL, WD, esc, fromKey } from "../lib/util";
import { P, markDirty, monthDocId } from "../storage/persist";

// ----- Habits manage -----
export function vHabits(){
  const list = S.habits;
  const rows = list.map((h,i) => {
    const s = habitStats(h);
    const sched = (h.days && h.days.length && h.days.length < 7) ? h.days.map(d=>WD[d]).join(" ") : "täglich";
    return `<div class="card" style="--hc:${hc(h)}${h.archived?";opacity:.65":""}">
      <div class="hm">
        <span class="sw-big"></span>
        <div style="min-width:0"><div class="hname">${esc(h.name)}${h.archived?' <span class="tag">archiviert</span>':""}</div>
          <div class="muted" style="font-size:12.5px">${h.type==="number"?`Zahl · Ziel ${h.target||1} ${esc(h.unit||"")}`:"Abhaken"} · ${sched} · seit ${fromKey(startOf(h)).toLocaleDateString("de-DE")} · Best ${s.best}</div></div>
        <div class="row" style="gap:4px">
          <button class="iconbtn" data-mv="${h.id}" data-d="-1" ${i===0?"disabled":""} aria-label="Nach oben">↑</button>
          <button class="iconbtn" data-mv="${h.id}" data-d="1" ${i===list.length-1?"disabled":""} aria-label="Nach unten">↓</button>
          <button class="btn" data-edit="${h.id}">${ui.editing===h.id?"Schließen":"Bearbeiten"}</button>
        </div>
      </div>
      ${ui.editing===h.id ? habitForm(h) : ""}
    </div>`;
  }).join("");
  return `<div class="row" style="justify-content:space-between"><h2>Gewohnheiten</h2><div class="row"><a class="btn" href="#import" style="text-decoration:none">Import &amp; Backup</a><button class="btn primary" data-edit="__new">${ui.editing==="__new"?"Abbrechen":"Neue Gewohnheit"}</button></div></div>
  ${ui.editing==="__new" ? `<div class="card">${habitForm(null)}</div>` : ""}
  ${rows || `<div class="card empty"><p class="muted">Noch keine Gewohnheiten. Leg eine an oder importiere deinen Notion-Export.</p></div>`}`;
}

export function legacyChecks(h){
  const calmDays = new Set(S.calm.sessions.map(x => x.k)), out = [];
  for (const k in S.days){ if (S.days[k][h.id] === 1 && !calmDays.has(k) && (h.target || 1) > 1) out.push(k); }
  return out;
}

export function migrateChecks(h){
  const ks = legacyChecks(h);
  ks.forEach(k => { S.days[k][h.id] = h.target || 1; P.dirty.add(monthDocId(k)); });
  if (ks.length) markDirty("config");
  return ks.length;
}

export function habitForm(h){
  const x = h || { name:"", type:"check", target:1, unit:"", days:[0,1,2,3,4,5,6], color: S.habits.length % NCOL };
  const id = h ? h.id : "new";
  const days = x.days && x.days.length ? x.days : [0,1,2,3,4,5,6];
  return `<form class="edit" data-form="${id}" style="${h?"":"margin-top:0;padding-top:0;border-top:0"}">
    <div class="grid2">
      <div class="field"><label class="label" for="f-name-${id}">Name</label><input id="f-name-${id}" name="name" required value="${esc(x.name)}" placeholder="z. B. MMA Training"></div>
      <div class="field"><label class="label" for="f-type-${id}">Art</label><select id="f-type-${id}" name="type"><option value="check" ${x.type!=="number"?"selected":""}>Abhaken</option><option value="number" ${x.type==="number"?"selected":""}>Zahl mit Ziel</option></select></div>
      <div class="field"><label class="label" for="f-target-${id}">Ziel (bei Zahl)</label><input id="f-target-${id}" name="target" inputmode="decimal" value="${x.target||1}"></div>
      <div class="field"><label class="label" for="f-unit-${id}">Einheit</label><input id="f-unit-${id}" name="unit" value="${esc(x.unit||"")}" placeholder="Seiten, Min, L"></div>
    </div>
    <div class="field"><label class="label" for="f-cue-${id}">Wann und wo? (Plan)</label><input id="f-cue-${id}" name="cue" maxlength="80" value="${esc(x.cue||"")}" placeholder="z. B. Direkt nach dem Frühstück am Schreibtisch"></div>
    <div class="field"><span class="label">Geplant an</span><div class="wdays">${WD.map((w,i)=>`<label><input type="checkbox" id="f-wd-${id}-${i}" name="wd" value="${i}" ${days.includes(i)?"checked":""}><span>${w}</span></label>`).join("")}</div></div>
    <div class="field"><span class="label">Farbe</span><div class="colors">${Array.from({length:NCOL},(_,i)=>`<label style="--hc:var(--h${i})"><input type="radio" id="f-col-${id}-${i}" name="color" value="${i}" ${(x.color||0)%NCOL===i?"checked":""} aria-label="Farbe ${i+1}"><span></span></label>`).join("")}</div></div>
    ${h && h.type === "number" && legacyChecks(h).length ? `<div class="banner warn" style="margin:0;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span><b class="num">${legacyChecks(h).length}</b> Tage haben noch ein altes Häkchen (Wert 1) und zählen deshalb nicht als erreicht.</span><button class="btn" type="button" data-migrate="${h.id}">Als Ziel erreicht übernehmen</button></div>` : ""}
    ${h ? `<div class="field"><label class="label" for="f-start-${id}">Startdatum</label><input id="f-start-${id}" name="created" type="date" value="${startOf(h)}" style="max-width:200px"></div>` : ""}
    <div class="row">
      <button class="btn primary" type="submit">${h?"Speichern":"Anlegen"}</button>
      ${h ? `<button class="btn" type="button" data-arch="${h.id}">${h.archived?"Wiederherstellen":"Archivieren"}</button>
      ${ui.confirmDel===h.id ? `<span class="muted" style="font-size:13px">Alle Einträge dieser Gewohnheit löschen?</span><button class="btn danger" type="button" data-delok="${h.id}">Endgültig löschen</button><button class="btn ghost" type="button" data-delno>Abbrechen</button>` : `<button class="btn danger" type="button" data-del="${h.id}">Löschen</button>`}` : ""}
    </div>
  </form>`;
}
