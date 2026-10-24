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
// Sombras con el tinte azul de la marca (nunca negro puro).
export const shadow = {
  sm: { shadowColor: '#0E1332', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  md: { shadowColor: '#0E1332', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
};
export const initials = (name?: string | null) => (String(name || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?');
export const money = (value: unknown) => Number(value || 0).toLocaleString('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 2 });

// Diseño nuevo de inicio (Bienvenida, Inicio de sesión y Hoy): paleta y letra del Figma. Las demás pantallas siguen con C y F hasta que lleguen sus diseños.
export const N = {
  marca: '#4757B8', marca2: '#4C51B9', violeta: '#7B25CD', violeta2: '#7E22CE', verde: '#36CE28',
  tinta: '#20263D', apagado: '#626D88', borde: '#DEE2EF', suave: '#EFF0FC', fondo: '#F1F2F8', blanco: '#FFFFFF',
  rojo: '#FB0303', rojoTexto: '#A33C43', rojoFondo: '#FCEBED', ambar: '#8A5917', ambarFondo: '#FFF1D8', campo: '#F9FAFB',
  // segunda tanda de la paleta (pantallas de la ficha, Mi muestra, Mapa y Perfil)
  panel: '#F8F9FD', marino: '#15237A', borde2: '#E4E7EE', verdeTexto: '#267254', verdeFondo: '#E7F4ED', ambarBorde: '#F2C97D',
  rojoBoton: '#D1274F', rojoFuerte: '#BC1215', gris: '#EEF0F4', grisTexto: '#626D81', hueco: '#B3B9C8',
};
// Tipografía de la web (Be Vietnam Pro) y, para los rótulos en mayúsculas, Beiruti. En Android el peso no se pide con fontWeight sino con el nombre de la familia.
// La web no usa 700: «bold» es la semibold, igual que sus títulos.
export const FI = { light: 'BeVietnamPro_300Light', reg: 'BeVietnamPro_400Regular', med: 'BeVietnamPro_500Medium', semi: 'BeVietnamPro_600SemiBold', bold: 'BeVietnamPro_600SemiBold', etiquetaLigera: 'Beiruti_300Light', etiqueta: 'Beiruti_400Regular', etiquetaFuerte: 'Beiruti_600SemiBold' };
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
