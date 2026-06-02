const USER_AGENT =
  "kintai-app/1.0 (https://kintai-app-gamma.vercel.app; store geocode)";

export type NominatimSearchResult = {
  lat: string;
  lon: string;
  display_name: string;
};

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  approximate: boolean;
  matchedQuery: string;
  displayName: string;
};

/** 番地・号などを除いたフォールバック用クエリを生成 */
export function buildGeocodeQueries(address: string): string[] {
  const queries: string[] = [];
  const push = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !queries.includes(trimmed)) {
      queries.push(trimmed);
    }
  };

  push(address);

  let current = address.trim();
  const suffixPatterns = [
    /[0-9０-９]+-[0-9０-９]+(-[0-9０-９]+)?$/,
    /[0-9０-９]+番[0-9０-９]+号?$/,
    /[0-9０-９]+号$/,
  ];

  for (const pattern of suffixPatterns) {
    const next = current.replace(pattern, "").trim();
    if (next && next !== current) {
      push(next);
      current = next;
    }
  }

  return queries;
}

async function searchNominatim(
  query: string,
  countrycodes?: string
): Promise<NominatimSearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "1",
    addressdetails: "0",
  });
  if (countrycodes) {
    params.set("countrycodes", countrycodes);
  }

  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Nominatim HTTP ${response.status} for query="${query}"`);
  }

  return (await response.json()) as NominatimSearchResult[];
}

/** OpenStreetMap Nominatim で住所をジオコーディング（番地未登録時は町域までフォールバック） */
export async function geocodeWithNominatim(address: string): Promise<GeocodeResult | null> {
  const queries = buildGeocodeQueries(address);

  for (let index = 0; index < queries.length; index += 1) {
    const query = queries[index];

    for (const countrycodes of ["jp", undefined] as const) {
      try {
        const results = await searchNominatim(query, countrycodes);
        console.info("[geocode] Nominatim response", {
          input: address,
          query,
          countrycodes: countrycodes ?? "none",
          count: results.length,
          displayName: results[0]?.display_name ?? null,
        });

        if (results.length === 0) continue;

        return {
          latitude: Number(results[0].lat),
          longitude: Number(results[0].lon),
          approximate: index > 0,
          matchedQuery: query,
          displayName: results[0].display_name,
        };
      } catch (error) {
        console.error("[geocode] Nominatim request failed", {
          input: address,
          query,
          countrycodes: countrycodes ?? "none",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  console.warn("[geocode] no Nominatim results", { input: address, queries });
  return null;
}
