/** Ein Satz: [Gewicht in kg, Wiederholungen]. Körpergewicht = 0 kg. */
export type SetEntry = [number, number];

export interface PlanExercise {
  name: string;
  plannedSets: number;
  targetReps: string;
  sets: SetEntry[];
  note: string;
}

export interface PlanDay {
  label: string;
  exercises: PlanExercise[];
}

const SET_RE = /(BW|KG|\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)/g;
const ROW_RE = /^(.*?)\s*\b(\d{1,2})\s*[xX×]\s*(\d{1,2}(?:\s*[-–]\s*\d{1,2})?)(?![\d.,]*\s*[xX×])(.*)$/;
const DAY_RE = /\b(?:Day|Tag)\s*(\d+)\b/i;

/** Behebt typische Lesefehler der Texterkennung in Übungsnamen. */
export function cleanName(raw: string): string {
  return raw
    .replace(/[|_]+/g, " ")
    .replace(/ii/g, "ü")
    .replace(/\s{2,}/g, " ")
    .replace(/^[^A-Za-zÄÖÜäöüß0-9(]+|[^A-Za-zÄÖÜäöüß0-9)]+$/g, "")
    .trim();
}

/** Liest Sätze wie "80x9; 82,5x7; BWx10" aus einem Text. */
export function parseSets(text: string): SetEntry[] {
  const out: SetEntry[] = [];
  for (const m of text.matchAll(SET_RE)) {
    const w = /^(BW|KG)$/i.test(m[1]) ? 0 : Number(m[1].replace(",", "."));
    const r = Math.round(Number(m[2].replace(",", ".")));
    if (Number.isFinite(w) && r > 0 && r < 200) out.push([w, r]);
  }
  return out;
}

/**
 * Wandelt den Text eines Trainingsplan-Screenshots (Spalten Exercise, Sets, x, Reps, Load, Notes)
 * in Tage mit Übungen um. Zeilen ohne Übungsnamen, aber mit Sets, gehören zur Übung darüber.
 */
export function parsePlanText(text: string): PlanDay[] {
  const days: PlanDay[] = [];
  let day: PlanDay | null = null;
  let last: PlanExercise | null = null;
  const ensureDay = (): PlanDay => {
    if (!day) {
      day = { label: "", exercises: [] };
      days.push(day);
    }
    return day;
  };
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || /^[xX×]$/.test(line)) continue;
    const dm = line.match(DAY_RE);
    if (dm) {
      day = { label: `Day ${dm[1]}`, exercises: [] };
      days.push(day);
      last = null;
      line = line.replace(DAY_RE, "").trim();
    }
    if (/\bexer[cs]i[cs]e\b/i.test(line) && /\bsets\b/i.test(line)) continue;
    const m = line.match(ROW_RE);
    if (!m) continue;
    const name = cleanName(m[1]);
    const rest = m[4] ?? "";
    const sets = parseSets(rest);
    const note = rest.replace(SET_RE, " ").replace(/[;,:]/g, " ").replace(/\s{2,}/g, " ").trim();
    const planned = Number(m[2]);
    const target = m[3].replace(/\s+/g, "").replace("–", "-");
    if (!name && last) {
      last.plannedSets += planned;
      last.sets.push(...sets);
      continue;
    }
    if (!name) continue;
    last = { name, plannedSets: planned, targetReps: target, sets, note };
    ensureDay().exercises.push(last);
  }
  return days.filter((d) => d.exercises.length);
}

const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .replace(/machine/g, "maschine")
    .replace(/[^a-z0-9 ]+/g, " ")
    .trim();

const EQUIP_WORDS = new Set(["maschine", "kabel", "cable", "kurzhantel", "langhantel", "db", "smith", "stange", "seil", "geführt"]);

const tokens = (s: string): Set<string> => new Set(norm(s).split(/\s+/).filter(Boolean));

function bigrams(s: string): string[] {
  const t = norm(s).replace(/\s+/g, "");
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

/** Ähnlichkeit zweier Übungsnamen zwischen 0 und 1. */
export function nameSimilarity(a: string, b: string): number {
  const ta = tokens(a), tb = tokens(b);
  const inter = [...ta].filter((x) => tb.has(x)).length;
  const jacc = inter / Math.max(1, new Set([...ta, ...tb]).size);
  const ba = bigrams(a), bb = bigrams(b);
  const pool = [...bb];
  let hit = 0;
  for (const g of ba) {
    const i = pool.indexOf(g);
    if (i >= 0) {
      hit++;
      pool.splice(i, 1);
    }
  }
  const dice = (2 * hit) / Math.max(1, ba.length + bb.length);
  // "Butterfly-Maschine" soll zu "Butterfly" passen: ein Name steckt komplett im anderen
  const na = norm(a).replace(/\s+/g, ""), nb = norm(b).replace(/\s+/g, "");
  const short = na.length < nb.length ? na : nb, long = na.length < nb.length ? nb : na;
  const contains = short.length >= 6 && long.includes(short) ? 0.82 : 0;
  // Gleiche Übung, nur mit Gerätezusatz ("Maschine Seitheben" ↔ "Seitheben (Maschine)")
  const core = (x: string) => [...tokens(x)].filter((t) => !EQUIP_WORDS.has(t)).sort().join(" ");
  const sameCore = core(a) && core(a) === core(b) ? 0.95 : 0;
  return Math.max(jacc, dice, contains, sameCore);
}

/**
 * Ordnet einen erkannten Namen der passenden bekannten Übung zu.
 * `known` ist nach Häufigkeit sortiert: Liegen mehrere Kandidaten fast gleichauf,
 * gewinnt die häufigere Übung ("Butterfly-Maschine" → "Butterfly" statt "DB Butterfly (Maschine)").
 */
export function matchExercise(name: string, known: readonly string[], threshold = 0.8, margin = 0.04): string {
  const scored = known.map((k, i) => ({ k, i, s: nameSimilarity(name, k) }));
  const best = Math.max(0, ...scored.map((x) => x.s));
  if (best < threshold) return name;
  const pick = scored.filter((x) => x.s >= best - margin).sort((a, b) => a.i - b.i)[0];
  return pick ? pick.k : name;
}
