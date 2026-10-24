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
  hero: ['#E9EDFF', '#FFFFFF'] as const,
  glow: ['rgba(193,31,140,0.13)', 'rgba(193,31,140,0)'] as const,
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

// Diseño nuevo de inicio (Bienvenida, Inicio de sesión y Hoy): paleta y letra del Figma. Las demás pantallas siguen con C y F hasta que lleguen sus diseños.
export const N = {
  marca: '#4757B8', marca2: '#4C51B9', violeta: '#7B25CD', violeta2: '#7E22CE', verde: '#36CE28',
  tinta: '#20263D', apagado: '#626D88', borde: '#DEE2EF', suave: '#EFF0FC', fondo: '#F1F2F8', blanco: '#FFFFFF',
  rojo: '#FB0303', rojoTexto: '#A33C43', rojoFondo: '#FCEBED', ambar: '#8A5917', ambarFondo: '#FFF1D8', campo: '#F9FAFB',
  // segunda tanda de la paleta (pantallas de la ficha, Mi muestra, Mapa y Perfil)
  panel: '#F8F9FD', marino: '#15237A', borde2: '#E4E7EE', verdeTexto: '#267254', verdeFondo: '#E7F4ED', ambarBorde: '#F2C97D',
  rojoBoton: '#D1274F', rojoFuerte: '#BC1215', gris: '#EEF0F4', grisTexto: '#626D81', hueco: '#B3B9C8',
};
// Inter: una familia por peso (en Android el peso no se pide con fontWeight sino con el nombre de la familia).
export const FI = { light: 'Inter_300Light', reg: 'Inter_400Regular', med: 'Inter_500Medium', semi: 'Inter_600SemiBold', bold: 'Inter_700Bold' };
// «CARMEN ROSA HUAMAN» o «HUAMAN POMA, CARMEN ROSA» (como viene de la base) → «Carmen Rosa Huaman Poma»; las direcciones solo se pasan a minúsculas con inicial.
const MENORES = new Set(['de', 'del', 'y', 'e']);
export const conMayusculas = (texto?: string | null) =>
  String(texto || '').trim().toLowerCase().split(/\s+/).filter(Boolean).map((p, i) => (i > 0 && MENORES.has(p) ? p : p.replace(/^(\W*)(\p{L})/u, (_, a, l) => a + l.toUpperCase()))).join(' ');
// Estado de la asignación, como se lo lee el auditor (la asignación está «activa» mientras la visita sigue pendiente).
const ESTADOS_CASO: Record<string, string> = { ACTIVA: 'Pendiente', FINALIZADA: 'Visitado', CANCELADA: 'Cancelado', EN_VISITA: 'En visita', PROGRAMADA: 'Programada', REPROGRAMADO: 'Reprogramado' };
export const estadoDeCaso = (e?: string | null) => ESTADOS_CASO[String(e || '').toUpperCase()] || conMayusculas(String(e || '').replaceAll('_', ' '));
export const nombreDePersona = (raw?: string | null) => {
  const partes = String(raw || '').split(',');
  return conMayusculas(partes.length === 2 && partes[0].trim() && partes[1].trim() ? `${partes[1].trim()} ${partes[0].trim()}` : String(raw || ''));
};
