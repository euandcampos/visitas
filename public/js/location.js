const ACCURACY_TARGET = 5;
const MAX_WATCH_TIME = 30000;

let bestLocation = null;
let bestAccuracy = Infinity;
let watchId = null;
let stopTimer = null;
let saveSectionsFn = null;

function storeLocation(location) {
  if (!saveSectionsFn || !location) return;
  saveSectionsFn({
    section1: {
      localizacaoVisita: {
        latitude: location.latitude,
        longitude: location.longitude,
        precisao: location.accuracy,
        timestamp: location.timestamp,
        linkMaps: `https://maps.google.com/?q=${location.latitude},${location.longitude}`,
      },
    },
  });
}

function stopWatch() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
}

function handlePosition(position) {
  if (!position?.coords) return;
  const { latitude, longitude, accuracy } = position.coords;
  const timestamp = new Date().toISOString();

  if (accuracy < bestAccuracy) {
    bestAccuracy = accuracy;
    bestLocation = { latitude, longitude, accuracy, timestamp };
    storeLocation(bestLocation);
    if (accuracy <= ACCURACY_TARGET) {
      stopWatch();
    }
  }
}

function handleError(error) {
  console.warn('[gps] erro ao capturar localização', error);
  if (!bestLocation) {
    alert('Não foi possível capturar o GPS. Verifique se a permissão está liberada.');
  }
  stopWatch();
}

export function initLocationManager({ saveSections }) {
  saveSectionsFn = saveSections;
  if (!navigator.geolocation) {
    console.warn('[gps] Geolocation API não disponível.');
    return;
  }

  const options = { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 };

  navigator.geolocation.getCurrentPosition(handlePosition, handleError, options);

  watchId = navigator.geolocation.watchPosition(handlePosition, handleError, options);
  stopTimer = setTimeout(() => {
    stopWatch();
    if (!bestLocation) {
      console.warn('[gps] Nenhuma posição de alta precisão foi obtida.');
    }
  }, MAX_WATCH_TIME);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopWatch();
    }
  });
}

