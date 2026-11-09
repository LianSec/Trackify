// @ts-nocheck
import { render } from "../views/render";
import { esc, toast } from "../lib/util";
import { exKey, exNames, newDraft } from "./training";
import { OTHER_EQ, trDraftSave } from "./training-editor";
import { toNum } from "./import";
import { ui } from "../state";
import { recognizeImage } from "../ocr/ocr";
import { matchExercise, parsePlanText } from "../ocr/parse";

export function shotBox(){
  if (ui.shot && ui.shot.busy) return `<div class="banner" style="margin:0;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span>Screenshot wird gelesen${ui.shot.p ? ` (${Math.round(ui.shot.p * 100)} %)` : ""}. Das passiert nur auf deinem Gerät und dauert beim ersten Mal etwas länger.</span></div>`;
  if (ui.shot && ui.shot.days && ui.shot.days.length > 1) return `<div class="banner" style="margin:0;display:flex;flex-direction:column;gap:8px"><span>Im Screenshot sind ${ui.shot.days.length} Tage. Welchen trainierst du?</span><div class="chiprow">${ui.shot.days.map((dd, i) => `<button class="pill" data-tr="shotday" data-a="${i}">${esc(dd.label || "Tag " + (i + 1))} · ${dd.exercises.length} Übungen</button>`).join("")}</div></div>`;
  return `<div class="row" style="gap:8px"><label class="btn" for="tr-shot" style="cursor:pointer">Plan aus Screenshot laden</label><input type="file" id="tr-shot" accept="image/png,image/jpeg,image/webp" hidden><span class="cap">Leerer Plan: Übungen und Sätze werden vorbereitet. Ausgefüllter Plan: Gewichte und Wiederholungen werden übernommen. Das Bild verlässt dein Gerät nicht.</span></div>`;
}

export async function shotRun(file){
  if (!file) return;
  if (!ui.trEdit) ui.trEdit = newDraft("gym");
  ui.shot = { busy: true, p: 0 }; render();
  try {
    const text = await recognizeImage(file, p => { if (ui.shot && ui.shot.busy){ ui.shot.p = p; const b = document.querySelector(".ted .banner span"); if (b) b.textContent = `Screenshot wird gelesen (${Math.round(p * 100)} %). Das passiert nur auf deinem Gerät.`; } });
    const known = exNames().filter(x => !OTHER_EQ.test(x.n)).map(x => x.n);
    const days = parsePlanText(text).map(dd => ({ ...dd, exercises: dd.exercises.map(x => ({ ...x, name: matchExercise(x.name, known) })) }));
    if (!days.length){ ui.shot = null; toast("Im Screenshot wurden keine Übungen erkannt. Schneide ihn so zu, dass nur die Tabelle zu sehen ist."); return render(); }
    if (days.length === 1){ ui.shot = null; shotApply(days[0]); } else ui.shot = { days };
  } catch (e){
    console.error(e);
    ui.shot = null;
    toast("Der Screenshot konnte nicht gelesen werden. Nimm einen PNG- oder JPG-Screenshot.");
  }
  render();
}

export function shotApply(day){
  const d = ui.trEdit; if (!d) return;
  const num = v => { const n = typeof v === "number" ? v : toNum(v); return isFinite(n) ? n : 0; };
  const ex = day.exercises.map(x => {
    const sets = (Array.isArray(x.sets) ? x.sets : []).map(st => [num(st[0]), Math.round(num(st[1]))]).filter(st => st[1] > 0);
    const plan = Math.max(0, Math.round(num(x.plannedSets))) || 0;
    const known = exNames().find(k => exKey(k.n) === exKey(x.name));
    return { n: known ? known.n : String(x.name).trim(), plan, target: String(x.targetReps || "").trim(), note: String(x.note || "").trim(),
      sets: sets.length ? sets.map(st => [String(st[0]), String(st[1])]) : Array.from({ length: Math.max(1, plan) }, () => ["", ""]) };
  });
  const filled = ex.filter(e => e.sets.some(st => st[1] !== "")).length;
  const keep = d.ex.filter(e => e.n.trim());
  d.ex = keep.concat(ex);
    toast(filled ? `${ex.length} Übungen mit ${filled} ausgefüllten Einträgen übernommen. Prüf die Werte und speichere.` : `${ex.length} Übungen aus dem Plan vorbereitet. Viel Erfolg beim Training!`);
  trDraftSave();
}
