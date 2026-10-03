"use client";
import {useEffect,useRef,useState} from "react";
import type {PDFDocumentProxy,RenderTask} from "pdfjs-dist";
import Image from "next/image";
import {downloadTicketFile,getTicketFile} from "@/lib/ticket-files";
import type {TicketAttachment} from "@/lib/travel-planner";
import {Modal} from "./form-ui";
import {Toast} from "./toast";
import s from "./planner.module.css";

/** Lazily renders one PDF page and releases its render task when the viewer closes. */
function PdfPage({document,page,zoom,fail}:{document:PDFDocumentProxy;page:number;zoom:number;fail:(message:string)=>void}) {
 const canvas=useRef<HTMLCanvasElement>(null);
 const [rendered,setRendered]=useState(false),[visible,setVisible]=useState(false);
 useEffect(()=>{const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:"600px"});if(canvas.current)observer.observe(canvas.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{if(!visible)return;let active=true;let task:RenderTask|undefined;
  void(async()=>{try{const item=await document.getPage(page);if(!active||!canvas.current)return;const base=item.getViewport({scale:1}),viewport=item.getViewport({scale:Math.min(2,1400/base.width)});canvas.current.width=Math.ceil(viewport.width);canvas.current.height=Math.ceil(viewport.height);task=item.render({canvas:canvas.current,viewport});await task.promise;if(active)setRendered(true);}catch(e){if(active)fail(e instanceof Error?e.message:"Could not render this ticket page.");}})();
  return()=>{active=false;task?.cancel();};
 },[document,page,fail,visible]);
 return <canvas ref={canvas} style={{width:`${zoom*100}%`,minHeight:rendered?undefined:400}} data-rendered-page={rendered?page:0} aria-label={`Ticket Page ${page}`}/>;
}
/** Fetches an account-owned original and displays all PDF pages in reading order. */
export function TicketViewer({file,blob:staged,close}:{file:TicketAttachment;blob?:Blob;close:()=>void}){
 const [pdf,setPdf]=useState<PDFDocumentProxy>(),[image,setImage]=useState(""),[error,setError]=useState(""),[zoom,setZoom]=useState(1);
 useEffect(()=>{let active=true,url="";let task:ReturnType<typeof import("pdfjs-dist").getDocument>|undefined;
  void(async()=>{try{const blob=staged??await getTicketFile(file.id);if(!blob)throw new Error("This ticket file is no longer available.");if(file.type!=="application/pdf"){url=URL.createObjectURL(blob);if(active)setImage(url);return;}
   const pdfjs=await import("pdfjs-dist");pdfjs.GlobalWorkerOptions.workerSrc=`/railwatch/pdf.worker.min.mjs?v=${pdfjs.version}`;
   if(!active)return;task=pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer()),disableFontFace:true,useSystemFonts:true});const document=await task.promise;if(active)setPdf(document);
  }catch(e){if(active)setError(e instanceof Error?e.message:"Could not open the ticket.");}})();
  return()=>{active=false;void task?.destroy();if(url)URL.revokeObjectURL(url);};
 },[file.id,file.type,staged]);
 return <Modal title="Ticket" subtitle="Original Ticket" wide close={close}>{error&&<Toast error message={error} dismiss={()=>setError("")}/>}<div className={s.ticketViewer}>{file.type==="application/pdf"?<><nav aria-label="Ticket controls"><span>{pdf?`${pdf.numPages} pages`:"Loading Ticket…"}</span><button className={s.secondary} disabled={zoom<=1} onClick={()=>setZoom(Math.max(1,zoom-.5))} aria-label="Zoom out">−</button><button className={s.secondary} onClick={()=>setZoom(1)}>Fit Width</button><button className={s.secondary} disabled={zoom>=3} onClick={()=>setZoom(Math.min(3,zoom+.5))} aria-label="Zoom in">+</button><button className={s.secondary} onClick={()=>void downloadTicketFile(file,staged).catch(e=>setError(e.message))}>Download</button></nav><div className={s.ticketViewport}><div className={s.pdfPages}>{pdf&&Array.from({length:pdf.numPages},(_,i)=><PdfPage key={i} document={pdf} page={i+1} zoom={zoom} fail={setError}/>)}</div></div></>:image?<Image src={image} alt="Original ticket" width={1400} height={1000} unoptimized/>:<p>Loading Ticket…</p>}</div></Modal>;
}
