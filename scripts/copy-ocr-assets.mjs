// Kopiert Worker, WebAssembly-Kern und Sprachdaten von Tesseract nach public/ocr,
// damit die Texterkennung ohne fremde CDNs läuft und Bilder das Gerät nie verlassen.
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const out = "public/ocr";
mkdirSync(join(out, "core"), { recursive: true });
mkdirSync(join(out, "lang"), { recursive: true });

const tess = dirname(require.resolve("tesseract.js/package.json"));
cpSync(join(tess, "dist/worker.min.js"), join(out, "worker.min.js"));

const core = dirname(require.resolve("tesseract.js-core/package.json"));
for (const f of ["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"]) cpSync(join(core, f), join(out, "core", f));

for (const lang of ["deu", "eng"]) {
  const dir = dirname(require.resolve(`@tesseract.js-data/${lang}/package.json`));
  const src = join(dir, "4.0.0_best_int", `${lang}.traineddata.gz`);
  if (!existsSync(src)) throw new Error("Sprachdaten fehlen: " + src);
  cpSync(src, join(out, "lang", `${lang}.traineddata.gz`));
}
console.log("OCR-Dateien nach", out, "kopiert");
