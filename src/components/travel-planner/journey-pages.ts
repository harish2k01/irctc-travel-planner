"use client";
import { useEffect,useState } from "react";
import { apiRequest } from "@/lib/client-api";
import type { JourneyPages } from "@/lib/journey-pages";

/** Loads cancellable filtered pages and retains only explicitly requested additional batches. */
export function useJourneyPages(query:string,revision:number,enabled:boolean){
  const [result,setResult]=useState<{key:string;data:JourneyPages}>(),[error,setError]=useState<{key:string;message:string}>(),[epoch,setEpoch]=useState(0),[busy,setBusy]=useState(false);
  const key=query+":"+revision+":"+epoch;
  useEffect(()=>{if(!enabled)return;let live=true;const timer=setTimeout(()=>{void apiRequest<JourneyPages>("/api/railwatch/journeys?"+query,{cache:"no-store"}).then(data=>{if(live){setResult({key,data});setError(undefined);}}).catch(e=>{if(live)setError({key,message:e.message});});},150);return()=>{live=false;clearTimeout(timer);};},[query,key,enabled]);
  const data=result?.key===key?result.data:undefined;
  /** Appends one owned column page and rejects responses for filters that changed mid-request. */
  async function more(column:string){const cursor=data?.pages[column]?.nextCursor;if(!cursor||busy)return;setBusy(true);try{const params=new URLSearchParams(query);params.set("column",column);params.set("cursor",cursor);const next=await apiRequest<JourneyPages>("/api/railwatch/journeys?"+params,{cache:"no-store"});setResult(old=>old?.key===key?{key,data:{...old.data,pages:{...old.data.pages,[column]:{...next.pages[column],items:[...old.data.pages[column].items,...next.pages[column].items]}}}}:old);}catch(e){setError({key,message:e instanceof Error?e.message:"Could not load more journeys."});}finally{setBusy(false);}}
  return {data,error:error?.key===key?error.message:"",pending:enabled&&!data,busy,more,refresh:()=>setEpoch(n=>n+1)};
}
