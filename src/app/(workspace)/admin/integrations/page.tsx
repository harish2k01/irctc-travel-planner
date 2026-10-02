import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export const metadata:Metadata={title:"Integrations · RailWatch"};
export default async function Page(){if((await getCurrentUser())?.role!=="ADMIN")redirect("/");return null;}
