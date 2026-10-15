import { EXIGE_FICHA } from "./config";
import type { FichaState, Plantilla, StepId } from "./types";

// Mismas reglas que aplica el servidor, para que el auditor las vea en el momento y la app
// lo lleve al paso exacto que debe corregir (en vez de un error genérico al final).

export type Problema = { paso: StepId; mensaje: string };

export const cuestionarioBasico = (s: FichaState) => s.entregoDinero !== null && s.pagoComision !== null && s.recibioMontoTotal !== null;

const conformidadCompleta = (s: FichaState) =>
  (["ingresos", "balance", "resultados"] as const).every((k) => {
    const b = s.conf[k];
    return b.conforme !== null && (b.conforme || b.comentario.trim().length >= 5);
  });

// Motivos por los que NO se puede cerrar como CONFORME (aparte de la ubicación, que se mide al guardar).
export function bloqueosConforme(s: FichaState, plantilla: Plantilla, distanciaM: number | null, radio: number): string[] {
  const motivos: string[] = [];
  if (plantilla === "MYPE_V1") {
    if (s.estadoNegocio && s.estadoNegocio !== "EN_FUNCIONAMIENTO") motivos.push("el negocio no está en funcionamiento");
    if ((["ingresos", "balance", "resultados"] as const).some((k) => s.conf[k].conforme === false)) motivos.push("hay observaciones en la evaluación financiera");
  }
  if (distanciaM != null && distanciaM > radio) motivos.push(`estás a ${Math.round(distanciaM)} m del domicilio (máximo ${radio} m)`);
  return motivos;
}

export function pasoCompleto(id: StepId, s: FichaState, plantilla: Plantilla): boolean {
  switch (id) {
    case "verificacion": return true;
    case "negocio": return Boolean(s.estadoNegocio && s.propiedadLocal);
    case "evaluacion": return conformidadCompleta(s);
    case "cuestionario": return cuestionarioBasico(s);
    case "otros": return true;
    case "cierre": return s.resultado === "CONFORME" || s.comentarioAuditor.trim().length >= 10;
    case "evidencias": return Boolean(s.photo) && (!EXIGE_FICHA.includes(s.resultado) || Boolean(s.signature));
    default: return plantilla === "MYPE_V1";
  }
}

// Primer problema que impide enviar; null = lista para enviar.
export function validarEnvio(s: FichaState, plantilla: Plantilla, distanciaM: number | null, radio: number): Problema | null {
  const llegoAlCliente = EXIGE_FICHA.includes(s.resultado);
  if (llegoAlCliente) {
    if (!cuestionarioBasico(s)) return { paso: "cuestionario", mensaje: "Responde las 3 preguntas obligatorias del cuestionario." };
    if (plantilla === "MYPE_V1") {
      if (!s.estadoNegocio) return { paso: "negocio", mensaje: "Indica el estado del negocio." };
      if (!s.propiedadLocal) return { paso: "negocio", mensaje: "Indica la propiedad del local." };
      for (const [k, nombre] of [["ingresos", "los ingresos"], ["balance", "el balance"], ["resultados", "el estado de resultados"]] as const) {
        const b = s.conf[k];
        if (b.conforme === null) return { paso: "evaluacion", mensaje: `Indica si ${nombre} están conformes u observados.` };
        if (b.conforme === false && b.comentario.trim().length < 5) return { paso: "evaluacion", mensaje: `Explica la observación en ${nombre}.` };
      }
    }
  }
  if (s.resultado === "CONFORME") {
    const motivos = bloqueosConforme(s, plantilla, distanciaM, radio);
    if (motivos.length) return { paso: "cierre", mensaje: `No puede cerrarse como Conforme: ${motivos.join("; ")}. Elige Observado y explica el motivo.` };
  } else if (s.comentarioAuditor.trim().length < 10) {
    return { paso: "cierre", mensaje: "Este resultado requiere un comentario del auditor de al menos 10 caracteres." };
  }
  if (!s.photo) return { paso: "evidencias", mensaje: "Toma la fotografía principal de evidencia." };
  if (llegoAlCliente) {
    if (!/^[A-Za-z0-9]{6,20}$/.test(s.firmanteDocumento.trim())) return { paso: "evidencias", mensaje: "Escribe el documento de quien firma (6 a 20 caracteres, sin espacios)." };
    if (!s.signature) return { paso: "evidencias", mensaje: "Solicita la firma del cliente antes de guardar." };
  }
  return null;
}
