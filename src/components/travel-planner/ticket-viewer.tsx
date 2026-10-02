"use client";
import {useEffect,useRef,useState} from "react";
import type {PDFDocumentProxy,RenderTask} from "pdfjs-dist";
import Image from "next/image";
import {getTicketFile} from "@/lib/ticket-files";
import type {TicketAttachment} from "@/lib/travel-planner";
import {Modal} from "./form-ui";
import {Toast} from "./toast";
import s from "./planner.module.css";

/** Fetches an account-owned original and renders PDF pages or an image inside the app. */
export function TicketViewer({file,blob:staged,close}:{file:TicketAttachment;blob?:Blob;close:()=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),pdf=useRef<PDFDocumentProxy>(null),render=useRef<RenderTask>(null);
 const [renderedPage,setRenderedPage]=useState(0),[page,setPage]=useState(1),[pages,setPages]=useState(0),[image,setImage]=useState(""),[error,setError]=useState("");
 useEffect(()=>{let active=true,url="";let task:ReturnType<typeof import("pdfjs-dist").getDocument>|undefined;
  void(async()=>{try{const blob=staged??await getTicketFile(file.id);if(!blob)throw new Error("This ticket file is no longer available.");if(file.type!=="application/pdf"){url=URL.createObjectURL(blob);if(active)setImage(url);return;}
   const pdfjs=await import("pdfjs-dist");pdfjs.GlobalWorkerOptions.workerSrc=`/railwatch/pdf.worker.min.mjs?v=${pdfjs.version}`;
   if(!active)return;task=pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer()),disableFontFace:true,useSystemFonts:true});const document=await task.promise;if(active){pdf.current=document;setPages(document.numPages);}
  }catch(e){if(active)setError(e instanceof Error?e.message:"Could not open the ticket.");}})();
  return()=>{active=false;render.current?.cancel();void task?.destroy();if(url)URL.revokeObjectURL(url);};
 },[file.id,file.type,staged]);
 useEffect(()=>{let active=true;const document=pdf.current;if(!document||!canvas.current)return;void(async()=>{try{const item=await document.getPage(page);if(!active||!canvas.current)return;const base=item.getViewport({scale:1}),viewport=item.getViewport({scale:Math.min(2,1400/base.width)});canvas.current.width=Math.ceil(viewport.width);canvas.current.height=Math.ceil(viewport.height);render.current=item.render({canvas:canvas.current,viewport});await render.current.promise;if(active)setRenderedPage(page);}catch(e){if(active)setError(e instanceof Error?e.message:"Could not render the ticket page.");}})();return()=>{active=false;render.current?.cancel();};},[page,pages]);
 return <Modal title={file.name} subtitle="Original Ticket" wide close={close}>{error&&<Toast error message={error} dismiss={()=>setError("")}/>}<div className={s.ticketViewer}>{file.type==="application/pdf"?<><nav aria-label="Ticket Pages"><button type="button" className={s.secondary} disabled={page<=1} onClick={()=>setPage(page-1)}>Previous</button><span>{pages?`Page ${page} Of ${pages}`:"Loading Ticket…"}</span><button type="button" className={s.secondary} disabled={page>=pages} onClick={()=>setPage(page+1)}>Next</button></nav><canvas ref={canvas} data-rendered-page={renderedPage} aria-label={`Ticket Page ${page}`}/></>:image?<Image src={image} alt="Original ticket" width={1400} height={1000} unoptimized/>:<p>Loading Ticket…</p>}</div></Modal>;
}
