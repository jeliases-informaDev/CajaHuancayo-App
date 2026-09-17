export const C = {
  navy: '#071B43', navy2: '#0A2B67', primary: '#1236C7', primary2: '#315CEB',
  red: '#F4323C', redDark: '#D8202A', bg: '#F4F7FC', surface: '#FFFFFF',
  surface2: '#F8FAFD', text: '#172033', muted: '#6D788A', border: '#E1E7F0',
  success: '#0EAD7A', warning: '#F59E0B', danger: '#EF4444', info: '#2C70E8', purple: '#7C3AED',
};
export const statusColors: Record<string, string> = {
  LIBRE: '#334155', PENDIENTE: C.warning, PROGRAMADA: C.warning, EN_VISITA: C.info,
  EN_PROCESO: C.success, GESTIONADO: C.success, VISITADO: C.success, FINALIZADA: C.info,
  REPROGRAMADO: C.warning, NO_ENCONTRADO: C.danger, CANCELADA: C.danger,
  ACTIVO: C.success, INACTIVO: '#94A3B8', APTO: C.success, NO_APTO: C.danger,
};
export const money = (value: unknown) => Number(value || 0).toLocaleString('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 2 });
export const shortDate = (value: unknown) => value ? new Date(String(value)).toLocaleDateString('es-PE', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }) : '—';

