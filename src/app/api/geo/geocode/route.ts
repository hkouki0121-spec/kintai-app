import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address")?.trim();
  if (!address) {
    return NextResponse.json({ error: "address が必要です" }, { status: 400 });
  }

  const params = new URLSearchParams({
    q: address,
    format: "json",
    limit: "1",
    countrycodes: "jp",
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      "User-Agent": "kintai-app/1.0 (face-clock geofence)",
      Accept: "application/json",
    },
    next: { revalidate: 86400 },
  });

  if (!response.ok) {
    return NextResponse.json({ error: "geocode_failed" }, { status: 502 });
  }

  const results = (await response.json()) as Array<{ lat: string; lon: string }>;
  if (results.length === 0) {
    return NextResponse.json({ error: "geocode_failed" }, { status: 404 });
  }

  return NextResponse.json({
    latitude: Number(results[0].lat),
    longitude: Number(results[0].lon),
  });
}
