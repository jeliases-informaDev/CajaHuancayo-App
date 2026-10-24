import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../AuthContext";
import { Empty, Loading, Screen } from "../ui";
import { conMayusculas, estadoDeCaso, FI, N, nombreDePersona } from "../theme";
import FichaWizard, { type ResultadoEnvio } from "../ficha/FichaWizard";
import AvisoEnvio from "../ficha/AvisoEnvio";
import { cacheGet, cacheSet } from "../offlineSync";
import { cargarMuestra, type ResumenMuestra } from "../muestra";
import { recordarEmpresa } from "../empresa";

function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const CACHE_KEY_MUESTRA = "mias_v1";
const CACHE_KEY_GEO = "geo_cfg_v1";
const CACHE_KEY_AUTO = "autoasignacion_v1";
// Valores por defecto del servidor; se reemplazan por los reales (GET /api/visitas/config).
const GEO_DEFAULT = { radio: 100, precision: 100 };

export default function MiMuestraScreen({ refreshRevision = 0, onDetailVisibilityChange, currentLocation, abrirAsignacion = null }: { refreshRevision?: number; onDetailVisibilityChange?: (open: boolean) => void; currentLocation?: { latitude: number; longitude: number } | null; abrirAsignacion?: any }) {
  const { api } = useAuth();
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  // Si llega desde «Revisar caso» (pantalla Hoy), la ficha de ese caso se abre de entrada.
  const [selected, setSelected] = useState<any>(abrirAsignacion);
  const [resumen, setResumen] = useState<ResumenMuestra | null>(null); // conteos de TODA la muestra para los filtros
  const [aviso, setAviso] = useState<ResultadoEnvio | null>(null); // «Tus respuestas han sido enviadas» al cerrar la ficha

  // "Disponibles": expedientes pendientes de cualquier distrito que nadie tomó todavía, del más antiguo al más nuevo (no dependen de dónde estés) —
  // el auditor se los puede auto-asignar en vez de esperar a que el supervisor lo haga.
  const [vista, setVista] = useState<"mia" | "disponibles">("mia");
  const [disponibles, setDisponibles] = useState<any[]>([]);
  // «Disponibles» se pide por páginas y con la búsqueda y el filtro en el servidor: puede haber miles y no caben en una respuesta.
  const [dispInfo, setDispInfo] = useState<{ page: number; pages: number; total: number } | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  // Progreso de la descarga de la muestra (por páginas): «100 de 230 cargados».
  const [progreso, setProgreso] = useState<{ cargados: number; total: number; completa: boolean } | null>(null);
  const [loadingDisponibles, setLoadingDisponibles] = useState(false);
  const [errorDisponibles, setErrorDisponibles] = useState("");
  const [claimingId, setClaimingId] = useState<number | null>(null);
  // Tope de casos abiertos que el servidor deja tener al tomarlos por cuenta propia (maximo 0 = sin tope; cupo null = sin límite).
  const [tope, setTope] = useState<{ maximo: number; abiertos: number; cupo: number | null } | null>(null);
  const [geoConfig, setGeoConfig] = useState(GEO_DEFAULT);
  // El servidor puede apagar «Disponibles / Tomar este caso» (PERMITIR_AUTOASIGNACION=false): entonces el auditor solo trabaja lo que le asignan.
  const [autoasignacion, setAutoasignacion] = useState(true);
  const autoasignacionFresca = useRef(false); // si el servidor ya contestó, el valor guardado de la vez anterior no debe pisarlo
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<"TODOS" | "MYPE" | "CONSUMO" | "ALTA">("TODOS");

  const mounted = useRef(true);

  const load = useCallback(async (background = false, forzar = false) => {
    if (background) setRefreshing(true);
    try {
      const m = await cargarMuestra(api, {
        forzar,
        // la primera página se pinta enseguida; el resto llega mientras el auditor ya puede trabajar
        onPagina: (parcial) => { if (mounted.current) { setAsignaciones(parcial.data); setResumen(parcial.resumen); setProgreso({ cargados: parcial.data.length, total: parcial.total, completa: parcial.completa }); setLoading(false); } },
      });
      if (!mounted.current) return;
      setAsignaciones(m.data);
      setResumen(m.resumen);
      setProgreso({ cargados: m.data.length, total: m.total, completa: m.completa });
      setError("");
      cacheSet(CACHE_KEY_MUESTRA, m.data);
    } catch (e: any) {
      if (mounted.current) setError(e.message);
    } finally {
      if (mounted.current) { setLoading(false); setRefreshing(false); }
    }
  }, [api]);

  useEffect(() => {
    mounted.current = true;
    // Pinta al instante lo último que se vio (sin esperar a la red) y refresca en paralelo.
    cacheGet<any[]>(CACHE_KEY_MUESTRA).then((cached) => {
      if (cached && mounted.current) { setAsignaciones(cached.value); setLoading(false); }
    });
    load();
    return () => { mounted.current = false; };
  }, [load]);
  useEffect(() => { if (refreshRevision > 0) load(true, true); }, [refreshRevision, load]);
  useEffect(() => { onDetailVisibilityChange?.(Boolean(selected)); }, [selected, onDetailVisibilityChange]);

  const loadDisponibles = useCallback(async (pagina = 1) => {
    if (pagina === 1) setLoadingDisponibles(true); else setCargandoMas(true);
    try {
      const params = new URLSearchParams({ page: String(pagina), limit: "50" });
      if (query.trim().length >= 2) params.set("q", query.trim());
      if (filtro === "MYPE") params.set("tipo", "OTROS");
      if (filtro === "CONSUMO") params.set("tipo", "CONSUMO");
      const r: any = await api("/api/asignaciones/disponibles?" + params.toString());
      if (!mounted.current) return;
      if (r.tope) setTope(r.tope); // un servidor anterior no lo informa: sin aviso de tope
      setDisponibles((previos) => (pagina === 1 ? r.data || [] : [...previos, ...(r.data || [])]));
      setDispInfo(r.pagination ? { page: r.pagination.page, pages: r.pagination.pages, total: r.pagination.total } : null);
      setErrorDisponibles("");
    } catch (e: any) {
      if (mounted.current) setErrorDisponibles(e.message || "No pudimos cargar los expedientes disponibles.");
    } finally {
      if (mounted.current) { setLoadingDisponibles(false); setCargandoMas(false); }
    }
  }, [api, query, filtro]);

  // Al escribir o cambiar el filtro se vuelve a pedir la primera página (con una pequeña espera para no pedir en cada letra).
  useEffect(() => {
    if (vista !== "disponibles") return;
    const t = setTimeout(() => loadDisponibles(1), 350);
    return () => clearTimeout(t);
  }, [vista, loadDisponibles]);

  useEffect(() => {
    cacheGet<typeof GEO_DEFAULT>(CACHE_KEY_GEO).then((cached) => { if (cached && mounted.current) setGeoConfig(cached.value); });
    cacheGet<boolean>(CACHE_KEY_AUTO).then((cached) => { if (cached && mounted.current && !autoasignacionFresca.current) { setAutoasignacion(cached.value !== false); if (cached.value === false) setVista("mia"); } });
    api<any>("/api/visitas/config")
      .then((r) => {
        const next = { radio: Number(r.data?.geocerca_radio_m) || GEO_DEFAULT.radio, precision: Number(r.data?.precision_maxima_m) || GEO_DEFAULT.precision };
        if (mounted.current) setGeoConfig(next);
        if (r.data?.empresa) recordarEmpresa(r.data.empresa);
        cacheSet(CACHE_KEY_GEO, next);
        const permitida = r.data?.autoasignacion !== false; // apps/servidores anteriores no lo informan: sigue activa
        autoasignacionFresca.current = true;
        if (mounted.current) { setAutoasignacion(permitida); if (!permitida) setVista("mia"); }
        cacheSet(CACHE_KEY_AUTO, permitida);
      })
      .catch(() => {});
  }, [api]);

  const tomarCaso = async (idExpediente: number) => {
    if (claimingId) return;
    setClaimingId(idExpediente);
    try {
      await api(`/api/asignaciones/auto/${idExpediente}`, { method: "POST" });
      await Promise.all([load(true, true), loadDisponibles(1)]);
      setVista("mia");
      Alert.alert("Caso tomado", "Este expediente ya está en tu muestra.");
    } catch (e: any) {
      // ALREADY_CLAIMED: otro auditor lo tomó primero entre que se cargó la lista y
      // que este presionó "Tomar" — se refresca la lista para que deje de verlo.
      Alert.alert("No se pudo tomar", e.message || "Intenta de nuevo.");
      loadDisponibles(1);
    } finally {
      setClaimingId(null);
    }
  };

  if (loading && !asignaciones.length) return <Loading />;

  if (selected) {
    return (
      <FichaWizard
        asignacion={selected}
        geo={geoConfig}
        currentLocation={currentLocation}
        onClose={() => setSelected(null)}
        onSent={(resultado) => { load(true, true); if (resultado) setAviso(resultado); }}
      />
    );
  }

  const q = query.trim().toLowerCase();
  const pasaFiltro = (exp: any, prioridad?: string) => {
    if (filtro === "MYPE" && exp.tipo_credito !== "OTROS") return false;
    if (filtro === "CONSUMO" && exp.tipo_credito !== "CONSUMO") return false;
    if (filtro === "ALTA" && prioridad !== "ALTA") return false;
    if (!q) return true;
    return [exp.nombres_cliente, exp.codigo_expediente, exp.numero_documento_cliente, exp.distrito, exp.direccion_domicilio].some((v) => String(v || "").toLowerCase().includes(q));
  };
  const visiblesMias = asignaciones.filter((a) => pasaFiltro(a.expediente, a.prioridad));
  const visiblesDisp = disponibles.filter((e) => pasaFiltro(e));
  const distanciaA = (exp: any) => {
    if (!currentLocation || exp.latitud == null) return null;
    const lat = Number(exp.latitud);
    const lng = Number(exp.longitud);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const m = distanciaMetros(currentLocation.latitude, currentLocation.longitude, lat, lng);
    return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
  };

  // Conteos de los filtros: los del servidor (toda la muestra) o, si aún no llegaron, los de lo ya descargado.
  const cuenta = resumen
    ? { todos: resumen.total, MYPE: resumen.OTROS, CONSUMO: resumen.CONSUMO, ALTA: resumen.ALTA }
    : { todos: asignaciones.length, MYPE: asignaciones.filter((a) => a.expediente?.tipo_credito === "OTROS").length, CONSUMO: asignaciones.filter((a) => a.expediente?.tipo_credito === "CONSUMO").length, ALTA: asignaciones.filter((a) => a.prioridad === "ALTA").length };
  const FILTROS: { id: typeof filtro; label: string; n?: number }[] = [
    { id: "TODOS", label: "Todos", n: vista === "mia" ? cuenta.todos : undefined },
    { id: "MYPE", label: "MYPE", n: vista === "mia" ? cuenta.MYPE : undefined },
    { id: "CONSUMO", label: "Consumo", n: vista === "mia" ? cuenta.CONSUMO : undefined },
    ...(vista === "mia" ? [{ id: "ALTA" as const, label: "Prioritarios", n: cuenta.ALTA }] : []),
  ];

  const subtitulo = vista === "mia"
    ? (progreso && !progreso.completa ? `Descargando ${progreso.cargados} de ${progreso.total} casos…` : "")
    : `${dispInfo ? dispInfo.total : visiblesDisp.length} disponible(s) para tomar`;

  // Prioridad: chip y, en la tarjeta, un tinte en el borde derecho (rojo = alta, ámbar = media).
  const PRIORIDAD: Record<string, { t: string; bg: string; fg: string; tinte: string | null }> = {
    ALTA: { t: "Prioridad alta", bg: N.rojoFondo, fg: N.rojoTexto, tinte: "255,0,4" },
    MEDIA: { t: "Prioridad media", bg: N.ambarFondo, fg: N.ambar, tinte: "254,161,0" },
    BAJA: { t: "Prioridad baja", bg: N.gris, fg: N.grisTexto, tinte: null },
  };

  const Tarjeta = ({ exp, prioridad, estado, onPress, children }: { exp: any; prioridad?: string; estado?: string; onPress?: () => void; children?: React.ReactNode }) => {
    const mype = exp.tipo_credito === "OTROS";
    const pr = PRIORIDAD[String(prioridad || "").toUpperCase()];
    const dist = distanciaA(exp);
    return (
      <Pressable onPress={onPress} disabled={!onPress} testID={onPress ? "caso-card" : "caso-disponible"} accessibilityRole={onPress ? "button" : undefined} style={({ pressed }) => [s.tarjeta, pressed && { opacity: 0.85 }]}>
        {pr?.tinte ? <LinearGradient colors={[`rgba(${pr.tinte},0)`, `rgba(${pr.tinte},0.22)`]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={s.tinte} pointerEvents="none" /> : null}
        <View style={s.chips}>
          <View style={[s.chip, { backgroundColor: N.suave }]}><Text style={[s.chipTexto, { color: N.marca }]}>{mype ? "MYPE" : "Consumo"}</Text></View>
          {pr ? <View style={[s.chip, { backgroundColor: pr.bg }]}><Text style={[s.chipTexto, { color: pr.fg }]}>{pr.t}</Text></View> : null}
        </View>
        <Text style={s.nombre} numberOfLines={1}>{nombreDePersona(exp.nombres_cliente) || "Cliente sin nombre"}</Text>
        <Text style={s.codigo} numberOfLines={1}>{exp.codigo_expediente}</Text>
        <View style={s.linea} />
        <Text style={s.direccion} numberOfLines={1}>{conMayusculas(exp.direccion_domicilio) || "Sin dirección registrada"}</Text>
        <View style={s.pie}>
          <Text style={s.estado} numberOfLines={1}>{[estado ? estadoDeCaso(estado) : null, conMayusculas(exp.departamento || exp.distrito)].filter(Boolean).join(" · ")}</Text>
          {dist ? <Text style={s.distancia}>{dist} ref.</Text> : null}
        </View>
        {children}
      </Pressable>
    );
  };

  return (
    <>
      <Screen refreshControl={<RefreshControl refreshing={vista === "mia" ? refreshing : loadingDisponibles} onRefresh={() => (vista === "mia" ? load(true, true) : loadDisponibles(1))} colors={[N.marca]} />}>
        <View style={s.titulo}>
          <MaterialCommunityIcons name="folder-outline" size={26} color="#000" />
          <Text style={s.tituloTexto} accessibilityRole="header">Mi muestra</Text>
        </View>
        {subtitulo ? <Text style={s.subtitulo}>{subtitulo}</Text> : null}

        {autoasignacion ? (
          <View style={s.alternar} accessibilityRole="tablist">
            {([["mia", "Asignados"], ["disponibles", "Disponibles"]] as const).map(([id, rotulo]) => (
              <Pressable key={id} onPress={() => setVista(id)} accessibilityRole="tab" accessibilityState={{ selected: vista === id }} style={[s.alternarItem, vista === id && s.alternarItemOn]}>
                <Text style={[s.alternarTexto, vista === id && s.alternarTextoOn]}>{rotulo}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={s.buscar}>
          <MaterialCommunityIcons name="magnify" size={22} color={N.marca} />
          <TextInput style={s.buscarInput} value={query} onChangeText={setQuery} placeholder="Buscar cliente o código" placeholderTextColor={N.hueco} autoCorrect={false} accessibilityLabel="Buscar cliente, código, documento o distrito" />
          {query ? <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityLabel="Borrar búsqueda"><MaterialCommunityIcons name="close-circle" size={18} color={N.hueco} /></Pressable> : null}
        </View>
        <View style={s.filtros}>
          {FILTROS.map((f) => (
            <Pressable key={f.id} onPress={() => setFiltro(f.id)} accessibilityRole="button" accessibilityState={{ selected: filtro === f.id }} style={[s.filtro, filtro === f.id && s.filtroOn]}>
              <Text style={[s.filtroTexto, filtro === f.id && s.filtroTextoOn]}>{f.label}{f.n !== undefined ? ` · ${f.n}` : ""}</Text>
            </Pressable>
          ))}
        </View>

        {vista === "disponibles" ? (
          <>
            <Text style={s.nota}>Casos pendientes que ningún asesor ha tomado, de cualquier distrito: toma los que quieras. Al tomar uno, pasa a tu muestra.{tope && tope.maximo > 0 ? ` Tienes ${tope.abiertos} de ${tope.maximo} casos abiertos${tope.cupo === 0 ? ": llegaste al máximo, termina o pide que te quiten alguno para tomar otro." : "."}` : ""}</Text>
            {errorDisponibles && !disponibles.length ? <Empty title="No pudimos cargar la lista" text={errorDisponibles} /> : null}
            {!errorDisponibles && !loadingDisponibles && !visiblesDisp.length ? <Empty title="Nada para mostrar" text={disponibles.length ? "Ningún caso coincide con la búsqueda o el filtro." : "No hay casos pendientes sin tomar."} /> : null}
            {visiblesDisp.map((exp) => {
              const claiming = claimingId === exp.id_expediente;
              return (
                <Tarjeta key={exp.id_expediente} exp={exp}>
                  <Pressable onPress={() => tomarCaso(exp.id_expediente)} disabled={claiming || tope?.cupo === 0} accessibilityRole="button" style={[s.tomar, (claiming || tope?.cupo === 0) && { opacity: 0.6 }]}>
                    <MaterialCommunityIcons name={claiming ? "timer-sand" : "hand-extended-outline"} size={18} color="#fff" />
                    <Text style={s.tomarTexto}>{claiming ? "Tomando…" : "Tomar este caso"}</Text>
                  </Pressable>
                </Tarjeta>
              );
            })}
            {dispInfo && dispInfo.page < dispInfo.pages ? (
              <Pressable onPress={() => loadDisponibles(dispInfo.page + 1)} disabled={cargandoMas} style={[s.verMas, cargandoMas && { opacity: 0.6 }]}>
                <Text style={s.verMasTxt}>{cargandoMas ? "Cargando…" : `Ver más (quedan ${dispInfo.total - disponibles.length})`}</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            {error && !asignaciones.length ? <Empty title="No pudimos cargar tu muestra" text={error} /> : null}
            {!error && !asignaciones.length ? <Empty title="Sin casos asignados" text={autoasignacion ? "Tu supervisor aún no te asignó una muestra. Revisa «Disponibles» para tomar un caso." : "Tu supervisor aún no te asignó una muestra."} /> : null}
            {!!asignaciones.length && !visiblesMias.length ? <Empty title="Nada para mostrar" text="Ningún caso coincide con la búsqueda o el filtro." /> : null}
            {visiblesMias.map((item) => (
              <Tarjeta key={item.id_asignacion} exp={item.expediente} prioridad={item.prioridad} estado={item.estado} onPress={() => setSelected(item)} />
            ))}
          </>
        )}
      </Screen>
      <AvisoEnvio aviso={aviso} onClose={() => setAviso(null)} />
    </>
  );
}

const s = StyleSheet.create({
  titulo: { flexDirection: "row", alignItems: "center", gap: 8 },
  tituloTexto: { fontFamily: FI.bold, fontSize: 24, lineHeight: 30, color: "#000" },
  subtitulo: { fontFamily: FI.reg, fontSize: 13, color: N.apagado, marginTop: -8 },
  alternar: { flexDirection: "row", padding: 3, borderRadius: 12, backgroundColor: N.borde2, gap: 2 },
  alternarItem: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  alternarItemOn: { backgroundColor: "#fff" },
  alternarTexto: { fontFamily: FI.med, fontSize: 14, color: N.apagado },
  alternarTextoOn: { fontFamily: FI.semi, color: N.tinta },
  buscar: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 54, borderWidth: 1, borderColor: N.borde, borderRadius: 12, paddingHorizontal: 14, backgroundColor: "#fff" },
  buscarInput: { flex: 1, fontFamily: FI.reg, fontSize: 15, color: N.tinta, paddingVertical: 12 },
  filtros: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  filtro: { width: "48%", flexGrow: 1, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: N.borde, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  filtroOn: { backgroundColor: N.marca, borderColor: N.marca },
  filtroTexto: { fontFamily: FI.med, fontSize: 14.5, color: N.apagado },
  filtroTextoOn: { fontFamily: FI.semi, color: "#fff" },
  nota: { fontFamily: FI.reg, fontSize: 13, color: N.apagado, lineHeight: 19 },
  tarjeta: { backgroundColor: "#fff", borderWidth: 1, borderColor: N.borde, borderRadius: 16, padding: 16, gap: 6, overflow: "hidden", shadowColor: "#20263D", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  tinte: { position: "absolute", top: 0, bottom: 0, right: 0, width: "34%" },
  chips: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  chipTexto: { fontFamily: FI.semi, fontSize: 12.5 },
  nombre: { fontFamily: FI.bold, fontSize: 19, lineHeight: 26, color: N.tinta },
  codigo: { fontFamily: FI.reg, fontSize: 13.5, color: N.apagado, marginTop: -4 },
  linea: { height: 1, backgroundColor: N.borde2, marginVertical: 4 },
  direccion: { fontFamily: FI.reg, fontSize: 14.5, color: N.apagado },
  pie: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  estado: { flex: 1, fontFamily: FI.reg, fontSize: 13.5, color: N.apagado },
  distancia: { fontFamily: FI.med, fontSize: 14, color: N.ambar },
  tomar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8, minHeight: 46, borderRadius: 10, backgroundColor: N.marca },
  tomarTexto: { fontFamily: FI.semi, fontSize: 15, color: "#fff" },
  verMas: { alignSelf: "center", marginTop: 6, marginBottom: 14, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10, backgroundColor: N.suave },
  verMasTxt: { fontFamily: FI.semi, fontSize: 13, color: N.marca },
});
