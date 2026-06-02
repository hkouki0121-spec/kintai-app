import { GEOFENCE_RADIUS_METERS } from "@/lib/constants";
import { haversineMeters } from "@/lib/geo/haversine";
import { getCurrentPosition } from "@/lib/geo/geolocation";

export type StoreLocation = {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type GeofenceResult =
  | { ok: true; distanceMeters: number }
  | { ok: false; message: string };

async function resolveStoreCoordinates(
  store: StoreLocation
): Promise<{ latitude: number; longitude: number } | null> {
  if (store.latitude != null && store.longitude != null) {
    return { latitude: store.latitude, longitude: store.longitude };
  }

  if (!store.address?.trim()) return null;

  const params = new URLSearchParams({ address: store.address.trim() });
  const response = await fetch(`/api/geo/geocode?${params.toString()}`);
  const payload = (await response.json()) as {
    latitude?: number;
    longitude?: number;
    error?: string;
  };

  if (!response.ok || payload.latitude == null || payload.longitude == null) {
    return null;
  }

  return { latitude: payload.latitude, longitude: payload.longitude };
}

/** 現在地が店舗から50m以内か確認 */
export async function verifyStoreGeofence(store: StoreLocation): Promise<GeofenceResult> {
  const storeCoords = await resolveStoreCoordinates(store);
  if (!storeCoords) {
    return {
      ok: false,
      message: "この店舗の位置情報が未設定です。管理者に店舗座標または住所を設定してもらってください。",
    };
  }

  const current = await getCurrentPosition();
  const distanceMeters = haversineMeters(
    current.latitude,
    current.longitude,
    storeCoords.latitude,
    storeCoords.longitude
  );

  if (distanceMeters > GEOFENCE_RADIUS_METERS) {
    return {
      ok: false,
      message: `店舗から${GEOFENCE_RADIUS_METERS}m以内でのみ打刻できます（現在地: 店舗から約${Math.round(distanceMeters)}m）。`,
    };
  }

  return { ok: true, distanceMeters };
}
