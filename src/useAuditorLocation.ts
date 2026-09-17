import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import * as Location from "expo-location";

export type AuditorLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  mocked: boolean;
};

// Único punto de lectura de GPS con detección de ubicación simulada (Fake GPS):
// en Android, expo-location expone `mocked` cuando la posición viene de un
// proveedor simulado (apps de "GPS falso", modo desarrollador). iOS no expone
// esta señal a apps de terceros, así que ahí el backend se apoya en la geocerca
// y en el rastro continuo de puntos, no solo en este flag.
function toAuditorLocation(position: Location.LocationObject): AuditorLocation {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    mocked: Boolean((position as any).mocked),
  };
}

export async function ensureLocationReady() {
  let services = await Location.hasServicesEnabledAsync();
  if (!services && Platform.OS === "android") {
    try { await Location.enableNetworkProviderAsync(); } catch {}
    services = await Location.hasServicesEnabledAsync();
  }
  if (!services) throw new Error("Activa la ubicación (GPS) del dispositivo para continuar.");
  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== "granted" && permission.canAskAgain) {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (permission.status !== "granted") {
    throw new Error(permission.canAskAgain
      ? "Esta app necesita permiso de ubicación para registrar la visita."
      : "Permiso de ubicación bloqueado. Actívalo en Ajustes.");
  }
}

// Captura puntual de alta precisión, usada al guardar una ficha de visita.
export async function getAuditVisitFix(): Promise<AuditorLocation> {
  await ensureLocationReady();
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
  return toAuditorLocation(position);
}

export function useAuditorLocation(
  api: <T>(path: string, options?: RequestInit) => Promise<T>,
  enabled: boolean,
) {
  const [location, setLocation] = useState<AuditorLocation | null>(null);
  const [error, setError] = useState("");
  const apiRef = useRef(api);

  useEffect(() => { apiRef.current = api; }, [api]);

  useEffect(() => {
    if (!enabled) { setLocation(null); setError(""); return; }
    let active = true;
    let subscription: Location.LocationSubscription | null = null;
    let stateSubscription: { remove: () => void } | null = null;
    let backgroundTimer: ReturnType<typeof setTimeout> | null = null;
    let starting = false;
    let pendingStart = false;
    let lastSent = 0;
    let startGeneration = 0;
    let appState = AppState.currentState;
    const clearBackgroundTimer = () => { if (backgroundTimer) clearTimeout(backgroundTimer); backgroundTimer = null; };
    const stop = () => { subscription?.remove(); subscription = null; };
    const start = async () => {
      if (!active || appState !== "active" || subscription) return;
      if (starting) { pendingStart = true; return; }
      starting = true;
      pendingStart = false;
      const generation = ++startGeneration;
      try {
        await ensureLocationReady();
        if (!active || generation !== startGeneration || appState !== "active") return;
        setError("");
        const cached = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 100 });
        if (active && generation === startGeneration && cached) setLocation(toAuditorLocation(cached));
        const nextSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            mayShowUserSettingsDialog: true,
            timeInterval: 5_000,
            distanceInterval: 0,
          },
          async (position) => {
            if (!active) return;
            const next = toAuditorLocation(position);
            setLocation(next);
            const now = Date.now();
            if (now - lastSent < 7000) return;
            lastSent = now;
            try {
              await apiRef.current("/api/visitas/ubicacion", {
                method: "PATCH",
                body: JSON.stringify({ latitud: next.latitude, longitud: next.longitude, precision: next.accuracy }),
              });
            } catch {
              // El GPS sigue activo aunque falle temporalmente el envío.
            }
          },
        );
        if (!active || generation !== startGeneration) { nextSubscription.remove(); return; }
        subscription = nextSubscription;
      } catch (locationError: any) {
        if (active) setError(locationError.message || "Ubicación no disponible.");
      } finally {
        starting = false;
        if (pendingStart && active && appState === "active" && !subscription) {
          pendingStart = false;
          setTimeout(() => start(), 0);
        }
      }
    };
    start();
    stateSubscription = AppState.addEventListener("change", (state) => {
      const previous = appState;
      appState = state;
      if (state === "active" && previous !== "active") { clearBackgroundTimer(); start(); }
      else if (state === "background") {
        clearBackgroundTimer();
        backgroundTimer = setTimeout(() => {
          if (appState !== "active") { startGeneration += 1; stop(); }
        }, 1500);
      }
    });
    return () => {
      active = false;
      startGeneration += 1;
      clearBackgroundTimer();
      stop();
      stateSubscription?.remove();
    };
  }, [enabled]);
  return { location, error };
}
