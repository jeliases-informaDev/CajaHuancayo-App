// SOLO PARA VER Y PROBAR LA APP EN EL NAVEGADOR. El celular usa offlineSync.ts (SQLite + archivos cifrados);
// este archivo nunca entra al APK. Aquí la cola vive en localStorage y las fotos quedan como data URI.
// El cuerpo que se envía al servidor es el mismo que arma offlineSync.ts.
import { Alert } from "react-native";
import { API_URL } from "./api";
import { getDeviceId } from "./deviceIdentity";
import { decryptJson, encryptJson } from "./offlineCrypto";

export const OFFLINE_SYNC_TASK = "ch-offline-visit-sync";
const COLA = "ch_web_cola_v1";
const CACHE = "ch_web_cache_";

export type QueuedVisitInput = {
  id: string; idExpediente: number; idAsignacion: number | null; fechaHoraCheckin: string; resultado: string; plantilla?: string; ubicacionVisitada?: string; indiceNegocio?: number;
  estadoNegocio?: string; propiedadLocal?: string; otrosPasivos?: string; conformidadFinanciera?: Record<string, unknown> | null; firmanteDocumento?: string;
  respuestasCuestionario: Record<string, unknown>; comentarioNegocio: string; comentarioAuditor: string; otrosClientesDomicilio: unknown[]; otrosIngresos: unknown[];
  firma: string; photo1Uri: string; photo2Uri: string; latitude: number; longitude: number; precisionMeters: number | null; mockLocation: boolean; deviceIntegrityOk: boolean;
};
export type RejectedVisit = { id: string; idExpediente: number; reason: string };
export type SyncResult = { attempted: number; synced: number; pending: number; syncedIds: string[]; rejected: RejectedVisit[] };
type Fila = { id: string; idExpediente: number; idAsignacion: number | null; photo1Uri: string; photo2Uri: string; photo1Key: string | null; photo2Key: string | null; status: "PENDING" | "REJECTED"; lastError: string | null; cifrado: string; updatedAt: number };

const leer = (): Fila[] => { try { return JSON.parse(localStorage.getItem(COLA) || "[]"); } catch { return []; } };
const guardar = (filas: Fila[]) => localStorage.setItem(COLA, JSON.stringify(filas));

