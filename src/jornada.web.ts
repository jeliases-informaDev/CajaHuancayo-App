// Versión SOLO PARA PRUEBAS EN NAVEGADOR (el APK nunca la carga): no hay seguimiento en segundo plano, pero el botón
// de la jornada sí avisa al servidor, de modo que se puede probar la pantalla y el flujo contra el panel.
import { cacheGet, cacheSet } from "./offlineSync";

export const JORNADA_TASK = "ch-jornada-ubicacion";
export const jornadaDisponible = true;
const CLAVE_INICIO = "jornada_inicio_local";
const CLAVE_FIN_PENDIENTE = "jornada_fin_pendiente";

export async function jornadaEnCurso(): Promise<boolean> { return Boolean((await cacheGet<string>(CLAVE_INICIO))?.value); }
export async function inicioDeJornada(): Promise<string | null> { return (await cacheGet<string>(CLAVE_INICIO))?.value || null; }
export async function iniciarJornada(avisarServidor: () => Promise<unknown>): Promise<void> {
  await avisarServidor();
  await cacheSet(CLAVE_INICIO, new Date().toISOString());
  await cacheSet(CLAVE_FIN_PENDIENTE, null);
}
export async function terminarJornada(avisarServidor?: () => Promise<unknown>): Promise<boolean> {
  await cacheSet(CLAVE_INICIO, null);
  if (!avisarServidor) return true;
  try { await avisarServidor(); await cacheSet(CLAVE_FIN_PENDIENTE, null); return true; } catch { await cacheSet(CLAVE_FIN_PENDIENTE, true); return false; }
}
export async function reintentarFinPendiente(avisarServidor: () => Promise<unknown>): Promise<void> {
  if (!(await cacheGet<boolean>(CLAVE_FIN_PENDIENTE))?.value) return;
  try { await avisarServidor(); await cacheSet(CLAVE_FIN_PENDIENTE, null); } catch { /* se reintenta la próxima vez */ }
}
