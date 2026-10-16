// Huancayo UI: azul marino profundo + degradado magenta → violeta → azul (mismo sistema que el panel web).
export const C = {
  navy: '#0B1648', navy2: '#14307F', primary: '#2347C5', primary2: '#3D62E3',
  violet: '#7A2AB4', magenta: '#C4177F',
  red: '#E0394F', redDark: '#BF2A40', bg: '#F4F5FB', surface: '#FFFFFF',
  surface2: '#F7F8FD', text: '#1C2236', muted: '#667089', border: '#E5E8F3',
  success: '#0C9F6E', warning: '#E89A0C', danger: '#E0394F', info: '#2347C5', purple: '#7A2AB4',
};
// Degradados de marca (para expo-linear-gradient).
export const G = {
  brand: ['#C4177F', '#7A2AB4', '#2347C5'] as const,
  hero: ['#0B1648', '#14307F', '#3A1F88'] as const,
  soft: ['#FBE8F3', '#EEE6FA', '#E6ECFC'] as const,
};
export const statusColors: Record<string, string> = {
  LIBRE: '#334155', PENDIENTE: C.warning, PROGRAMADA: C.warning, EN_VISITA: C.info,
  EN_PROCESO: C.success, GESTIONADO: C.success, VISITADO: C.success, FINALIZADA: C.info,
  REPROGRAMADO: C.warning, NO_ENCONTRADO: C.danger, CANCELADA: C.danger,
  ACTIVO: C.success, INACTIVO: '#94A3B8', APTO: C.success, NO_APTO: C.danger,
};
export const money = (value: unknown) => Number(value || 0).toLocaleString('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 2 });
export const shortDate = (value: unknown) => value ? new Date(String(value)).toLocaleDateString('es-PE', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }) : '—';

