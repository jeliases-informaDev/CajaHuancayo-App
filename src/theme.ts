// Sistema visual de la app de auditoría (mismo criterio que el panel web): interfaz sobria, un solo color
// de acción (azul) y el magenta/violeta solo como acento de marca.
export const C = {
  navy: '#0D1533', navy2: '#1A2759', primary: '#1C3B9C', primary2: '#2A4FC0',
  blue50: '#EFF3FD', violet: '#5E2A8C', magenta: '#B5167C',
  red: '#B42335', redDark: '#8F1B2A', bg: '#F5F6FA', surface: '#FFFFFF',
  surface2: '#F8F9FC', ink: '#161C2F', text: '#1F2740', text2: '#454E6B', muted: '#6A7290', placeholder: '#9AA2BD',
  border: '#DFE3EE', borderStrong: '#C8CEE0', soft: '#ECEFF6',
  success: '#0F7A55', warning: '#A46200', danger: '#B42335', info: '#1C3B9C', purple: '#5E2A8C',
  successBg: '#E6F4EE', warningBg: '#FFF3D6', dangerBg: '#FDECEE', infoBg: '#EFF3FD', magentaBg: '#FBE9F4',
};
// Degradado de marca: se usa con moderación (logotipo, barra de progreso, línea de acento).
export const G = {
  brand: ['#B5167C', '#5E2A8C', '#1C3B9C'] as const,
  hero: ['#0D1533', '#16235A', '#2A2A73'] as const,
  soft: ['#FBE9F4', '#EFEAF8', '#EFF3FD'] as const,
};
// Newsreader (serif) solo para títulos y cifras grandes; el resto de la interfaz usa la fuente del sistema.
export const F = { display: 'Newsreader_500Medium', displayLight: 'Newsreader_400Regular' };
export const statusColors: Record<string, string> = {
  LIBRE: '#454E6B', PENDIENTE: C.warning, PROGRAMADA: C.warning, EN_VISITA: C.info,
  EN_PROCESO: C.success, GESTIONADO: C.success, VISITADO: C.success, FINALIZADA: C.info,
  REPROGRAMADO: C.warning, NO_ENCONTRADO: C.danger, CANCELADA: C.danger,
  ACTIVO: C.success, INACTIVO: '#6A7290', APTO: C.success, NO_APTO: C.danger,
};
export const money = (value: unknown) => Number(value || 0).toLocaleString('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 2 });
export const shortDate = (value: unknown) => value ? new Date(String(value)).toLocaleDateString('es-PE', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }) : '—';
