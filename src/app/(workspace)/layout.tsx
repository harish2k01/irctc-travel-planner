import { redirect } from "next/navigation";
import { Manrope } from "next/font/google";
import { getSessionState } from "@/lib/backend-client";

import { AccountApp } from "@/components/travel-planner/account-app";
const font=Manrope({subsets:["latin"],variable:"--font-railplan",display:"swap"});
export const dynamic="force-dynamic";
export default async function Layout({children}:{children:React.ReactNode}){const {user,policy}=await getSessionState();if(!user||user.mustResetPassword)redirect("/login");return <div className={font.variable}><AccountApp user={{id:user.id,name:user.name??user.email,email:user.email,phoneNumber:user.phoneNumber,role:user.role,policy}}/>{children}</div>;}
