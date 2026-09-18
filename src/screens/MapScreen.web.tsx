import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "../AuthContext";
import { C } from "../theme";

// Mapa real para el navegador (expo-web no soporta react-native-webview, que es lo
// que usa el mapa nativo de Android). Mismo Leaflet + OpenStreetMap que ya usa el
// panel del supervisor, para que se vea y se sienta igual.
const filters = ["TODOS", "CONSUMO", "OTROS"] as const;
const labels: Record<string, string> = { TODOS: "Todos", CONSUMO: "Consumo", OTROS: "Otros (MYPE)" };
const colors: Record<string, string> = { CONSUMO: "#2563EB", OTROS: "#F59E0B" };
const CENTER: [number, number] = [-12.0653, -75.2049];

function normalizePoint(item: any) {
  const expediente = item.expediente || item;
  return {
    id: expediente.id_expediente,
    latitud: Number(expediente.latitud),
    longitud: Number(expediente.longitud),
    nombres: expediente.nombres_cliente,
    distrito: expediente.distrito,
    direccion: expediente.direccion_domicilio,
    telefono: expediente.telefono_cliente,
    codigo: expediente.codigo_expediente,
    monto: Number(expediente.monto_desembolso || 0),
    tipo: expediente.tipo_credito || "CONSUMO",
  };
}

function clientIcon(tipo: string) {
  const color = colors[tipo] || "#334155";
  return L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(7,27,67,.4)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 16],
  });
}

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length) map.fitBounds(coords, { padding: [40, 40], maxZoom: 15 });
  }, [coords.length, coords.map((c) => c.join(",")).join("|")]);
  return null;
}

const meIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#0B22A1;border:3px solid #38BDF8;box-shadow:0 0 0 4px rgba(56,189,248,.35)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function MapScreenWeb({ currentLocation }: { refreshRevision?: number; currentLocation?: { latitude: number; longitude: number } | null }) {
  const { api } = useAuth();
  const [all, setAll] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("TODOS");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response: any = await api("/api/asignaciones/mias");
      const next = (response.data || []).map(normalizePoint).filter((p: any) => Number.isFinite(p.latitud) && Number.isFinite(p.longitud));
      setAll(next);
    } catch {
      setAll([]);
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const points = useMemo(() => all.filter((p) => filter === "TODOS" || p.tipo === filter), [all, filter]);
  const bounds = useMemo<[number, number][]>(() => {
    const coords = points.map((p) => [p.latitud, p.longitud] as [number, number]);
    if (currentLocation) coords.push([currentLocation.latitude, currentLocation.longitude]);
    return coords;
  }, [points, currentLocation]);

  const comoLlegar = (lat: number, lng: number) => {
    const origin = currentLocation ? `&origin=${currentLocation.latitude},${currentLocation.longitude}` : "";
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${origin}`);
  };

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View style={s.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Mapa de mi muestra</Text>
            <Text style={s.sub}>{points.length} expediente(s) · OpenStreetMap</Text>
          </View>
          <View style={s.live}>
            <View style={s.dot} />
            <Text style={s.liveText}>{loading ? "Actualizando" : "En línea"}</Text>
          </View>
        </View>
        <View style={s.filters}>
          {filters.map((item) => (
            <Pressable key={item} onPress={() => setFilter(item)} style={[s.chip, filter === item && s.chipOn]}>
              <View style={[s.chipDot, { backgroundColor: item === "TODOS" ? "#94A3B8" : colors[item] }]} />
              <Text style={[s.chipText, filter === item && s.chipTextOn]}>{labels[item]}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={s.mapWrap}>
        <MapContainer center={CENTER} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitBounds coords={bounds} />
          {currentLocation ? (
            <Marker position={[currentLocation.latitude, currentLocation.longitude]} icon={meIcon}>
              <Popup>Mi ubicación</Popup>
            </Marker>
          ) : null}
          {currentLocation ? points.map((p) => (
            <Polyline
              key={`line-${p.id}`}
              positions={[[currentLocation.latitude, currentLocation.longitude], [p.latitud, p.longitud]]}
              pathOptions={{ color: colors[p.tipo] || "#334155", weight: 2.5, opacity: 0.55, dashArray: "6 8" }}
            />
          )) : null}
          {points.map((p) => (
            <Marker key={p.id} position={[p.latitud, p.longitud]} icon={clientIcon(p.tipo)}>
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <strong>{p.nombres}</strong>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{p.codigo} · {p.distrito}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{p.direccion}</div>
                  {p.monto ? <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>Monto: S/ {p.monto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</div> : null}
                  <button
                    onClick={() => comoLlegar(p.latitud, p.longitud)}
                    style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, border: 0, background: "#1236c7", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                  >
                    Cómo llegar
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </View>
      {!loading && !points.length ? (
        <View style={s.empty}>
          <MaterialCommunityIcons name="map-marker-off-outline" size={30} color={C.primary} />
          <Text style={s.emptyTitle}>Sin expedientes ubicados</Text>
          <Text style={s.emptyText}>No hay coordenadas disponibles para este filtro.</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#EAF1F8" },
  header: { backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, gap: 11, borderBottomWidth: 1, borderBottomColor: C.border },
  headRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 22, fontWeight: "900", color: C.text },
  sub: { fontSize: 11, color: C.muted, marginTop: 3 },
  live: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EAFBF5", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 14 },
  dot: { width: 6, height: 6, borderRadius: 6, backgroundColor: C.success },
  liveText: { fontSize: 9, fontWeight: "900", color: C.success },
  filters: { flexDirection: "row", gap: 7 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 18, backgroundColor: "#F1F4F8" },
  chipOn: { backgroundColor: C.primary },
  chipDot: { width: 6, height: 6, borderRadius: 6 },
  chipText: { fontSize: 10, fontWeight: "800", color: C.text },
  chipTextOn: { color: "#fff" },
  mapWrap: { flex: 1, minHeight: 420 },
  empty: { position: "absolute", top: "45%", left: 24, right: 24, alignItems: "center", gap: 6, backgroundColor: "#FFFFFFF2", borderRadius: 18, padding: 18 },
  emptyTitle: { fontSize: 14, fontWeight: "900", color: C.text },
  emptyText: { fontSize: 11, lineHeight: 16, textAlign: "center", color: C.muted },
});
