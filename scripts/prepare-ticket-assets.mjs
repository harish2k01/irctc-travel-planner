import { cp, mkdir } from "node:fs/promises";
await mkdir("public/railplan", { recursive: true });
await cp("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/railplan/pdf.worker.min.mjs");
