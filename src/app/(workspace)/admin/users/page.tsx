import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export const metadata:Metadata={title:"User Management · RailWatch"};
export default async function Page(){if((await getCurrentUser())?.role!=="ADMIN")redirect("/");return null;}
