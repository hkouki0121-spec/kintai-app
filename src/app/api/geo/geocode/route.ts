import { NextResponse } from "next/server";
import { geocodeWithNominatim } from "@/lib/geo/nominatim";

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address")?.trim();
  if (!address) {
    return NextResponse.json({ error: "address が必要です" }, { status: 400 });
  }

  console.info("[geocode] request", { address });

  try {
    const result = await geocodeWithNominatim(address);
    if (!result) {
      console.warn("[geocode] failed", { address });
      return NextResponse.json({ error: "geocode_failed" }, { status: 404 });
    }

    console.info("[geocode] success", {
      address,
      latitude: result.latitude,
      longitude: result.longitude,
      approximate: result.approximate,
      matchedQuery: result.matchedQuery,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[geocode] unexpected error", {
      address,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "geocode_failed" }, { status: 502 });
  }
}
