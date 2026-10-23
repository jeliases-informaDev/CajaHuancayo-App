// Versión SOLO PARA PRUEBAS EN NAVEGADOR (el APK nunca la carga): no hay seguimiento en segundo plano, pero el botón
// de la jornada sí avisa al servidor, de modo que se puede probar la pantalla y el flujo contra el panel.
import { cacheGet, cacheSet } from "./offlineSync";
import type { ZonaJornada } from "./types/jornada";

export const JORNADA_TASK = "ch-jornada-ubicacion";
export const jornadaDisponible = true;
const CLAVE_INICIO = "jornada_inicio_local";
const CLAVE_FIN_PENDIENTE = "jornada_fin_pendiente";
const CLAVE_ZONA = "jornada_zona";

export async function jornadaEnCurso(): Promise<boolean> { return Boolean((await cacheGet<string>(CLAVE_INICIO))?.value); }
export async function inicioDeJornada(): Promise<string | null> { return (await cacheGet<string>(CLAVE_INICIO))?.value || null; }
// En el navegador solo hay posición (sin nombres de zona): sirve para probar el flujo completo contra el servidor.
function posicionDelNavegador(): Promise<ZonaJornada> {
  return new Promise((resolver) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolver({});
    navigator.geolocation.getCurrentPosition(
      // `ch_zona_prueba` (solo en el navegador): los nombres de zona que un celular obtendría con su servicio de nombres, para poder probar esa parte.
      (p) => { let nombres = {}; try { nombres = JSON.parse(localStorage.getItem("ch_zona_prueba") || "{}") || {}; } catch {} resolver({ latitud: p.coords.latitude, longitud: p.coords.longitude, precision: p.coords.accuracy, ...nombres }); },
      () => resolver({}), { timeout: 5000, maximumAge: 60_000 }, // acepta una posición de hasta 1 min: el simulador de ubicación de las pruebas solo entrega la que ya tiene guardada
    );
  });
}
export async function zonaDeLaJornada(): Promise<string | null> { return (await cacheGet<string>(CLAVE_ZONA))?.value || null; }
export async function iniciarJornada(avisarServidor: (zona?: ZonaJornada) => Promise<unknown>): Promise<void> {
  const respuesta: any = await avisarServidor(await posicionDelNavegador());
  await cacheSet(CLAVE_ZONA, respuesta?.data?.zona ?? null);
  await cacheSet(CLAVE_INICIO, new Date().toISOString());
  await cacheSet(CLAVE_FIN_PENDIENTE, null);
}
export async function terminarJornada(avisarServidor?: () => Promise<unknown>): Promise<boolean> {
  await cacheSet(CLAVE_INICIO, null);
  await cacheSet(CLAVE_ZONA, null);
  if (!avisarServidor) return true;
  try { await avisarServidor(); await cacheSet(CLAVE_FIN_PENDIENTE, null); return true; } catch { await cacheSet(CLAVE_FIN_PENDIENTE, true); return false; }
}
export async function reintentarFinPendiente(avisarServidor: () => Promise<unknown>): Promise<void> {
  if (!(await cacheGet<boolean>(CLAVE_FIN_PENDIENTE))?.value) return;
  try { await avisarServidor(); await cacheSet(CLAVE_FIN_PENDIENTE, null); } catch { /* se reintenta la próxima vez */ }
}
