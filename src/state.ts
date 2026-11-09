// @ts-nocheck
// Bewusst ohne Imports, damit es keine zirkulären Abhängigkeiten beim Laden gibt.
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };


// ---------- state ----------
export const S = { habits: [], days: {}, monk: { run: null, history: [], alts: null, log: [] }, calm: { sessions: [], settings: {} }, train: { sess: [], cfg: {} }, loaded: false };

export const ui: any = {
  view: "heute",
  cur: todayKey(),
  statSel: "all",
  statYear: new Date().getFullYear(),
  editing: null,
  confirmDel: null,
  imp: null,
  heatInfo: null,
  trImp: null,
  impErr: "",
  mState: { count: 0, yPending: false },
  monkSetup: null,
  monkConfirm: null,
  monkNote: "",
  monkFlash: null,
  trEdit: null,
  trEx: null,
  trMore: false,
  trMetric: "auto",
  shotOK: true,
  shot: null,
  sess: null,
  sessRaf: null,
  sessInt: null,
  wakeLock: null,
  sos: null,
  sosInt: null,
  noteT: null,
  lastToday: todayKey(),
};
