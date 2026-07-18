import { AuthScreen } from "@/components/auth-screen";

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; type?: string }> }) {
  const { token, type } = await searchParams;
  return (
    <AuthScreen
      mode="tokenPassword"
      allowSignups={false}
      token={token}
      tokenType={type === "invitation" ? "invitation" : "reset"}
    />
  );
}
