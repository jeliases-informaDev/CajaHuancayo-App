// Direcciones que el auditor puede visitar de un caso. Todo caso tiene el DOMICILIO de la persona; los créditos
// MYPE (tipo "OTROS") además traen los NEGOCIOS de la base (datos_negocio.negocios). El auditor elige a cuál ir
// y puede cambiar: la distancia, la geocerca de 100 m y «Cómo llegar» se miden contra la dirección elegida.
import { Alert, Linking } from "react-native";

export type Destino = "DOMICILIO" | "NEGOCIO";
// zona*: ubicación APROXIMADA conocida cuando todavía no hay referencia (lat/lng nulos): la zona que encontró el mapa o la que dejaron visitas
// vecinas. Sirve para llegar y para saber si se está en la zona; el punto exacto lo fija la primera visita.
export type Punto = {
  tipo: Destino; indice: number; etiqueta: string; direccion: string; lat: number | null; lng: number | null; origen: string | null;
  zonaLat: number | null; zonaLng: number | null; zonaPrecision: string | null;
};
const zonaDe = (lat: number | null, g: any) => (lat === null && g ? { zonaLat: comoNumero(g.latitud), zonaLng: comoNumero(g.longitud), zonaPrecision: g.precision ?? null } : { zonaLat: null, zonaLng: null, zonaPrecision: null });

const comoNumero = (v: any): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const unir = (...partes: any[]) => partes.filter(Boolean).join(", ");

export function puntosDe(e: any): Punto[] {
  const domicilio: Punto = {
    // Con la dirección normalizada (Avenida, Jirón…) Google Maps ubica mejor que con la abreviada de la base.
    tipo: "DOMICILIO", indice: 0, etiqueta: "Domicilio", direccion: unir(e.direccion_normalizada || e.direccion_domicilio, e.distrito, e.provincia),
    lat: comoNumero(e.latitud), lng: comoNumero(e.longitud), origen: e.ubicacion_origen ?? null,
    ...zonaDe(comoNumero(e.latitud), { latitud: e.geo_latitud, longitud: e.geo_longitud, precision: e.geo_precision }),
  };
  if (e.tipo_credito !== "OTROS") return [domicilio];
  const negocios: any[] = Array.isArray(e.datos_negocio?.negocios) ? e.datos_negocio.negocios : [];
  const visitables = negocios.map((n, i) => ({ n, i })).filter(({ n }) => n.direccion || comoNumero(n.latitud) !== null);
  return [
    domicilio,
    ...visitables.map(({ n, i }): Punto => ({
      tipo: "NEGOCIO", indice: i, etiqueta: visitables.length > 1 ? `Negocio ${i + 1}` : "Negocio", direccion: unir(n.direccion, n.distrito),
      lat: comoNumero(n.latitud), lng: comoNumero(n.longitud), origen: n.ubicacion_origen ?? null,
      ...zonaDe(comoNumero(n.latitud), n.geo),
    })),
  ];
}

export function puntoElegido(e: any, tipo: Destino = "DOMICILIO", indice = 0): Punto {
  const puntos = puntosDe(e);
  return puntos.find((p) => p.tipo === tipo && p.indice === indice) ?? puntos[0];
}

export const tieneCoordenadas = (p: Punto) => p.lat !== null && p.lng !== null;
export const tieneZona = (p: Punto) => !tieneCoordenadas(p) && p.zonaLat !== null && p.zonaLng !== null;

export function abrirRuta(p: Punto, origen?: { latitude: number; longitude: number } | null) {
  const destino = tieneCoordenadas(p) ? `${p.lat},${p.lng}` : tieneZona(p) ? `${p.zonaLat},${p.zonaLng}` : encodeURIComponent(p.direccion);
  const desde = origen ? `&origin=${origen.latitude},${origen.longitude}` : "";
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destino}${desde}`);
}

// Desde las listas: si el caso tiene más de una dirección, pregunta a cuál ir; si no, va directo.
export function comoLlegarA(e: any, origen?: { latitude: number; longitude: number } | null) {
  const puntos = puntosDe(e);
  if (puntos.length === 1) { abrirRuta(puntos[0], origen); return; }
  Alert.alert("¿A qué dirección vas?", "Elige una; dentro de la ficha puedes cambiar.", puntos.slice(0, 3).map((p) => ({ text: p.etiqueta, onPress: () => abrirRuta(p, origen) })), { cancelable: true });
}
