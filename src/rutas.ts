// Ruta por calles que calcula el servidor con su motor de rutas (OSRM con los mapas de Perú). null = el motor no está o falló: el mapa dibuja la recta de siempre.
export type RutaCalles = { coordenadas: [number, number][]; distancia_m: number; duracion_s: number; tramos: { distancia_m: number; duracion_s: number }[] };

export async function trazarRuta(
  api: <T>(path: string, options?: RequestInit) => Promise<T>,
  paradas: { latitud: number; longitud: number }[],
): Promise<RutaCalles | null> {
  if (paradas.length < 2) return null;
  const r = await api<{ data: { disponible: boolean } & Partial<RutaCalles> }>("/api/rutas/trazar", { method: "POST", body: JSON.stringify({ paradas: paradas.slice(0, 60) }) });
  const d = r.data;
  if (!d.disponible || !d.coordenadas || d.coordenadas.length < 2) return null;
  return { coordenadas: d.coordenadas, distancia_m: d.distancia_m ?? 0, duracion_s: d.duracion_s ?? 0, tramos: d.tramos ?? [] };
}

// «12 min», «1 h 05 min»
export function fmtDuracion(segundos: number) {
  const min = Math.round(segundos / 60);
  if (min < 1) return "menos de 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60); const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")} min` : `${h} h`;
}
