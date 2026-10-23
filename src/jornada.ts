// Jornada de campo: mientras está iniciada, la app sigue enviando la ubicación del auditor al servidor aunque la
// pantalla esté apagada o esté usando Google Maps para navegar. Android obliga a mostrar una notificación fija
// durante ese tiempo (servicio en primer plano), así el auditor siempre sabe que se está compartiendo.
// Solo se comparte entre «Iniciar jornada» y «Terminar jornada»; fuera de ella no se envía nada en segundo plano.
import { Platform } from "react-native";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import { API_URL } from "./api";
import { getDeviceId } from "./deviceIdentity";
import { cacheGet, cacheSet } from "./offlineSync";
import { estadoBateria } from "./bateria";
import type { ZonaJornada } from "./types/jornada";

export const JORNADA_TASK = "ch-jornada-ubicacion";
const TOKEN_KEY = "ch_token";
const CLAVE_INICIO = "jornada_inicio_local";
const CLAVE_FIN_PENDIENTE = "jornada_fin_pendiente"; // se terminó en el celular pero el servidor aún no lo sabe (sin señal)
const CLAVE_ZONA = "jornada_zona"; // la zona de trabajo con la que el servidor registró el inicio (para mostrarla mientras dure la jornada)
export const jornadaDisponible = Platform.OS === "android" || Platform.OS === "ios";

// Se define al cargar el módulo (index.ts lo importa) para que Android pueda ejecutarla aunque la app esté cerrada.
TaskManager.defineTask(JORNADA_TASK, async ({ data, error }: any) => {
  if (error || !data) return;
  const locations: Location.LocationObject[] = data.locations || [];
  const ultimo = locations[locations.length - 1];
  if (!ultimo) return;
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) { await detenerSeguimiento(); return; } // sin sesión no hay a quién enviar
    const deviceId = await getDeviceId();
    const control = new AbortController();
    const espera = setTimeout(() => control.abort(), 15_000);
    try {
      const respuesta = await fetch(`${API_URL}/api/visitas/ubicacion`, {
        method: "PATCH",
        signal: control.signal,
        headers: { Accept: "application/json", "Content-Type": "application/json", "x-client-platform": "mobile", "x-device-id": deviceId, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ latitud: ultimo.coords.latitude, longitud: ultimo.coords.longitude, precision: ultimo.coords.accuracy, simulada: Boolean((ultimo as any).mocked), ...(await estadoBateria()) }),
      });
      // Sesión cerrada o revocada: se apaga el servicio para no seguir con la notificación sin enviar nada.
      if (respuesta.status === 401 || respuesta.status === 403) await detenerSeguimiento();
    } finally { clearTimeout(espera); }
  } catch {
    // Sin señal: el siguiente punto lo reintenta; el recorrido del día se arma con los que sí llegaron.
  }
});

async function detenerSeguimiento() {
  try { if (await Location.hasStartedLocationUpdatesAsync(JORNADA_TASK)) await Location.stopLocationUpdatesAsync(JORNADA_TASK); } catch {}
}

export async function jornadaEnCurso(): Promise<boolean> {
  try { return await Location.hasStartedLocationUpdatesAsync(JORNADA_TASK); } catch { return false; }
}

export async function inicioDeJornada(): Promise<string | null> {
  const guardado = await cacheGet<string>(CLAVE_INICIO);
  return guardado?.value || null;
}

// Espera a lo más `ms` milisegundos: si se pasa (o falla) devuelve null. La jornada no debe quedar colgada de un GPS o de un servicio de nombres lentos.
function conLimite<T>(promesa: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolver) => {
    const t = setTimeout(() => resolver(null), ms);
    promesa.then((v) => { clearTimeout(t); resolver(v); }, () => { clearTimeout(t); resolver(null); });
  });
}

