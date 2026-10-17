// Direcciones que el auditor puede visitar de un caso. Todo caso tiene el DOMICILIO de la persona; los créditos
// MYPE (tipo "OTROS") además traen los NEGOCIOS de la base (datos_negocio.negocios). El auditor elige a cuál ir
// y puede cambiar: la distancia, la geocerca de 100 m y «Cómo llegar» se miden contra la dirección elegida.
import { Alert, Linking } from "react-native";

export type Destino = "DOMICILIO" | "NEGOCIO";
export type Punto = { tipo: Destino; indice: number; etiqueta: string; direccion: string; lat: number | null; lng: number | null; origen: string | null };

const comoNumero = (v: any): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const unir = (...partes: any[]) => partes.filter(Boolean).join(", ");

export function puntosDe(e: any): Punto[] {
  const domicilio: Punto = {
    // Con la dirección normalizada (Avenida, Jirón…) Google Maps ubica mejor que con la abreviada de la base.
    tipo: "DOMICILIO", indice: 0, etiqueta: "Domicilio", direccion: unir(e.direccion_normalizada || e.direccion_domicilio, e.distrito, e.provincia),
    lat: comoNumero(e.latitud), lng: comoNumero(e.longitud), origen: e.ubicacion_origen ?? null,
  };
  if (e.tipo_credito !== "OTROS") return [domicilio];
  const negocios: any[] = Array.isArray(e.datos_negocio?.negocios) ? e.datos_negocio.negocios : [];
  const visitables = negocios.map((n, i) => ({ n, i })).filter(({ n }) => n.direccion || comoNumero(n.latitud) !== null);
  return [
    domicilio,
    ...visitables.map(({ n, i }): Punto => ({
      tipo: "NEGOCIO", indice: i, etiqueta: visitables.length > 1 ? `Negocio ${i + 1}` : "Negocio", direccion: unir(n.direccion, n.distrito),
      lat: comoNumero(n.latitud), lng: comoNumero(n.longitud), origen: n.ubicacion_origen ?? null,
    })),
  ];
}

export function puntoElegido(e: any, tipo: Destino = "DOMICILIO", indice = 0): Punto {
  const puntos = puntosDe(e);
  return puntos.find((p) => p.tipo === tipo && p.indice === indice) ?? puntos[0];
}

export const tieneCoordenadas = (p: Punto) => p.lat !== null && p.lng !== null;

export function abrirRuta(p: Punto, origen?: { latitude: number; longitude: number } | null) {
  const destino = tieneCoordenadas(p) ? `${p.lat},${p.lng}` : encodeURIComponent(p.direccion);
  const desde = origen ? `&origin=${origen.latitude},${origen.longitude}` : "";
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destino}${desde}`);
}

// Desde las listas: si el caso tiene más de una dirección, pregunta a cuál ir; si no, va directo.
export function comoLlegarA(e: any, origen?: { latitude: number; longitude: number } | null) {
  const puntos = puntosDe(e);
  if (puntos.length === 1) { abrirRuta(puntos[0], origen); return; }
  Alert.alert("¿A qué dirección vas?", "Elige una; dentro de la ficha puedes cambiar.", puntos.slice(0, 3).map((p) => ({ text: p.etiqueta, onPress: () => abrirRuta(p, origen) })), { cancelable: true });
}
