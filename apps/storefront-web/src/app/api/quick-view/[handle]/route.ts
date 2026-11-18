import { NextResponse } from "next/server";
import { getQuickViewData } from "@/lib/catalog";

export const revalidate = 60;

/** Product, stores, variants, prices and stock for the quick view; read with the server key. */
export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  if (!handle || handle.length > 200 || handle.includes("/")) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const data = await getQuickViewData(handle);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(data, {
    headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
