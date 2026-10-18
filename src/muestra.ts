// Carga de «mi muestra» por páginas. La app NUNCA debe depender de que todos los casos quepan en una sola respuesta ni cortarlos en silencio:
// pide páginas de 100 hasta tener todos (con un tope de seguridad), y repite la descarga completa solo si la «huella» de la muestra cambió
// (una consulta mínima), en vez de bajar todo cada pocos segundos. Con un servidor anterior (sin paginación) sigue funcionando: recibe todo junto.

type Api = <T>(path: string, options?: RequestInit) => Promise<T>;

export type ResumenMuestra = { total: number; ALTA: number; MEDIA: number; BAJA: number; CONSUMO: number; OTROS: number };
export type Muestra = { data: any[]; total: number; resumen: ResumenMuestra | null; completa: boolean; version: string | null };
type Opciones = { forzar?: boolean; ligero?: boolean; onPagina?: (parcial: Muestra) => void };

const TAM_PAGINA = 100;
export const TOPE_MUESTRA = 3000; // por seguridad: si un auditor tuviera más casos activos, se avisa («completa: false») y se muestran los más urgentes

const memoria: Record<string, Muestra | null> = { completa: null, ligera: null };
const enCurso: Record<string, Promise<Muestra> | null> = { completa: null, ligera: null };

export const muestraEnMemoria = (ligero = false) => memoria[ligero ? "ligera" : "completa"];

export function cargarMuestra(api: Api, opciones: Opciones = {}): Promise<Muestra> {
  const clave = opciones.ligero ? "ligera" : "completa";
  if (enCurso[clave]) return enCurso[clave] as Promise<Muestra>; // dos pantallas pidiendo lo mismo comparten la misma descarga
  const tarea = (async () => {
    const previa = memoria[clave];
    if (previa && previa.completa && !opciones.forzar && previa.version) {
      try {
        const v: any = await api("/api/asignaciones/mias/version");
        if (v?.data?.version === previa.version) return previa; // nada cambió: no se descarga otra vez
      } catch { /* servidor anterior o sin señal: se intenta la descarga completa */ }
    }
    const datos: any[] = [];
    let pagina = 1; let paginas = 1; let total = 0; let resumen: ResumenMuestra | null = null; let version: string | null = null;
    do {
      const r: any = await api(`/api/asignaciones/mias?page=${pagina}&limit=${TAM_PAGINA}${opciones.ligero ? "&ligero=true" : ""}`);
      datos.push(...(r.data || []));
      if (r.pagination) { total = r.pagination.total; paginas = r.pagination.pages; resumen = r.resumen ?? resumen; version = r.version ?? version; }
      else { total = datos.length; paginas = 1; } // servidor anterior: todo vino en una sola respuesta
      const completa = pagina >= paginas || datos.length >= total;
      opciones.onPagina?.({ data: [...datos], total, resumen, completa, version });
      pagina += 1;
    } while (pagina <= paginas && datos.length < TOPE_MUESTRA);
    const resultado: Muestra = { data: datos, total, resumen, completa: datos.length >= total, version };
    memoria[clave] = resultado;
    return resultado;
  })().finally(() => { enCurso[clave] = null; });
  enCurso[clave] = tarea;
  return tarea;
}
