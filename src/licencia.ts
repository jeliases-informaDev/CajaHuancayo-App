// La licencia de GeoMatrix de la empresa la dice el servidor (Sulotec): viene con /api/auth/me, al entrar y con cada consulta de la muestra.
// La app no decide reglas, solo muestra lo que llega. Se guarda en el celular para arrancar con la última conocida; null = sin información: no se muestra nada.
import { useEffect, useState } from "react";
import { cacheGet, cacheSet } from "./offlineSync";

export type EstadoLicencia = "ACTIVA" | "SOLO_LECTURA" | "SUSPENDIDA" | "CANCELADA" | "SIN_LICENCIA";
export type Licencia = {
  estado: EstadoLicencia;
  plan: string | null;
  usuarios_max: number | null;
  usuarios_activos: number | null;
  puede_crear_usuarios: boolean | null;
  vencimiento: string | null;
  dias_para_vencer: number | null;
  mensaje: string;
  enlace: string;
};

const CLAVE = "licencia_v1";
let enMemoria: Licencia | null = null;
let delServidor = false; // ya contestó el servidor en esta sesión: lo guardado en el celular deja de mandar
const oyentes = new Set<(l: Licencia | null) => void>();

export async function recordarLicencia(licencia: Licencia | null) {
  const primera = !delServidor;
  delServidor = true;
  // La muestra se consulta cada 20 s: si la licencia no cambió no se vuelve a avisar a las pantallas ni a escribir en el celular.
  if (!primera && JSON.stringify(enMemoria) === JSON.stringify(licencia)) return;
  enMemoria = licencia;
  oyentes.forEach((f) => f(licencia));
  await cacheSet(CLAVE, licencia);
}

// Toma el campo «licencia» de una respuesta del servidor (viene en la raíz; también se acepta dentro de data). Si la respuesta no lo trae
// (servidor anterior) no se toca lo conocido; si viene null (licencias apagadas) se borra para que no quede una franja vieja.
export function recordarLicenciaDe(respuesta: any) {
  if (!respuesta || typeof respuesta !== "object") return;
  const l = respuesta.licencia !== undefined ? respuesta.licencia : respuesta.data?.licencia;
  if (l !== undefined) recordarLicencia(l ?? null);
}

export function useLicencia() {
  const [licencia, setLicencia] = useState<Licencia | null>(enMemoria);
  useEffect(() => {
    oyentes.add(setLicencia);
    // Hasta que el servidor conteste se muestra la última licencia conocida (guardada en el celular).
    if (!delServidor && !enMemoria) cacheGet<Licencia>(CLAVE).then((c) => { if (c?.value && !delServidor && !enMemoria) { enMemoria = c.value; setLicencia(c.value); } });
    return () => { oyentes.delete(setLicencia); };
  }, []);
  return licencia;
}

// Con estos estados el servidor rechaza las escrituras (registrar visitas, iniciar jornada, tomar casos); las lecturas siguen pasando.
export const licenciaBloqueaEscrituras = (l: Licencia | null) => l?.estado === "SOLO_LECTURA" || l?.estado === "SUSPENDIDA" || l?.estado === "CANCELADA";

// Franja que se apila arriba de la app. Vencida (solo lectura) = ámbar; suspendida o cancelada = rojo; activa y por vencer = ámbar discreto.
// SIN_LICENCIA y null = nada: eso lo resuelve el administrador desde el panel, no el auditor.
export type FranjaLicencia = { texto: string; tono: "ambar" | "suave" | "rojo" };
export const franjaDeLicencia = (l: Licencia | null): FranjaLicencia | null => {
  if (!l) return null;
  if (l.estado === "SOLO_LECTURA") return { texto: "Licencia vencida: puedes ver tus casos, pero no registrar visitas.", tono: "ambar" };
  if (l.estado === "SUSPENDIDA") return { texto: "Licencia suspendida: no se pueden registrar visitas. Avisa a tu administrador.", tono: "rojo" };
  if (l.estado === "CANCELADA") return { texto: "Licencia cancelada: no se pueden registrar visitas. Avisa a tu administrador.", tono: "rojo" };
  if (l.estado === "ACTIVA" && typeof l.dias_para_vencer === "number" && l.dias_para_vencer <= 7) {
    const n = Math.max(0, Math.floor(l.dias_para_vencer));
    return { texto: n === 0 ? "Tu licencia vence hoy" : `Tu licencia vence en ${n} ${n === 1 ? "día" : "días"}`, tono: "suave" };
  }
  return null;
};
