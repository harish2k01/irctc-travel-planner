import { redirect } from "next/navigation";
import { Manrope } from "next/font/google";
import { getCurrentUser } from "@/lib/auth";
import { AccountApp } from "@/components/travel-planner/account-app";
const font=Manrope({subsets:["latin"],variable:"--font-railplan",display:"swap"});
export const dynamic="force-dynamic";
export default async function Page(){const user=await getCurrentUser();if(!user||user.mustResetPassword)redirect("/");return <div className={font.variable}><AccountApp user={{id:user.id,name:user.name??user.email,role:user.role}}/></div>;}
