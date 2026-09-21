import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "../AuthContext";
import { C } from "../theme";
import GeoFilterBar, { GEO_FILTRO_TODOS, GeoFiltro, matchesGeoFiltro } from "../components/GeoFilterBar";

// Mapa real para el navegador (expo-web no soporta react-native-webview, que es lo
// que usa el mapa nativo de Android). Mismo Leaflet + OpenStreetMap que ya usa el
// panel del supervisor, para que se vea y se sienta igual.
const filters = ["TODOS", "CONSUMO", "OTROS"] as const;
const labels: Record<string, string> = { TODOS: "Todos", CONSUMO: "Consumo", OTROS: "Otros (MYPE)" };
const colors: Record<string, string> = { CONSUMO: "#2563EB", OTROS: "#F59E0B" };
const CENTER: [number, number] = [-12.0653, -75.2049];
const RUTA_COLOR = "#0ead7a";

// Distancia entre dos coordenadas (Haversine), en metros — mismo criterio que el
// panel del supervisor y el backend.
function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Ordena los puntos como una ruta real: en cada paso, salta al más cercano a la
// posición actual (vecino más próximo), partiendo de "mi" ubicación.
function ordenarPorRuta<T extends { latitud: number; longitud: number }>(
  origen: { latitude: number; longitude: number }, puntos: T[]
): (T & { orden: number; distanciaDesdeMi: number })[] {
  const restantes = [...puntos];
  const ordenados: (T & { orden: number; distanciaDesdeMi: number })[] = [];
  let actual = { latitud: origen.latitude, longitud: origen.longitude };
  let orden = 1;
  while (restantes.length) {
    let idxMin = 0;
    let distMin = Infinity;
    restantes.forEach((p, i) => {
      const d = distanciaMetros(actual.latitud, actual.longitud, p.latitud, p.longitud);
      if (d < distMin) { distMin = d; idxMin = i; }
    });
    const [siguiente] = restantes.splice(idxMin, 1);
    ordenados.push({ ...siguiente, orden: orden++, distanciaDesdeMi: distanciaMetros(origen.latitude, origen.longitude, siguiente.latitud, siguiente.longitud) });
    actual = siguiente;
  }
  return ordenados;
}

function normalizePoint(item: any) {
  const expediente = item.expediente || item;
  return {
    id: expediente.id_expediente,
    latitud: Number(expediente.latitud),
    longitud: Number(expediente.longitud),
    nombres: expediente.nombres_cliente,
    distrito: expediente.distrito,
    provincia: expediente.provincia,
    departamento: expediente.departamento,
    direccion: expediente.direccion_domicilio,
    telefono: expediente.telefono_cliente,
    codigo: expediente.codigo_expediente,
    monto: Number(expediente.monto_desembolso || 0),
    tipo: expediente.tipo_credito || "CONSUMO",
  };
}

