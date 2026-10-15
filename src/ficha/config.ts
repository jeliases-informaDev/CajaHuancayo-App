import { C } from "../theme";
import type { Plantilla, StepId } from "./types";

export type Paso = { id: StepId; titulo: string; corto: string; icono: string };

const VERIFICACION: Paso = { id: "verificacion", titulo: "Verificación del cliente", corto: "Cliente", icono: "account-check-outline" };
const NEGOCIO: Paso = { id: "negocio", titulo: "Negocio", corto: "Negocio", icono: "store-outline" };
const EVALUACION: Paso = { id: "evaluacion", titulo: "Evaluación financiera", corto: "Evaluación", icono: "chart-box-outline" };
const CUESTIONARIO: Paso = { id: "cuestionario", titulo: "Cuestionario al cliente", corto: "Cuestionario", icono: "clipboard-text-outline" };
const OTROS: Paso = { id: "otros", titulo: "Otros datos", corto: "Otros", icono: "account-group-outline" };
const CIERRE: Paso = { id: "cierre", titulo: "Cierre de la visita", corto: "Cierre", icono: "flag-checkered" };
const EVIDENCIAS: Paso = { id: "evidencias", titulo: "Evidencias y firma", corto: "Evidencias", icono: "camera-outline" };

// Cada tipo de crédito recorre SU propia secuencia de pasos.
export const PASOS: Record<Plantilla, Paso[]> = {
  MYPE_V1: [VERIFICACION, NEGOCIO, EVALUACION, CUESTIONARIO, OTROS, CIERRE, EVIDENCIAS],
  CONSUMO_V1: [VERIFICACION, CUESTIONARIO, OTROS, CIERRE, EVIDENCIAS],
};

export const TEMA: Record<Plantilla, { nombre: string; detalle: string; color: string; suave: string; icono: string }> = {
  MYPE_V1: { nombre: "Ficha MYPE", detalle: "Crédito Otros · verificas negocio y evaluación", color: C.warning, suave: "#FFF3E0", icono: "store-outline" },
  CONSUMO_V1: { nombre: "Ficha Consumo", detalle: "Crédito de consumo · verificación del cliente", color: C.primary, suave: "#EAF1FF", icono: "account-cash-outline" },
};

export const plantillaDe = (expediente: any): Plantilla => (expediente?.tipo_credito === "OTROS" ? "MYPE_V1" : "CONSUMO_V1");

export const RESULTADOS = [
  { value: "CONFORME", label: "Conforme", icon: "check-circle-outline" },
  { value: "OBSERVADO", label: "Observado", icon: "alert-circle-outline" },
  { value: "NO_UBICADO", label: "No ubicado", icon: "map-marker-remove-outline" },
  { value: "RECHAZADO", label: "Rechazado", icon: "close-circle-outline" },
];

export const ESTADOS_NEGOCIO = [
  { value: "EN_FUNCIONAMIENTO", label: "En funcionamiento" },
  { value: "INOPERATIVO", label: "Inoperativo" },
  { value: "DE_TERCEROS", label: "De terceros" },
];

export const PROPIEDADES_LOCAL = [
  { value: "PROPIO", label: "Propio" },
  { value: "ALQUILADO", label: "Alquilado" },
  { value: "FAMILIAR", label: "Familiar" },
  { value: "OTRO", label: "Otro" },
];

// Resultados en los que el auditor sí llegó al cliente y debe llenar la ficha completa.
export const EXIGE_FICHA = ["CONFORME", "OBSERVADO"];
