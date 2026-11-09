import type { Worker } from "tesseract.js";

let worker: Promise<Worker> | null = null;

/** Lädt Tesseract beim ersten Aufruf aus den eigenen Dateien unter /ocr (kein CDN). */
function getWorker(onProgress?: (p: number) => void): Promise<Worker> {
  if (!worker) {
    const base = import.meta.env.BASE_URL + "ocr/";
    worker = (async () => {
      const { createWorker } = await import("tesseract.js");
      const w = await createWorker(["deu", "eng"], 1, {
        workerPath: base + "worker.min.js",
        corePath: base + "core/",
        langPath: base + "lang",
        gzip: true,
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text" && onProgress) onProgress(m.progress);
        },
      });
      await w.setParameters({ preserve_interword_spaces: "1", tessedit_pageseg_mode: "6" as never });
      return w;
    })();
    worker.catch(() => {
      worker = null;
    });
  }
  return worker;
}

/** Erkennt den Text eines Bildes direkt im Browser. */
export async function recognizeImage(file: Blob, onProgress?: (p: number) => void): Promise<string> {
  const w = await getWorker(onProgress);
  const { data } = await w.recognize(file);
  return data.text;
}