// Paradas "en ruta": burbuja verde numerada, ordenadas por cercanía desde mi ubicación.
function routeStopIcon(n: number) {
  return L.divIcon({
    className: "",
    html: `<div style="width:24px;height:24px;border-radius:50%;background:${RUTA_COLOR};border:2px solid #fff;box-shadow:0 2px 6px rgba(14,173,122,.45);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:11px">${n}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

// Mientras no se tenga la ubicación actual todavía no hay desde dónde calcular la
// ruta — se muestra el cliente igual, con el pin de color por tipo de antes.
function sinRutaIcon(tipo: string) {
  const color = colors[tipo] || "#334155";
  return L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(7,27,67,.4)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 16],
  });
}

const disponibleIcon = L.divIcon({
  className: "",
  html: `<div style="width:12px;height:12px;border-radius:50%;background:#334155;border:2px solid #fff;box-shadow:0 0 0 1px #33415566"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

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
  const [geoFiltro, setGeoFiltro] = useState<GeoFiltro>(GEO_FILTRO_TODOS);
  const [loading, setLoading] = useState(false);
  // Punto de partida simulado: se arrastra "mi ubicación" para planificar la ruta
  // desde otro punto sin perder el GPS real en vivo.
  const [puntoManual, setPuntoManual] = useState<{ latitude: number; longitude: number } | null>(null);
  const origen = puntoManual ?? currentLocation ?? null;

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
  const enFiltro = useMemo(() => points.filter((p) => matchesGeoFiltro(p, geoFiltro)), [points, geoFiltro]);
  const fueraDeFiltro = useMemo(() => points.filter((p) => !matchesGeoFiltro(p, geoFiltro)), [points, geoFiltro]);

  // Ruta sugerida: desde el punto de partida (real o simulado), salta siempre al
  // cliente más cercano restante. Sin ubicación todavía no hay desde dónde calcularla.
  const enRuta = useMemo(() => (origen ? ordenarPorRuta(origen, enFiltro) : []), [origen, enFiltro]);
  const sinUbicacion = useMemo(() => (origen ? [] : enFiltro), [origen, enFiltro]);
  const rutaSugerida = useMemo<[number, number][]>(() => {
    if (!origen || !enRuta.length) return [];
    return [[origen.latitude, origen.longitude], ...enRuta.map((p) => [p.latitud, p.longitud] as [number, number])];
  }, [origen, enRuta]);

  const bounds = useMemo<[number, number][]>(() => {
    const coords = points.map((p) => [p.latitud, p.longitud] as [number, number]);
    if (origen) coords.push([origen.latitude, origen.longitude]);
    return coords;
  }, [points, origen]);

  const fmtDistancia = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`);

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
            <Text style={s.sub}>
              {origen ? `${enRuta.length} en ruta` : `${enFiltro.length} en tu zona`}
              {fueraDeFiltro.length ? ` · ${fueraDeFiltro.length} disponible(s)` : ""}
              {!origen && enFiltro.length ? " · esperando tu ubicación para armar la ruta" : ""}
            </Text>
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
        <GeoFilterBar items={points} onChange={setGeoFiltro} />
        {puntoManual ? (
          <View style={s.simBanner}>
            <Text style={s.simText}>Ruta simulada desde un punto manual.</Text>
            <Pressable onPress={() => setPuntoManual(null)}>
              <Text style={s.simReset}>Usar ubicación en vivo</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={s.mapWrap}>
        <MapContainer center={CENTER} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitBounds coords={bounds} />
          {origen ? (
            <Marker
              position={[origen.latitude, origen.longitude]}
              icon={meIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = (e.target as L.Marker).getLatLng();
                  setPuntoManual({ latitude: lat, longitude: lng });
                },
              }}
            >
              <Popup>{puntoManual ? "Punto de partida simulado" : "Mi ubicación (inicio)"}<br /><em>Arrastra para planificar desde otro punto.</em></Popup>
            </Marker>
          ) : null}
          {rutaSugerida.length > 1 ? <Polyline positions={rutaSugerida} pathOptions={{ color: RUTA_COLOR, weight: 4, opacity: 0.8 }} /> : null}
          {enRuta.map((p) => (
            <Marker key={p.id} position={[p.latitud, p.longitud]} icon={routeStopIcon(p.orden)}>
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <strong>{p.orden}. {p.nombres}</strong>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{p.codigo} · {p.distrito}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{p.direccion}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{fmtDistancia(p.distanciaDesdeMi)} desde mi ubicación</div>
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
          {fueraDeFiltro.map((p) => (
            <Marker key={p.id} position={[p.latitud, p.longitud]} icon={disponibleIcon}>
              <Popup>
                <div style={{ minWidth: 160 }}>
                  <strong>{p.nombres}</strong>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{p.distrito}</div>
                  <em style={{ fontSize: 11 }}>Fuera del filtro geográfico</em>
                </div>
              </Popup>
            </Marker>
          ))}
          {sinUbicacion.map((p) => (
            <Marker key={p.id} position={[p.latitud, p.longitud]} icon={sinRutaIcon(p.tipo)}>
              <Popup>
                <div style={{ minWidth: 160 }}>
                  <strong>{p.nombres}</strong>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{p.codigo} · {p.distrito}</div>
                  <em style={{ fontSize: 11 }}>Obteniendo tu ubicación para calcular la ruta…</em>
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
  simBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, backgroundColor: "#EAF1FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  simText: { fontSize: 11, color: C.text, flexShrink: 1 },
  simReset: { fontSize: 11, fontWeight: "800", color: "#1236C7" },
  mapWrap: { flex: 1, minHeight: 420 },
  empty: { position: "absolute", top: "45%", left: 24, right: 24, alignItems: "center", gap: 6, backgroundColor: "#FFFFFFF2", borderRadius: 18, padding: 18 },
  emptyTitle: { fontSize: 14, fontWeight: "900", color: C.text },
  emptyText: { fontSize: 11, lineHeight: 16, textAlign: "center", color: C.muted },
});
