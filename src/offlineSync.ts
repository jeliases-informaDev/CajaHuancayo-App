import { Platform } from "react-native";
import * as BackgroundTask from "expo-background-task";
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";
import * as TaskManager from "expo-task-manager";
import { API_URL } from "./api";
import { getDeviceId } from "./deviceIdentity";
import { decryptJson, encryptJson } from "./offlineCrypto";

export const OFFLINE_SYNC_TASK = "ch-offline-visit-sync";
const TOKEN_KEY = "ch_token";
const DATABASE_NAME = "ch-offline.db";
const REQUEST_TIMEOUT_MS = 25_000;
const PAYLOAD_DIR = `${FileSystem.documentDirectory}pending-visits`;

export type QueuedVisitInput = {
  id: string; // client_sync_id
  idExpediente: number;
  idAsignacion: number | null;
  fechaHoraCheckin: string;
  resultado: string;
  respuestasCuestionario: Record<string, unknown>;
  comentarioNegocio: string;
  comentarioAuditor: string;
  otrosClientesDomicilio: unknown[];
  otrosIngresos: unknown[];
  firma: string;
  photo1Uri: string;
  photo2Uri: string;
  latitude: number;
  longitude: number;
  precisionMeters: number | null;
  mockLocation: boolean;
  deviceIntegrityOk: boolean;
};

type PendingRow = {
  id: string;
  id_expediente: number;
  id_asignacion: number | null;
  photo1_uri: string;
  photo2_uri: string;
  photo1_key: string | null;
  photo2_key: string | null;
  attempts: number;
};

export type SyncResult = { attempted: number; synced: number; pending: number; syncedIds: string[] };

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let activeSync: Promise<SyncResult> | null = null;

