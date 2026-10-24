import React, { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { conMayusculas, FI, N, nombreDePersona } from "../theme";

// Tarjetas de los casos de la muestra, una por vez, con flechas a los lados (Figma «Mapa de mi muestra»). Al cambiar de tarjeta el mapa
// se centra en ese cliente: así el auditor recorre sus casos sin tocar el mapa.
export type CasoCarrusel = {
  id: number | string; nombres?: string; codigo?: string; direccion?: string; departamento?: string; distrito?: string;
  tipo: string; prioridad?: string; estadoTexto?: string; latitud: number; longitud: number;
};

const PRIORIDAD: Record<string, { t: string; bg: string; fg: string }> = {
  ALTA: { t: "Prioridad alta", bg: N.rojoFondo, fg: N.rojoTexto },
  MEDIA: { t: "Prioridad media", bg: N.ambarFondo, fg: N.ambar },
  BAJA: { t: "Prioridad baja", bg: N.gris, fg: N.grisTexto },
};

function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Del más cercano al más lejano encadenando (siempre al vecino más próximo), como la ruta del mapa.
export function ordenarPorCercania<T extends { latitud: number; longitud: number }>(origen: { latitude: number; longitude: number } | null | undefined, puntos: T[]): T[] {
  if (!origen) return puntos;
  const restantes = [...puntos];
  const salida: T[] = [];
  let actual = { latitud: origen.latitude, longitud: origen.longitude };
  while (restantes.length) {
    let idx = 0; let dMin = Infinity;
    restantes.forEach((p, i) => { const d = distanciaMetros(actual.latitud, actual.longitud, p.latitud, p.longitud); if (d < dMin) { dMin = d; idx = i; } });
    const [p] = restantes.splice(idx, 1);
    salida.push(p); actual = p;
  }
  return salida;
}

export default function CarruselCasos({ casos, onCambio }: { casos: CasoCarrusel[]; onCambio: (caso: CasoCarrusel) => void }) {
  const [ancho, setAncho] = useState(0);
  const [idx, setIdx] = useState(0);
  const lista = useRef<FlatList<CasoCarrusel>>(null);
  useEffect(() => { if (idx > 0 && idx >= casos.length) setIdx(Math.max(0, casos.length - 1)); }, [casos.length, idx]);
  if (!casos.length) return null;

  const ir = (n: number) => {
    const destino = Math.max(0, Math.min(casos.length - 1, n));
    if (destino === idx) return;
    setIdx(destino);
    lista.current?.scrollToOffset({ offset: destino * ancho, animated: true });
    onCambio(casos[destino]);
  };
  const alTerminarDeDeslizar = (x: number) => {
    const n = Math.max(0, Math.min(casos.length - 1, Math.round(x / Math.max(1, ancho))));
    if (n !== idx) { setIdx(n); onCambio(casos[n]); }
  };

  return (
    <View style={s.raiz}>
      <View style={s.fila}>
        <Pressable onPress={() => ir(idx - 1)} disabled={idx === 0} accessibilityRole="button" accessibilityLabel="Caso anterior" style={[s.lado, idx === 0 && s.ladoOff]}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={N.tinta} />
        </Pressable>
        <View style={s.centro} onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
          {ancho > 0 ? (
            <FlatList
              ref={lista}
              data={casos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(c) => String(c.id)}
              getItemLayout={(_, i) => ({ length: ancho, offset: ancho * i, index: i })}
              onMomentumScrollEnd={(e) => alTerminarDeDeslizar(e.nativeEvent.contentOffset.x)}
              renderItem={({ item }) => {
                const pr = PRIORIDAD[String(item.prioridad || "").toUpperCase()];
                return (
                  <View style={[s.tarjeta, { width: ancho }]}>
                    <View style={s.chips}>
                      <View style={[s.chip, { backgroundColor: N.suave }]}><Text style={[s.chipTexto, { color: N.marca }]}>{item.tipo === "OTROS" ? "MYPE" : "Consumo"}</Text></View>
                      {pr ? <View style={[s.chip, { backgroundColor: pr.bg }]}><Text style={[s.chipTexto, { color: pr.fg }]}>{pr.t}</Text></View> : null}
                    </View>
                    <Text style={s.nombre} numberOfLines={1}>{nombreDePersona(item.nombres) || "Cliente sin nombre"}</Text>
                    <Text style={s.codigo} numberOfLines={1}>{item.codigo}</Text>
                    <View style={s.linea} />
                    <Text style={s.direccion} numberOfLines={1}>{conMayusculas(item.direccion) || "Sin dirección registrada"}</Text>
                    <Text style={s.estado} numberOfLines={1}>{[item.estadoTexto, conMayusculas(item.departamento || item.distrito)].filter(Boolean).join(" · ")}</Text>
                  </View>
                );
              }}
            />
          ) : null}
        </View>
        <Pressable onPress={() => ir(idx + 1)} disabled={idx >= casos.length - 1} accessibilityRole="button" accessibilityLabel="Caso siguiente" style={[s.lado, idx >= casos.length - 1 && s.ladoOff]}>
          <MaterialCommunityIcons name="chevron-right" size={24} color={N.tinta} />
        </Pressable>
      </View>
      {casos.length > 1 ? <Text style={s.pista}>Desliza para ver las ubicaciones de las demás muestras</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  raiz: { gap: 8 },
  fila: { flexDirection: "row", alignItems: "stretch", gap: 6 },
  lado: { width: 30, borderRadius: 14, borderWidth: 1, borderColor: N.borde, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  ladoOff: { opacity: 0.45 },
  centro: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: N.borde, backgroundColor: "#fff", overflow: "hidden" },
  tarjeta: { padding: 14, gap: 4 },
  chips: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  chipTexto: { fontFamily: FI.semi, fontSize: 12.5 },
  nombre: { fontFamily: FI.bold, fontSize: 18, lineHeight: 24, color: N.tinta },
  codigo: { fontFamily: FI.reg, fontSize: 13.5, color: N.apagado, marginTop: -2 },
  linea: { height: 1, backgroundColor: N.borde2, marginVertical: 4 },
  direccion: { fontFamily: FI.reg, fontSize: 14.5, color: N.apagado },
  estado: { fontFamily: FI.reg, fontSize: 13.5, color: N.apagado },
  pista: { fontFamily: FI.reg, fontSize: 12, color: N.apagado },
});