// La zona de trabajo se toma al iniciar la jornada: la posición de ese momento y, si el celular lo logra, el distrito, la provincia y el departamento
// (con el servicio de nombres del propio teléfono). Si algo falla la jornada igual empieza y el servidor guarda lo que llegue.
async function zonaActual(): Promise<ZonaJornada> {
  const posicion = (await conLimite(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 10_000))
    ?? (await conLimite(Location.getLastKnownPositionAsync({ maxAge: 120_000 }), 2_000));
  if (!posicion) return {};
  const zona: ZonaJornada = {
    latitud: posicion.coords.latitude, longitud: posicion.coords.longitude,
    precision: posicion.coords.accuracy ?? undefined, simulada: Boolean((posicion as any).mocked),
  };
  const lugares = await conLimite(Location.reverseGeocodeAsync({ latitude: posicion.coords.latitude, longitude: posicion.coords.longitude }), 5_000);
  const lugar = lugares?.[0];
  if (lugar) {
    zona.distrito = lugar.district || lugar.city || undefined;
    zona.provincia = lugar.subregion || undefined;
    zona.departamento = lugar.region || undefined;
  }
  return zona;
}

export async function zonaDeLaJornada(): Promise<string | null> {
  return (await cacheGet<string>(CLAVE_ZONA))?.value || null;
}

export async function iniciarJornada(avisarServidor: (zona?: ZonaJornada) => Promise<unknown>): Promise<void> {
  const servicios = await Location.hasServicesEnabledAsync();
  if (!servicios) throw new Error("Activa la ubicación (GPS) del dispositivo para iniciar tu jornada.");
  let primer = await Location.getForegroundPermissionsAsync();
  if (primer.status !== "granted") primer = await Location.requestForegroundPermissionsAsync();
  if (primer.status !== "granted") throw new Error("Necesitamos el permiso de ubicación para iniciar tu jornada.");
  let segundo = await Location.getBackgroundPermissionsAsync();
  if (segundo.status !== "granted") segundo = await Location.requestBackgroundPermissionsAsync();
  if (segundo.status !== "granted") {
    throw new Error("Para seguirte con la pantalla apagada o mientras navegas, elige «Permitir todo el tiempo» en los permisos de ubicación de la app.");
  }
  // Primero se toma la zona y se avisa al servidor (así el supervisor ya sabe que sales y desde dónde) y solo entonces se enciende el seguimiento:
  // si no hay conexión, la jornada no queda a medias.
  const respuesta: any = await avisarServidor(await zonaActual());
  await cacheSet(CLAVE_ZONA, respuesta?.data?.zona ?? null);
  await Location.startLocationUpdatesAsync(JORNADA_TASK, {
    accuracy: Location.Accuracy.High,
    // Una posición cada 15 s aunque el auditor esté quieto (en una visita, por ejemplo): con una distancia mínima no llegaría ninguna y el
    // supervisor lo vería como «sin señal». Así también se puede saber desde cuándo está detenido.
    timeInterval: 15_000,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Jornada de campo en curso",
      notificationBody: "Tu supervisor ve tu ubicación en tiempo real hasta que termines la jornada.",
      notificationColor: "#2d41c4",
    },
  });
  await cacheSet(CLAVE_INICIO, new Date().toISOString());
  await cacheSet(CLAVE_FIN_PENDIENTE, null);
}

// Apaga el seguimiento en el celular SIEMPRE y avisa al servidor; si no hay señal, el aviso queda pendiente y se reintenta al volver a abrir la app.
// Devuelve false si el servidor aún no se enteró.
export async function terminarJornada(avisarServidor?: () => Promise<unknown>): Promise<boolean> {
  await detenerSeguimiento();
  await cacheSet(CLAVE_INICIO, null);
  await cacheSet(CLAVE_ZONA, null);
  if (!avisarServidor) return true;
  try { await avisarServidor(); await cacheSet(CLAVE_FIN_PENDIENTE, null); return true; } catch { await cacheSet(CLAVE_FIN_PENDIENTE, true); return false; }
}

export async function reintentarFinPendiente(avisarServidor: () => Promise<unknown>): Promise<void> {
  if (!(await cacheGet<boolean>(CLAVE_FIN_PENDIENTE))?.value) return;
  try { await avisarServidor(); await cacheSet(CLAVE_FIN_PENDIENTE, null); } catch { /* se reintenta la próxima vez */ }
}
