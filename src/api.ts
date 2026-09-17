declare const process: { env: Record<string, string | undefined> };
const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4100').replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 25000;

let deviceIdHeader = '';
export function setDeviceIdHeader(value: string) { deviceIdHeader = value; }

export class ApiError extends Error {
  status: number; data: any;
  constructor(status: number, data: any) {
    super(data?.error || data?.mensaje || 'No se pudo completar la solicitud');
    this.status = status; this.data = data;
  }
}

export async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(API_URL + path, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json', Accept: 'application/json',
        'x-client-platform': 'mobile',
        ...(deviceIdHeader ? { 'x-device-id': deviceIdHeader } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(options.headers || {}),
      },
    });
    const type = response.headers.get('content-type') || '';
    const data = type.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) throw new ApiError(response.status, data);
    return data as T;
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    if (error?.name === 'AbortError') throw new Error('El servidor tardó demasiado en responder. Intenta nuevamente.');
    throw new Error('No se pudo conectar con el servidor. Verifica tu conexión Wi-Fi y que el backend esté encendido.');
  } finally {
    clearTimeout(timeout);
  }
}
export { API_URL };
