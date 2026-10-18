import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { renderToStaticMarkup } from "react-dom/server";
import { useAuth } from "../AuthContext";
import { C } from "../theme";
import GeoFilterBar, { GEO_FILTRO_TODOS, GeoFiltro, matchesGeoFiltro } from "../components/GeoFilterBar";

// Mapa real para el navegador (expo-web no soporta react-native-webview, que es lo
// que usa el mapa nativo de Android). Mismo Leaflet + OpenStreetMap que ya usa el
// panel del supervisor, para que se vea y se sienta igual.
const filters = ["TODOS", "CONSUMO", "OTROS"] as const;
const labels: Record<string, string> = { TODOS: "Todos", CONSUMO: "Consumo", OTROS: "Otros (MYPE)" };
const colors: Record<string, string> = { CONSUMO: "#2563EB", OTROS: "#F59E0B" };
const PRIORIDAD_COLORS: Record<string, string> = { ALTA: "#ef4444", MEDIA: "#f59e0b", BAJA: "#6d788a" };
// Sin casos ni GPS el mapa abre en Lima (la app es de alcance nacional); con puntos se encuadra solo.
const CENTER: [number, number] = [-12.0464, -77.0428];
const RUTA_COLOR = "#0ead7a";
const GEOCERCA_M = 100; // radio de la geocerca del servidor (por defecto 100 m): se dibuja alrededor del cliente señalado
const LEJOS_M = 60_000; // más allá de esto un caso se considera de otra zona y no entra en el encuadre automático

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

