// Estado y tipos de la ficha de entrevista. Hay DOS fichas distintas, una por tipo de crédito:
//   · MYPE_V1    → créditos "Otros": el auditor verifica el negocio y la evaluación financiera.
//   · CONSUMO_V1 → créditos de consumo: ficha reducida, sin negocio ni balance.
// Cada una tiene sus propios pasos (ver config.ts); no comparten pantalla ni se mezclan.

export type YesNo = boolean | null;
export type Plantilla = "CONSUMO_V1" | "MYPE_V1";
export type StepId = "verificacion" | "negocio" | "evaluacion" | "cuestionario" | "otros" | "cierre" | "evidencias";

export type Conformidad = { conforme: boolean | null; comentario: string };
export type OtroCliente = { nombre: string; parentesco: string; actividad: string; antiguedad: string };
export type OtroIngreso = { origen: string; monto: string };

export type FichaState = {
  resultado: string;
  // a qué dirección va el auditor (MYPE: domicilio de la persona o un negocio); ver destino.ts
  destino: "DOMICILIO" | "NEGOCIO";
  indiceNegocio: number;
  // cuestionario
  entregoDinero: YesNo;
  pagoComision: YesNo;
  recibioMontoTotal: YesNo;
  conyugeConoce: YesNo;
  conyugeNoAplica: boolean; // Consumo: la ficha del banco ofrece «No aplica»
  creditosParalelos: YesNo;
  comparteDinero: YesNo;
  titularAdministra: YesNo;
  tieneMicroseguro: YesNo;
  infoMicroseguro: YesNo;
  conformeMicroseguro: YesNo;
  comentarioMicroseguro: string;
  dondePaga: string;
  // negocio (solo MYPE)
  estadoNegocio: string;
  propiedadLocal: string;
  conf: { ingresos: Conformidad; balance: Conformidad; resultados: Conformidad };
  // comunes
  comentarioNegocio: string;
  otrosClientes: OtroCliente[];
  otrosPasivos: string;
  otrosIngresos: OtroIngreso[];
  comentarioAuditor: string;
  // evidencias
  firmanteDocumento: string;
  photo: string;
  photo2: string;
  signature: string;
  // firma del auditor de campo: cierra SU trabajo en la visita y se pide en todos los resultados (también «no ubicado»)
  signatureAuditor: string;
};

export const sinConformidad = (): Conformidad => ({ conforme: null, comentario: "" });

export const estadoInicial = (documento: string): FichaState => ({
  resultado: "CONFORME",
  destino: "DOMICILIO", indiceNegocio: 0,
  entregoDinero: null, pagoComision: null, recibioMontoTotal: null,
  conyugeConoce: null, conyugeNoAplica: false, creditosParalelos: null, comparteDinero: null, titularAdministra: null,
  tieneMicroseguro: null, infoMicroseguro: null, conformeMicroseguro: null, comentarioMicroseguro: "",
  dondePaga: "",
  estadoNegocio: "", propiedadLocal: "",
  conf: { ingresos: sinConformidad(), balance: sinConformidad(), resultados: sinConformidad() },
  comentarioNegocio: "",
  otrosClientes: [], otrosPasivos: "", otrosIngresos: [],
  comentarioAuditor: "",
  firmanteDocumento: documento,
  photo: "", photo2: "", signature: "", signatureAuditor: "",
});

// zonaRadio: sin referencia todavía, cuánto puede alejarse la primera visita de la zona conocida (sugerencia del mapa o de visitas vecinas).
export type GeoConfig = { radio: number; precision: number; zonaRadio?: number };
