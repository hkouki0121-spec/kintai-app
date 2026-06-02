export type GeoPosition = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export function getCurrentPosition(timeoutMs = 10000): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("位置情報の利用が許可されていません。ブラウザの設定で位置情報を許可してください。"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error("位置情報の利用が許可されていません。ブラウザの設定で位置情報を許可してください。"));
          return;
        }
        reject(new Error("位置情報を取得できませんでした。GPSを有効にしてもう一度お試しください。"));
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}