async function database() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS pending_visits (
          id TEXT PRIMARY KEY NOT NULL,
          id_expediente INTEGER NOT NULL,
          id_asignacion INTEGER,
          photo1_uri TEXT NOT NULL,
          photo2_uri TEXT NOT NULL,
          photo1_key TEXT,
          photo2_key TEXT,
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS pending_visits_created_idx ON pending_visits(created_at);
      `);
      return db;
    });
  }
  return databasePromise;
}

async function requestJson(path: string, options: RequestInit, token: string, deviceId: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-client-platform": "mobile",
        "x-device-id": deviceId,
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const type = response.headers.get("content-type") || "";
    const body = type.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) {
      const error = new Error((body as any)?.error || `Error de sincronización HTTP ${response.status}`) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    return body as any;
  } finally {
    clearTimeout(timeout);
  }
}

async function evidenceKey(photoUri: string, idExpediente: number, tipo: "FOTO_PRINCIPAL" | "FOTO_ADICIONAL", token: string, deviceId: string) {
  const info = await FileSystem.getInfoAsync(photoUri);
  const size = info.exists && "size" in info ? Number(info.size || 0) : 0;
  if (!info.exists || !size) throw new Error(`No se encontró la fotografía (${tipo}) almacenada.`);
  const signed = await requestJson(
    "/api/visitas/evidencias/presign",
    { method: "POST", body: JSON.stringify({ id_expediente: idExpediente, tipo, content_type: "image/jpeg", size }) },
    token, deviceId,
  );
  const upload = await FileSystem.uploadAsync(signed.data.uploadUrl, photoUri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { "Content-Type": signed.data.contentType },
  });
  if (upload.status < 200 || upload.status >= 300) {
    const body = (() => { try { return JSON.parse(upload.body); } catch { return null; } })();
    throw new Error(body?.error || `No se pudo subir la fotografía (HTTP ${upload.status}).`);
  }
  return String(signed.data.key);
}

async function payloadPath(id: string) { return `${PAYLOAD_DIR}/${id}.json`; }

async function synchronize(tokenOverride?: string | null): Promise<SyncResult> {
  const db = await database();
  const token = tokenOverride
    || (Platform.OS === "web" ? globalThis.localStorage?.getItem(TOKEN_KEY) : await SecureStore.getItemAsync(TOKEN_KEY));
  const deviceId = await getDeviceId();
  if (!token) {
    const row = await db.getFirstAsync<{ total: number }>("SELECT COUNT(*) AS total FROM pending_visits");
    return { attempted: 0, synced: 0, pending: Number(row?.total || 0), syncedIds: [] };
  }
  const items = await db.getAllAsync<PendingRow>("SELECT * FROM pending_visits ORDER BY created_at ASC");
  const result: SyncResult = { attempted: 0, synced: 0, pending: items.length, syncedIds: [] };
  if (!items.length) return result;

  for (const item of items) {
    result.attempted += 1;
    try {
      let photo1Key = item.photo1_key;
      let photo2Key = item.photo2_key;
      if (!photo1Key) {
        photo1Key = await evidenceKey(item.photo1_uri, item.id_expediente, "FOTO_PRINCIPAL", token, deviceId);
        await db.runAsync("UPDATE pending_visits SET photo1_key = ?, updated_at = ? WHERE id = ?", photo1Key, Date.now(), item.id);
      }
      if (!photo2Key && item.photo2_uri) {
        photo2Key = await evidenceKey(item.photo2_uri, item.id_expediente, "FOTO_ADICIONAL", token, deviceId);
        await db.runAsync("UPDATE pending_visits SET photo2_key = ?, updated_at = ? WHERE id = ?", photo2Key, Date.now(), item.id);
      }
      const encrypted = await FileSystem.readAsStringAsync(await payloadPath(item.id));
      const payload = await decryptJson(encrypted);
      await requestJson(
        "/api/visitas",
        {
          method: "POST",
          body: JSON.stringify({
            client_sync_id: item.id,
            id_asignacion: item.id_asignacion || undefined,
            id_expediente: item.id_expediente,
            fecha_hora_checkin: payload.fechaHoraCheckin,
            latitud: payload.latitude,
            longitud: payload.longitude,
            precision_metros: payload.precisionMeters ?? undefined,
            mock_location: payload.mockLocation,
            device_integrity_ok: payload.deviceIntegrityOk,
            device_id: deviceId,
            resultado: payload.resultado,
            respuestas_cuestionario: payload.respuestasCuestionario,
            comentario_negocio: payload.comentarioNegocio || undefined,
            comentario_auditor: payload.comentarioAuditor || undefined,
            otros_clientes_domicilio: payload.otrosClientesDomicilio?.length ? payload.otrosClientesDomicilio : undefined,
            otros_ingresos: payload.otrosIngresos?.length ? payload.otrosIngresos : undefined,
            firma_evidencia: payload.firma,
            evidencia_principal_key: photo1Key,
            evidencia_adicional_key: photo2Key || undefined,
          }),
        },
        token, deviceId,
      );
      await db.runAsync("DELETE FROM pending_visits WHERE id = ?", item.id);
      await Promise.all([
        FileSystem.deleteAsync(item.photo1_uri, { idempotent: true }).catch(() => {}),
        item.photo2_uri ? FileSystem.deleteAsync(item.photo2_uri, { idempotent: true }).catch(() => {}) : Promise.resolve(),
        FileSystem.deleteAsync(await payloadPath(item.id), { idempotent: true }).catch(() => {}),
      ]);
      result.synced += 1;
      result.pending -= 1;
      result.syncedIds.push(item.id);
    } catch (error: any) {
      await db.runAsync(
        "UPDATE pending_visits SET attempts = attempts + 1, last_error = ?, updated_at = ? WHERE id = ?",
        String(error?.message || "Error de sincronización").slice(0, 500), Date.now(), item.id,
      );
      if (error?.status === 401 || error?.status === 403) break;
      // Se conserva el orden: una visita posterior no debe adelantarse a otra.
      break;
    }
  }
  return result;
}

export function createOfflineVisitId(idExpediente: number) {
  const random = Math.random().toString(36).slice(2, 12);
  return `mobile-${idExpediente}-${Date.now().toString(36)}-${random}`;
}

export async function enqueueVisit(input: QueuedVisitInput) {
  const db = await database();
  const now = Date.now();
  await FileSystem.makeDirectoryAsync(PAYLOAD_DIR, { intermediates: true }).catch(() => {});
  const encrypted = await encryptJson({
    fechaHoraCheckin: input.fechaHoraCheckin,
    resultado: input.resultado,
    respuestasCuestionario: input.respuestasCuestionario,
    comentarioNegocio: input.comentarioNegocio,
    comentarioAuditor: input.comentarioAuditor,
    otrosClientesDomicilio: input.otrosClientesDomicilio,
    otrosIngresos: input.otrosIngresos,
    firma: input.firma,
    latitude: input.latitude,
    longitude: input.longitude,
    precisionMeters: input.precisionMeters,
    mockLocation: input.mockLocation,
    deviceIntegrityOk: input.deviceIntegrityOk,
  });
  await FileSystem.writeAsStringAsync(await payloadPath(input.id), encrypted);
  await db.runAsync(
    `INSERT OR IGNORE INTO pending_visits (
      id, id_expediente, id_asignacion, photo1_uri, photo2_uri, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    input.id, input.idExpediente, input.idAsignacion, input.photo1Uri, input.photo2Uri, now, now,
  );
  // La visita ya quedó guardada cifrada en el dispositivo. Una restricción del
  // fabricante para tareas en segundo plano nunca debe convertir el guardado en un error.
  await registerOfflineSyncTask().catch(() => false);
  return input.id;
}

export async function syncPendingVisits(token?: string | null) {
  if (!activeSync) {
    activeSync = synchronize(token).finally(() => { activeSync = null; });
  }
  return activeSync;
}

export async function pendingVisitCount() {
  const db = await database();
  const row = await db.getFirstAsync<{ total: number }>("SELECT COUNT(*) AS total FROM pending_visits");
  return Number(row?.total || 0);
}

export async function registerOfflineSyncTask() {
  if (Platform.OS === "web") return false;
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
  const registered = await TaskManager.isTaskRegisteredAsync(OFFLINE_SYNC_TASK);
  if (!registered) await BackgroundTask.registerTaskAsync(OFFLINE_SYNC_TASK, { minimumInterval: 15 });
  return true;
}

if (!TaskManager.isTaskDefined(OFFLINE_SYNC_TASK)) {
  TaskManager.defineTask(OFFLINE_SYNC_TASK, async () => {
    try {
      await syncPendingVisits();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}