const fmtDistancia = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`);
const fmtMonto = (monto: number, moneda?: string) => (monto > 0 ? (moneda === "USD" ? "US$ " : "S/ ") + monto.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null);
const escHtml = (t: string) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

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
    moneda: expediente.moneda,
    asesor: expediente.asesor_responsable,
    prioridad: String(item.prioridad || "MEDIA").toUpperCase(),
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

const meIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#0B22A1;border:3px solid #38BDF8;box-shadow:0 0 0 4px rgba(56,189,248,.35)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

type Punto = ReturnType<typeof normalizePoint> & { orden?: number; distanciaDesdeMi?: number; disponible?: boolean };

// La tarjeta que se ve al tocar cualquier cliente (paradas de la ruta o no): lo que el auditor necesita antes de salir hacia allá.
const chipBase: React.CSSProperties = { display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 700 };
const botonBase: React.CSSProperties = { display: "inline-block", padding: "7px 12px", borderRadius: 10, background: "#1236c7", color: "#fff", fontWeight: 700, fontSize: 12.5, textDecoration: "none" };
function TarjetaCliente({ p, distancia }: { p: Punto; distancia: number | null }) {
  const monto = fmtMonto(p.monto, p.moneda);
  const lugar = [p.direccion, p.distrito].filter(Boolean).join(", ");
  const pc = PRIORIDAD_COLORS[p.prioridad] || "#334155";
  const tc = colors[p.tipo] || "#334155";
  return (
    <div style={{ minWidth: 215, fontSize: 13, lineHeight: 1.45 }}>
      <strong style={{ fontSize: 14.5 }}>{p.orden ? p.orden + ". " : ""}{p.nombres}</strong>
      <div style={{ fontSize: 12, color: "#64748b" }}>{p.codigo}</div>
      {lugar ? <div style={{ marginTop: 3 }}>{lugar}</div> : null}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "7px 0 3px" }}>
        <span style={{ ...chipBase, background: tc + "22", color: tc }}>{p.tipo === "OTROS" ? "MYPE" : "Consumo"}</span>
        <span style={{ ...chipBase, background: pc + "22", color: pc }}>Prioridad {p.prioridad.toLowerCase()}</span>
        {p.disponible ? <span style={{ ...chipBase, background: "#f1f5f9", color: "#64748b" }}>Fuera del filtro</span> : null}
      </div>
      {monto ? <div>Desembolso: <b>{monto}</b></div> : null}
      {p.asesor ? <div>Asesor: {p.asesor}</div> : null}
      {p.telefono ? <div>Teléfono: <b>{p.telefono}</b></div> : null}
      {distancia != null ? <div style={{ fontWeight: 700, color: "#1236c7", marginTop: 3 }}>{fmtDistancia(distancia)} desde mi ubicación</div> : null}
      <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
        <a href="#llegar" data-llegar={p.id} style={botonBase}>Cómo llegar</a>
        {p.telefono ? <a href={"tel:" + String(p.telefono).replace(/\s/g, "")} style={{ ...botonBase, background: "#eef2ff", color: "#1236c7" }}>Llamar</a> : null}
      </div>
    </div>
  );
}

// Clientes agrupados: de lejos son burbujas con el número de casos (del color de la prioridad más alta que contienen); al tocar una se ve
// su resumen (cuántos, de qué prioridad, cuáles) y «Acercar» abre el grupo. Al señalar un cliente se dibuja su geocerca de 100 m.
function ClientesAgrupados({ puntos, origen, onLlegar }: { puntos: Punto[]; origen: { latitude: number; longitude: number } | null; onLlegar: (lat: number, lng: number) => void }) {
  const map = useMap();
  const datos = useRef({ puntos, origen, onLlegar });
  datos.current = { puntos, origen, onLlegar };
  // Los casos se reciben de nuevo cada 30 s: el grupo solo se reconstruye si cambió algo (así no se cierra lo que el auditor abrió).
  const clave = puntos.map((p) => p.id + ":" + (p.orden ?? "-") + ":" + (p.disponible ? "d" : "r") + ":" + p.prioridad).join(",");
  useEffect(() => {
    const grupo = L.markerClusterGroup({
      showCoverageOnHover: false, maxClusterRadius: 46, spiderfyOnMaxZoom: true, chunkedLoading: true, zoomToBoundsOnClick: false,
      iconCreateFunction: (c) => {
        const prios = c.getAllChildMarkers().map((m) => (m.options as any).prioridad as string);
        const color = prios.includes("ALTA") ? PRIORIDAD_COLORS.ALTA : prios.includes("MEDIA") ? PRIORIDAD_COLORS.MEDIA : "#2563EB";
        return L.divIcon({ html: '<div style="width:38px;height:38px;border-radius:50%;background:' + color + ';color:#fff;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font:700 13px sans-serif">' + c.getChildCount() + "</div>", className: "", iconSize: [38, 38] });
      },
    });
    const halo = L.layerGroup().addTo(map);
    grupo.on("clusterclick", (ev) => {
      const hijos = ev.layer.getAllChildMarkers();
      const cuenta: Record<string, number> = {};
      hijos.forEach((m: L.Marker) => { const p = (m.options as any).prioridad as string; cuenta[p] = (cuenta[p] || 0) + 1; });
      const chips = ["ALTA", "MEDIA", "BAJA"].filter((p) => cuenta[p]).map((p) => '<span style="display:inline-block;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:700;background:' + PRIORIDAD_COLORS[p] + "22;color:" + PRIORIDAD_COLORS[p] + '">' + cuenta[p] + " " + p.toLowerCase() + "</span>").join(" ");
      const nombres = hijos.slice(0, 5).map((m: L.Marker) => "<li>" + escHtml(m.options.title || "") + "</li>").join("") + (hijos.length > 5 ? '<li style="list-style:none;margin-left:-18px;color:#64748b">y ' + (hijos.length - 5) + " más</li>" : "");
      const popup = L.popup({ minWidth: 220, maxWidth: 280 }).setLatLng(ev.layer.getLatLng())
        .setContent('<div style="font-size:13px;line-height:1.45"><strong style="font-size:14.5px">' + hijos.length + ' casos en este punto</strong><div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0">' + chips + '</div><ul style="margin:4px 0 8px;padding-left:18px">' + nombres + '</ul><a href="#acercar" data-acercar style="display:inline-block;padding:7px 12px;border-radius:10px;background:#1236c7;color:#fff;font-weight:700;font-size:12.5px;text-decoration:none">Acercar para verlos</a></div>')
        .openOn(map);
      const abrirGrupo = () => {
        map.closePopup();
        // Si al llegar al zoom máximo siguen juntos (mismo edificio o misma dirección), se abren en abanico para poder tocarlos uno por uno.
        const separar = () => {
          const padre = (hijos[0] as any).__parent;
          if (padre && padre.spiderfy && map.getZoom() >= map.getMaxZoom() && map.hasLayer(padre) && padre.getChildCount() > 1) padre.spiderfy();
        };
        if (map.getZoom() >= map.getMaxZoom()) { separar(); return; }
        ev.layer.zoomToBounds({ padding: [50, 50] });
        map.once("moveend", () => setTimeout(separar, 700));
      };
      popup.getElement()?.querySelector("[data-acercar]")?.addEventListener("click", (c) => { c.preventDefault(); abrirGrupo(); });
    });
    for (const p of datos.current.puntos) {
      const icono = p.orden ? routeStopIcon(p.orden) : p.disponible ? disponibleIcon : sinRutaIcon(p.tipo);
      const m = L.marker([p.latitud, p.longitud], { icon: icono, title: p.nombres, prioridad: p.prioridad } as L.MarkerOptions);
      // La tarjeta se arma al abrirla: así la distancia usa la ubicación del auditor en ese momento.
      m.bindPopup(() => renderToStaticMarkup(<TarjetaCliente p={p} distancia={datos.current.origen ? distanciaMetros(datos.current.origen.latitude, datos.current.origen.longitude, p.latitud, p.longitud) : null} />), { minWidth: 230, maxWidth: 300 });
      const dibujarGeocerca = () => { halo.clearLayers(); L.circle([p.latitud, p.longitud], { radius: GEOCERCA_M, color: PRIORIDAD_COLORS[p.prioridad] || "#334155", weight: 1.5, dashArray: "4 4", fillOpacity: 0.08 }).addTo(halo); };
      m.on("mouseover", dibujarGeocerca);
      m.on("mouseout", () => halo.clearLayers());
      m.on("popupopen", (ev) => {
        dibujarGeocerca();
        const enlace = ev.popup.getElement()?.querySelector("a[data-llegar]");
        if (enlace) enlace.addEventListener("click", (c) => { c.preventDefault(); datos.current.onLlegar(p.latitud, p.longitud); });
      });
      m.on("popupclose", () => halo.clearLayers());
      grupo.addLayer(m);
    }
    map.addLayer(grupo);
    return () => { map.removeLayer(grupo); map.removeLayer(halo); };
  }, [clave, map]);
  return null;
}

// Cámara del mapa: un solo lugar decide a dónde mira. El encuadre automático toma solo los casos cercanos al auditor (no el país entero);
// «Centrarme» vuela a su ubicación y «Ver todo» abarca todos los casos, pero porque se pidió.
type Camara = { n: number; modo: "yo" | "ruta"; punto?: [number, number]; coords?: [number, number][] };
function CamaraMapa({ camara }: { camara: Camara | null }) {
  const map = useMap();
  useEffect(() => {
    if (!camara) return;
    if (camara.modo === "yo" && camara.punto) map.flyTo(camara.punto, Math.max(map.getZoom(), 15), { duration: 1.1 });
    else if (camara.coords?.length) map.fitBounds(camara.coords, { padding: [40, 40], maxZoom: 15, animate: false });
  }, [camara?.n]);
  return null;
}

export default function MapScreenWeb({ currentLocation }: { refreshRevision?: number; currentLocation?: { latitude: number; longitude: number } | null }) {
  const { api } = useAuth();
  const [all, setAll] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("TODOS");
  const [geoFiltro, setGeoFiltro] = useState<GeoFiltro>(GEO_FILTRO_TODOS);
  const [loading, setLoading] = useState(false);
  const [camara, setCamara] = useState<Camara | null>(null);
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
  const rutaSugerida = useMemo<[number, number][]>(() => {
    if (!origen || !enRuta.length) return [];
    return [[origen.latitude, origen.longitude], ...enRuta.map((p) => [p.latitud, p.longitud] as [number, number])];
  }, [origen, enRuta]);

  // Todos los casos en un solo grupo de marcadores: numerados si van en la ruta, grises si quedan fuera del filtro.
  const puntosMapa = useMemo<Punto[]>(() => [
    ...(origen ? enRuta : enFiltro),
    ...fueraDeFiltro.map((p) => ({ ...p, disponible: true })),
  ], [origen, enRuta, enFiltro, fueraDeFiltro]);

  const siguiente = enRuta[0] || null;
  const rutaKm = rutaSugerida.reduce((suma, p, i) => (i === 0 ? 0 : suma + distanciaMetros(rutaSugerida[i - 1][0], rutaSugerida[i - 1][1], p[0], p[1])), 0);
  const lejanos = origen ? enFiltro.filter((p) => distanciaMetros(origen.latitude, origen.longitude, p.latitud, p.longitud) > LEJOS_M).length : 0;

  const mover = (c: Omit<Camara, "n">) => setCamara({ ...c, n: Date.now() + Math.random() });
  // Encuadre automático: solo lo cercano al auditor (o al primer caso si aún no hay GPS), al cargar, al cambiar de filtro o al llegar el GPS.
  const coordsCercanos = useMemo<[number, number][]>(() => {
    if (!points.length) return [];
    const base: [number, number] = origen ? [origen.latitude, origen.longitude] : [points[0].latitud, points[0].longitud];
    const cerca = points.filter((p) => distanciaMetros(base[0], base[1], p.latitud, p.longitud) <= LEJOS_M).map((p) => [p.latitud, p.longitud] as [number, number]);
    return origen ? [base, ...cerca] : cerca;
  }, [points, origen]);
  const claveVista = [filter, JSON.stringify(geoFiltro), points.length > 0 ? "datos" : "vacio", origen ? "gps" : "sin-gps"].join("|");
  const vistaAplicada = useRef("");
  useEffect(() => {
    if (!points.length || claveVista === vistaAplicada.current) return;
    vistaAplicada.current = claveVista;
    mover({ modo: "ruta", coords: coordsCercanos });
  }, [claveVista]);
  const verTodo = () => mover({ modo: "ruta", coords: [...points.map((p) => [p.latitud, p.longitud] as [number, number]), ...(origen ? [[origen.latitude, origen.longitude] as [number, number]] : [])] });
  const centrarme = () => { if (origen) mover({ modo: "yo", punto: [origen.latitude, origen.longitude] }); };

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
        {points.length ? (
          <View style={s.resumen}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.resumenTitulo}>{enFiltro.length} {enFiltro.length === 1 ? "caso" : "casos"} en tu muestra</Text>
              {siguiente ? (
                <Text style={s.resumenTexto}>Siguiente: <Text style={s.negrita}>{siguiente.nombres}</Text> · {fmtDistancia(siguiente.distanciaDesdeMi)}{rutaKm > 0 ? ` · ruta de ${fmtDistancia(rutaKm)}` : ""}</Text>
              ) : null}
              {lejanos > 0 ? <Text style={s.resumenApagado}>{lejanos} {lejanos === 1 ? "caso está" : "casos están"} a más de 60 km de ti</Text> : null}
            </View>
            <View style={s.acciones}>
              {origen ? <Pressable onPress={centrarme} style={s.btn}><Text style={s.btnTxt}>Centrarme</Text></Pressable> : null}
              <Pressable onPress={verTodo} style={[s.btn, s.btnSec]}><Text style={[s.btnTxt, s.btnTxtSec]}>Ver todo</Text></Pressable>
            </View>
          </View>
        ) : null}
      </View>

      <View style={s.mapWrap}>
        <MapContainer center={CENTER} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <CamaraMapa camara={camara} />
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
          <ClientesAgrupados puntos={puntosMapa} origen={origen} onLlegar={comoLlegar} />
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
  resumen: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F4F7FF", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  resumenTitulo: { fontSize: 12, fontWeight: "900", color: C.text },
  resumenTexto: { fontSize: 11, color: C.text, lineHeight: 15 },
  resumenApagado: { fontSize: 10.5, color: C.muted },
  negrita: { fontWeight: "800" },
  acciones: { flexDirection: "row", gap: 6, flexShrink: 0 },
  btn: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, backgroundColor: "#1236C7" },
  btnSec: { backgroundColor: "#E6ECFF" },
  btnTxt: { fontSize: 11, fontWeight: "800", color: "#fff" },
  btnTxtSec: { color: "#1236C7" },
  mapWrap: { flex: 1, minHeight: 420 },
  empty: { position: "absolute", top: "45%", left: 24, right: 24, alignItems: "center", gap: 6, backgroundColor: "#FFFFFFF2", borderRadius: 18, padding: 18 },
  emptyTitle: { fontSize: 14, fontWeight: "900", color: C.text },
  emptyText: { fontSize: 11, lineHeight: 16, textAlign: "center", color: C.muted },
});
