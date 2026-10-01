"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/client-api";
import type { Planner } from "@/lib/travel-planner";
import { TravelPlanner } from "./planner";
import s from "./planner.module.css";
export type AccountWorkspace={planner:Planner;revision:number};
export function AccountApp({user}:{user:{id:string;name:string;role:string}}){
  const [data,setData]=useState<AccountWorkspace>();const [error,setError]=useState("");
  useEffect(()=>{let live=true;apiRequest<AccountWorkspace>("/api/railplan/workspace",{cache:"no-store"}).then(value=>{if(live)setData(value);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[]);
  if(error)return <div className={s.loading}><div><h1>Could not load your workspace</h1><p>{error}</p><button onClick={()=>location.reload()}>Try again</button><Link href="/">Sign in</Link></div></div>;
  if(!data)return <div className={s.loading}>Loading your plans…</div>;
  return <TravelPlanner account={{...user,...data}}/>;
}
