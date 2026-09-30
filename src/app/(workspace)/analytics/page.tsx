import { redirect } from "next/navigation";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const trip = typeof params.trip === "string" ? params.trip : typeof params.ticket === "string" ? params.ticket : undefined;
  redirect("/today" + (trip ? "?trip=" + encodeURIComponent(trip) : ""));
}
