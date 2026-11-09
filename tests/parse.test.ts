import { describe, expect, it } from "vitest";
import { matchExercise, nameSimilarity, parsePlanText, parseSets } from "../src/ocr/parse";

// Text, wie ihn Tesseract aus einem echten Plan-Screenshot liest
const EMPTY_PLAN = `Maschine Shoulder Press        2       x 8-10
Butterfly-Maschine               2       x 8-10
RDL-Kurzhantel                 2       x 8-10
Brustgestiitzes Rudern           2       x 8-10
Maschine Seitheben             2       x 8-10
Trizeps Pushdown               2       x 8-10
Trizeps Overhead                1        x 8-10

x

x`;

const FILLED = `Day 1 Exercise Sets x Reps Load Notes
Bench Press 1 x 3 80x3 RIR: 1-2
3 x 5 65x5; 65x5; 65x6
Latpull 2 x 8-10 90x9; 90x7
Seitheben 4 x 10-12 53x9; 51x7; 48.5x8; 46x9
Klimmzug 2 x 8-10 BWx10; BWx8
Day 2 Exercise Sets x Reps Load Notes
Deadlift 2 x 3-5 120x3; 120x4 Boden mit den Füßen wegdrücken
Bizeps 3 x 6-8 22,5x9; 22,5x6; 10x9 2x Preacher`;

describe("parseSets", () => {
  it("liest Gewicht und Wiederholungen mit Komma und Körpergewicht", () => {
    expect(parseSets("80x9; 82,5x7; BWx10")).toEqual([[80, 9], [82.5, 7], [0, 10]]);
  });
});

describe("parsePlanText", () => {
  it("liest einen leeren Plan mit Sätzen und Ziel-Wiederholungen", () => {
    const days = parsePlanText(EMPTY_PLAN);
    expect(days).toHaveLength(1);
    expect(days[0].exercises.map((e) => e.name)).toEqual([
      "Maschine Shoulder Press", "Butterfly-Maschine", "RDL-Kurzhantel", "Brustgestützes Rudern",
      "Maschine Seitheben", "Trizeps Pushdown", "Trizeps Overhead",
    ]);
    expect(days[0].exercises[6]).toMatchObject({ plannedSets: 1, targetReps: "8-10", sets: [] });
  });

  it("liest einen ausgefüllten Plan mit mehreren Tagen und Back-off-Zeilen", () => {
    const days = parsePlanText(FILLED);
    expect(days.map((d) => d.label)).toEqual(["Day 1", "Day 2"]);
    const bench = days[0].exercises[0];
    expect(bench.name).toBe("Bench Press");
    expect(bench.plannedSets).toBe(4);
    expect(bench.sets).toEqual([[80, 3], [65, 5], [65, 5], [65, 6]]);
    expect(days[0].exercises[3].sets).toEqual([[0, 10], [0, 8]]);
    expect(days[1].exercises[0]).toMatchObject({ name: "Deadlift", sets: [[120, 3], [120, 4]] });
    expect(days[1].exercises[0].note).toContain("Boden");
    expect(days[1].exercises[1].sets).toEqual([[22.5, 9], [22.5, 6], [10, 9]]);
  });
});

describe("matchExercise", () => {
  const known = ["Butterfly", "Seitheben (Maschine)", "RDL Kurzhantel", "Trizeps Pushdown", "Bench Press", "Latzug"];
  it("findet Schreibvarianten", () => {
    expect(matchExercise("Butterfly-Maschine", known)).toBe("Butterfly");
    expect(matchExercise("Maschine Seitheben", known)).toBe("Seitheben (Maschine)");
    expect(matchExercise("RDL-Kurzhantel", known)).toBe("RDL Kurzhantel");
  });
  it("bevorzugt bei Gleichstand die häufigere Übung", () => {
    expect(matchExercise("Butterfly-Maschine", ["Butterfly", "Latzug", "DB Butterfly (Maschine)"])).toBe("Butterfly");
  });
  it("lässt unbekannte Übungen unverändert", () => {
    expect(matchExercise("Brustgestütztes Rudern", known)).toBe("Brustgestütztes Rudern");
    expect(nameSimilarity("Latpull", "Latzug")).toBeLessThan(0.8);
  });
});
