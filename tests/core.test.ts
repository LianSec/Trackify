// @ts-nocheck – die Kernmodule sind noch nicht vollständig typisiert
import { beforeEach, describe, expect, it } from "vitest";
import { S } from "../src/state";
import { addDays, todayKey } from "../src/lib/util";
import { habitStats, invalidate } from "../src/domain/habits";
import { monkEvaluate } from "../src/features/monk";
import { parseCSV, parseDate } from "../src/features/import";
import { e1rm, autoMetric } from "../src/features/training";

const t = todayKey();
const day = (n: number) => addDays(t, n);

beforeEach(() => {
  S.habits = []; S.days = {}; S.monk = { run: null, history: [], alts: null, log: [] };
  invalidate();
});

describe("Serien im Habit Tracker", () => {
  it("zählt die aktuelle Serie und überspringt ausgesetzte Tage", () => {
    const h = { id: "h", name: "Lesen", type: "check", days: [0, 1, 2, 3, 4, 5, 6], created: day(-10) };
    S.habits = [h];
    for (let i = -10; i <= -1; i++) S.days[day(i)] = { h: 1 };
    S.days[day(-4)] = { h: "s" };   // ausgesetzt: bricht nichts
    S.days[day(-8)] = {};           // verpasst: bricht die Serie
    delete S.days[day(-8)];
    const s = habitStats(h);
    expect(s.cur).toBe(6);          // -7 … -1 ohne den ausgesetzten Tag
    expect(s.best).toBe(6);
  });

  it("wertet Zahl-Gewohnheiten erst ab dem Ziel als erledigt", () => {
    const h = { id: "m", name: "Meditation", type: "number", target: 3, days: [0, 1, 2, 3, 4, 5, 6], created: day(-2) };
    S.habits = [h];
    S.days[day(-2)] = { m: 3 }; S.days[day(-1)] = { m: 2.5 };
    expect(habitStats(h).cur).toBe(0);
  });
});

describe("Monk Mode", () => {
  const rules = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
  const full = { a: 1, b: 1 };

  it("setzt bei einem unvollständigen Tag auf 0 zurück und merkt sich den Versuch", () => {
    S.monk.run = { id: "x", goal: 30, start: day(-6), streakStart: day(-6), rules, days: {}, urges: {}, attempts: [], best: 0, status: "active" };
    for (const n of [-6, -5, -4]) S.monk.run.days[day(n)] = full;
    S.monk.run.days[day(-3)] = { a: 1 };            // nicht alles abgehakt
    S.monk.run.days[day(-2)] = full;
    const r = monkEvaluate();
    expect(S.monk.run.attempts).toEqual([{ from: day(-6), to: day(-3), reached: 3 }]);
    expect(S.monk.run.streakStart).toBe(day(-2));
    expect(r.count).toBe(1);
    expect(r.yPending).toBe(true);                    // gestern darf noch nachgetragen werden
  });

  it("ist geschafft, wenn das Ziel erreicht ist", () => {
    S.monk.run = { id: "x", goal: 3, start: day(-3), streakStart: day(-3), rules, days: {}, urges: {}, attempts: [], best: 0, status: "active" };
    for (const n of [-3, -2, -1]) S.monk.run.days[day(n)] = full;
    monkEvaluate();
    expect(S.monk.run.status).toBe("done");
  });
});

describe("Notion-Import", () => {
  it("liest deutsche, englische und ISO-Datumsangaben", () => {
    expect(parseDate("26. November 2022", "mdy")).toBe("2022-11-26");
    expect(parseDate("November 5, 2026", "mdy")).toBe("2026-11-05");
    expect(parseDate("03/04/2025", "dmy")).toBe("2025-04-03");
    expect(parseDate("2026-11-05", "mdy")).toBe("2026-11-05");
  });
  it("liest CSV mit Anführungszeichen und Zeilenumbrüchen", () => {
    const rows = parseCSV('﻿a,b\n"x, y","mit\nUmbruch"\n');
    expect(rows).toEqual([["a", "b"], ["x, y", "mit\nUmbruch"]]);
  });
});

describe("Training", () => {
  it("schätzt das 1RM nach Epley", () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(143, 20)).toBeCloseTo(238.33, 1);
  });
  it("empfiehlt bei hohen Wiederholungen Gewicht × Wdh.", () => {
    const hi = [12, 15, 20].map((r, i) => ({ k: "2026-01-0" + (i + 1), topR: r, bw: false }));
    const lo = [5, 6, 8].map((r, i) => ({ k: "2026-01-0" + (i + 1), topR: r, bw: false }));
    expect(autoMetric(hi)).toBe("vol");
    expect(autoMetric(lo)).toBe("e1rm");
  });
});
