// Sistema visual de la app de auditoría (mismo lenguaje que el panel web): lienzo claro con un tinte frío, azul
// de marca como único color de acción y el hilo magenta → violeta → azul reservado a lo que está verificado.
export const C = {
  navy: '#0B1030', navy2: '#16227A', primary: '#2D41C4', primary2: '#3A52D9',
  blue50: '#EAEDFC', violet: '#7A2C9E', magenta: '#C11F8C',
  red: '#C0243E', redDark: '#8F1B2A', bg: '#F1F2F8', surface: '#FFFFFF',
  surface2: '#F7F8FC', ink: '#0E1332', text: '#1B2145', text2: '#3A4165', muted: '#666D92', placeholder: '#959CBA',
  border: '#E2E5EF', borderStrong: '#CFD3E5', soft: '#EAECF5',
  success: '#0C8559', warning: '#A8620A', danger: '#C0243E', info: '#2D41C4', purple: '#7A2C9E',
  successBg: '#E1F4EA', warningBg: '#FFF0D1', dangerBg: '#FDE7EB', infoBg: '#EAEDFC', magentaBg: '#FBE6F3',
};
// Degradado de marca: se usa con moderación (sello, barra de avance, línea de acento).
export const G = {
  brand: ['#C11F8C', '#7A2C9E', '#2D41C4'] as const,
  hero: ['#16227A', '#0B1133'] as const,
  glow: ['rgba(193,31,140,0.42)', 'rgba(193,31,140,0)'] as const,
  action: ['#3A52D9', '#2D41C4'] as const,
  danger: ['#D42F4A', '#C0243E'] as const,
  soft: ['#FBE6F3', '#EFEAF8', '#EAEDFC'] as const,
};
// Instrument Serif (solo titulares y cifras grandes); el resto de la interfaz usa la fuente del sistema.
export const F = { display: 'InstrumentSerif_400Regular', displayLight: 'InstrumentSerif_400Regular', italic: 'InstrumentSerif_400Regular_Italic' };
// Sombras con el tinte azul de la marca (nunca negro puro).
export const shadow = {
  sm: { shadowColor: '#0E1332', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  md: { shadowColor: '#0E1332', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
};
// Color estable por persona para los avatares (mismas parejas que el panel).
const AVATARES: [string, string][] = [['#E8ECFD', '#2D41C4'], ['#FBE6F3', '#A3187A'], ['#EFE6FA', '#6B2A94'], ['#E0F4EC', '#0B7A53'], ['#FDEFD6', '#9A5A00'], ['#E3EDF7', '#2B5A87']];
export const avatarTone = (name?: string | null) => {
  let h = 0;
  for (const c of String(name || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [bg, fg] = AVATARES[h % AVATARES.length];
  return { bg, fg };
};
export const initials = (name?: string | null) => (String(name || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?');
export const statusColors: Record<string, string> = {
  LIBRE: '#3A4165', PENDIENTE: C.warning, PROGRAMADA: C.warning, EN_VISITA: C.info,
  EN_PROCESO: C.success, GESTIONADO: C.success, VISITADO: C.success, FINALIZADA: C.info,
  REPROGRAMADO: C.warning, NO_ENCONTRADO: C.danger, CANCELADA: C.danger,
  ACTIVO: C.success, INACTIVO: '#666D92', APTO: C.success, NO_APTO: C.danger,
};
export const money = (value: unknown) => Number(value || 0).toLocaleString('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 2 });
export const shortDate = (value: unknown) => value ? new Date(String(value)).toLocaleDateString('es-PE', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }) : '—';