export async function cacheGet<T = any>(key: string): Promise<{ value: T; updatedAt: number } | null> {
  try { const raw = localStorage.getItem(CACHE + key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export async function cacheSet(key: string, value: unknown) {
  try { localStorage.setItem(CACHE + key, JSON.stringify({ value, updatedAt: Date.now() })); } catch { /* sin espacio: no pasa nada */ }
}

async function pedir(path: string, options: RequestInit, token: string, deviceId: string) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { Accept: "application/json", "Content-Type": "application/json", "x-client-platform": "mobile", "x-device-id": deviceId, Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const type = response.headers.get("content-type") || "";
  const body: any = type.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) { const e: any = new Error(body?.error || `Error de sincronización HTTP ${response.status}`); e.status = response.status; e.code = body?.code; throw e; }
  return body;
}

async function claveEvidencia(uri: string, idExpediente: number, tipo: "FOTO_PRINCIPAL" | "FOTO_ADICIONAL", token: string, deviceId: string) {
  const blob = await (await fetch(uri)).blob();
  if (!blob.size) throw new Error(`No se encontró la fotografía (${tipo}) almacenada.`);
  const firmado = await pedir("/api/visitas/evidencias/presign", { method: "POST", body: JSON.stringify({ id_expediente: idExpediente, tipo, content_type: "image/jpeg", size: blob.size }) }, token, deviceId);
  const subida = await fetch(firmado.data.uploadUrl, { method: "PUT", headers: { "Content-Type": firmado.data.contentType, Authorization: `Bearer ${token}`, "x-client-platform": "mobile", "x-device-id": deviceId }, body: blob });
  if (!subida.ok) { const b: any = await subida.json().catch(() => null); const e: any = new Error(b?.error || `No se pudo subir la fotografía (HTTP ${subida.status}).`); e.status = subida.status; e.code = b?.code; throw e; }
  return String(firmado.data.key);
}

// Un rechazo "de negocio" del servidor no se arregla reintentando; lo transitorio sí (misma regla que offlineSync.ts).
const esRechazoDefinitivo = (e: any) => [400, 404, 409, 413, 422].includes(Number(e?.status)) || (Number(e?.status) === 403 && e?.code === "NOT_ASSIGNED");

let activa: Promise<SyncResult> | null = null;
async function sincronizar(tokenOverride?: string | null): Promise<SyncResult> {
  const token = tokenOverride || localStorage.getItem("ch_token");
  const deviceId = await getDeviceId();
  const filas = leer();
  const pendientes = filas.filter((f) => f.status === "PENDING");
  const result: SyncResult = { attempted: 0, synced: 0, pending: pendientes.length, syncedIds: [], rejected: [] };
  if (!token || !pendientes.length) return result;
  const cambiar = (id: string, parche: Partial<Fila>) => guardar(leer().map((f) => (f.id === id ? { ...f, ...parche, updatedAt: Date.now() } : f)));
  for (const item of pendientes) {
    result.attempted += 1;
    try {
      let k1 = item.photo1Key; let k2 = item.photo2Key;
      if (!k1) { k1 = await claveEvidencia(item.photo1Uri, item.idExpediente, "FOTO_PRINCIPAL", token, deviceId); cambiar(item.id, { photo1Key: k1 }); }
      if (!k2 && item.photo2Uri) { k2 = await claveEvidencia(item.photo2Uri, item.idExpediente, "FOTO_ADICIONAL", token, deviceId); cambiar(item.id, { photo2Key: k2 }); }
      const payload = await decryptJson(item.cifrado);
      await pedir("/api/visitas", {
        method: "POST",
        body: JSON.stringify({
          client_sync_id: item.id, id_asignacion: item.idAsignacion || undefined, id_expediente: item.idExpediente,
          fecha_hora_checkin: payload.fechaHoraCheckin, latitud: payload.latitude, longitud: payload.longitude,
          precision_metros: payload.precisionMeters ?? undefined, mock_location: payload.mockLocation, device_integrity_ok: payload.deviceIntegrityOk, device_id: deviceId,
          resultado: payload.resultado, plantilla: payload.plantilla || undefined, ...(payload.ubicacionVisitada === "NEGOCIO" ? { ubicacion_visitada: "NEGOCIO", indice_negocio: payload.indiceNegocio ?? 0 } : {}), estado_negocio: payload.estadoNegocio || undefined, propiedad_local: payload.propiedadLocal || undefined,
          otros_pasivos: payload.otrosPasivos || undefined, conformidad_financiera: payload.conformidadFinanciera || undefined, firmante_documento: payload.firmanteDocumento || undefined,
          respuestas_cuestionario: payload.respuestasCuestionario, comentario_negocio: payload.comentarioNegocio || undefined, comentario_auditor: payload.comentarioAuditor || undefined,
          otros_clientes_domicilio: payload.otrosClientesDomicilio?.length ? payload.otrosClientesDomicilio : undefined,
          otros_ingresos: payload.otrosIngresos?.length ? payload.otrosIngresos : undefined,
          firma_evidencia: payload.firma || undefined, evidencia_principal_key: k1, evidencia_adicional_key: k2 || undefined,
        }),
      }, token, deviceId);
      guardar(leer().filter((f) => f.id !== item.id));
      result.synced += 1; result.pending -= 1; result.syncedIds.push(item.id);
    } catch (error: any) {
      if (esRechazoDefinitivo(error)) {
        const reason = String(error?.message || "Rechazada por el servidor").slice(0, 500);
        cambiar(item.id, { status: "REJECTED", lastError: reason });
        result.pending -= 1; result.rejected.push({ id: item.id, idExpediente: item.idExpediente, reason });
        continue;
      }
      cambiar(item.id, { lastError: error?.status ? String(error?.message || "Error de sincronización").slice(0, 500) : "Sin conexión con el servidor. La visita sigue guardada y se reintentará sola." });
      break;
    }
  }
  return result;
}

export function createOfflineVisitId(idExpediente: number) {
  return `mobile-${idExpediente}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
export async function enqueueVisit(input: QueuedVisitInput) {
  const { id, idExpediente, idAsignacion, photo1Uri, photo2Uri, ...resto } = input;
  const cifrado = await encryptJson({ ...resto, photo1Uri: undefined, photo2Uri: undefined });
  guardar([...leer().filter((f) => f.id !== id), { id, idExpediente, idAsignacion, photo1Uri, photo2Uri, photo1Key: null, photo2Key: null, status: "PENDING", lastError: null, cifrado, updatedAt: Date.now() }]);
  return id;
}
export async function syncPendingVisits(token?: string | null) {
  if (!activa) activa = sincronizar(token).finally(() => { activa = null; });
  return activa;
}
export async function pendingVisitCount() { return leer().filter((f) => f.status === "PENDING").length; }
export async function lastSyncError(): Promise<string | null> { return leer().find((f) => f.status === "PENDING" && f.lastError)?.lastError || null; }
export async function rejectedVisits(): Promise<RejectedVisit[]> {
  return leer().filter((f) => f.status === "REJECTED").map((f) => ({ id: f.id, idExpediente: f.idExpediente, reason: f.lastError || "Rechazada por el servidor" }));
}
export async function discardRejectedVisit(id: string) { guardar(leer().filter((f) => !(f.id === id && f.status === "REJECTED"))); }
export async function registerOfflineSyncTask() { return false; }

// Alert.alert no existe en react-native-web: se emula con los cuadros del navegador.
(Alert as any).alert = (titulo: string, mensaje?: string, botones?: { text?: string; style?: string; onPress?: () => void }[]) => {
  const texto = [titulo, mensaje].filter(Boolean).join("\n\n");
  if (!botones || botones.length < 2) { window.alert(texto); botones?.[0]?.onPress?.(); return; }
  const cancelar = botones.find((b) => b.style === "cancel");
  const confirmar = botones.filter((b) => b !== cancelar).pop();
  if (window.confirm(texto)) confirmar?.onPress?.(); else cancelar?.onPress?.();
};
