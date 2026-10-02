import { ticketOcrText } from "./ticket-pdf-text";

// All recognition assets are served by this instance; ticket pixels stay in the browser.
/** Runs same-origin English OCR locally in the browser and terminates its worker. */
export async function recognizeTicket(canvas:HTMLCanvasElement):Promise<string>{
 const {createWorker}=await import("tesseract.js");
 const worker=await createWorker("eng",1,{workerPath:"/railwatch/ocr/worker.min.js",corePath:"/railwatch/ocr",langPath:"/railwatch/ocr",workerBlobURL:false});
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  await worker.setParameters({preserve_interword_spaces:"1"});
  const result=await Promise.race([worker.recognize(canvas,{}, {text:true,tsv:true}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("Ticket recognition timed out. Enter any missing details manually.")),90000);})]);
  return ticketOcrText(result.data.tsv??"")+"\n"+result.data.text;
 }finally{clearTimeout(timer);await worker.terminate();}
}
