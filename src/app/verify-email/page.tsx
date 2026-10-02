import { VerifyEmail } from "@/components/verify-email";
/** Renders an explicit confirmation step without consuming links on page load. */
export default async function VerifyEmailPage({searchParams}:{searchParams:Promise<{token?:string}>}){const {token}=await searchParams;return <VerifyEmail token={token}/>;}
