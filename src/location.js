import { Geolocation } from '@capacitor/geolocation';

export async function currentPosition() {
  if (!window.Capacitor) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 5000
      });
    });
  }

  await Geolocation.requestPermissions();
  return Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 5000
  });
}

export function normalizePosition(position) {
  const coords = position?.coords || {};
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
    speed: coords.speed || 0,
    recorded_at: new Date().toISOString()
  };
}
