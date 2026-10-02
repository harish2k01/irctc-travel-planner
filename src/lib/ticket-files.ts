import { attachmentSchema, type TicketAttachment } from "./travel-planner";
import { parseTicketDetails, type TicketDetails } from "./ticket-details";

async function fileRequest(id:string,init?:RequestInit){const response=await fetch(`/api/railwatch/files/${encodeURIComponent(id)}`,init);if(!response.ok){const value=await response.json().catch(()=>({}));throw new Error(value.error?.message??"Ticket storage request failed.");}return response;}
export async function saveTicketFile(id: string, blob: Blob, name?:string) { {await fileRequest(id,{method:"PUT",headers:{"Content-Type":blob.type,"X-File-Name":encodeURIComponent(name??(blob instanceof File?blob.name:"ticket"))},body:blob});return;} }
export async function getTicketFile(id: string): Promise<Blob | undefined> { {const response=await fetch(`/api/railwatch/files/${encodeURIComponent(id)}`,{cache:"no-store"});if(response.status===404)return undefined;if(!response.ok)throw new Error("Could not retrieve this ticket file.");return response.blob();} }
export async function deleteTicketFile(id: string) { {await fileRequest(id,{method:"DELETE"});return;} }
export function validateTicketFile(file:File):TicketAttachment {return attachmentSchema.parse({id:crypto.randomUUID(),name:file.name,type:file.type,size:file.size,createdAt:new Date().toISOString()});}
export async function downloadTicketFile(attachment: TicketAttachment, staged?: Blob) {
  const blob = staged ?? await getTicketFile(attachment.id); if (!blob) throw new Error("The original file is missing from your account. Upload it again, or restore a backup that includes files.");
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = attachment.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function decodeCanvas(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) return "";
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const { default: jsQR } = await import("jsqr"); return jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: "attemptBoth" })?.data ?? "";
}
export async function extractTicketFile(file: File): Promise<{ details: TicketDetails; message: string }> {
  if (file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `/railplan/pdf.worker.min.mjs?v=${pdfjs.version}`;
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), disableFontFace: true, useSystemFonts: true });
    const document = await task.promise; let text = "", qr = "";
    try {
      for (let number = 1; number <= Math.min(document.numPages, 10); number++) {
        const page = await document.getPage(number); const content = await page.getTextContent();
        let previousY: number | undefined;
        for (const item of content.items) if ("str" in item) { const y = item.transform[5]; if (previousY !== undefined && Math.abs(y - previousY) > 3) text += "\n"; text += `${item.str}${item.hasEOL ? "\n" : " "}`; previousY = y; }
        text += "\n";
        if (number <= 3 && !qr) {
          const base = page.getViewport({ scale: 1 }); const scale = Math.min(2, 1800 / base.width, 2500 / base.height);
          const viewport = page.getViewport({ scale }); const canvas = window.document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
          try { await page.render({ canvas, viewport }).promise; qr = await decodeCanvas(canvas); } catch { /* Text suggestions remain usable if rendering fails. */ }
        }
        page.cleanup();
      }
    } finally { await task.destroy(); }
    const details = { ...parseTicketDetails(text), ...parseTicketDetails(qr) };
    return { details, message: Object.keys(details).length ? "Detected details are suggestions. Check them against the ticket before applying." : "No recognizable details found. You can keep this file and enter the ticket details manually. Scanned PDFs without readable QR codes need manual entry." };
  }
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 40000000) throw new Error("This image is too large to decode. Use a cropped QR image.");
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height)); const canvas = document.createElement("canvas"); canvas.width = Math.ceil(bitmap.width * scale); canvas.height = Math.ceil(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const qr = await decodeCanvas(canvas); const details = parseTicketDetails(qr);
    return { details, message: Object.keys(details).length ? "Readable QR details detected. Review before applying." : qr ? "The QR payload is not recognizable ticket data (it may be encrypted). File can still be saved; use manual entry." : "No readable QR found. Upload a clear cropped QR image, or enter the details manually." };
  } finally { bitmap.close(); }
}
export async function exportTicketBackup(planner: import("./travel-planner").Planner) {
  const attachmentFiles: { id: string; data: string }[] = []; let size = 0;
  const ids = new Set<string>();
  for (const journey of planner.journeys) for (const file of journey.attachments ?? []) {
    if (ids.has(file.id)) continue; ids.add(file.id); const blob = await getTicketFile(file.id); if (!blob) continue;
    size += blob.size; if (size > 50000000) throw new Error("Attachments exceed the 50 MB backup limit. Download originals separately from Ticket vault.");
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); }); attachmentFiles.push({ id: file.id, data });
  }
  return JSON.stringify({ ...planner, attachmentFiles });
}

export function decodeBackupFiles(value: unknown, planner: import("./travel-planner").Planner): { id: string; blob: Blob }[] {
  const embedded = (value as { attachmentFiles?: unknown }).attachmentFiles;
  if (embedded === undefined) return [];
  if (!Array.isArray(embedded) || embedded.length > 2000) throw new Error("Invalid backup attachments.");
  const metadata = new Map(planner.journeys.flatMap(j => j.attachments ?? []).map(f => [f.id, f]));
  const ids = new Set<string>(); let total = 0;
  return embedded.map(item => {
    if (!item || typeof item.id !== "string" || typeof item.data !== "string" || ids.has(item.id)) throw new Error("Invalid backup file.");
    ids.add(item.id); const meta = metadata.get(item.id);
    if (!meta || !item.data.startsWith(`data:${meta.type};base64,`)) throw new Error("Backup file does not match its metadata.");
    const bytes = Uint8Array.from(atob(item.data.split(",")[1]), c => c.charCodeAt(0)); total += bytes.length;
    if (bytes.length !== meta.size || total > 50000000) throw new Error("Invalid backup file size.");
    return { id: item.id, blob: new Blob([bytes], { type: meta.type }) };
  });
}
