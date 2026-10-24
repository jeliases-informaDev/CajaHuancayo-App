import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext";
import { Empty, Loading } from "../ui";
import { conMayusculas, FI, N, nombreDePersona } from "../theme";
import { cacheGet, cacheSet, pendingVisitCount, rejectedVisits } from "../offlineSync";
import { cargarMuestra, type ResumenMuestra } from "../muestra";
import { comoLlegarA } from "../ficha/destino";
import { inicioDeJornada, iniciarJornada, jornadaDisponible, jornadaEnCurso, reintentarFinPendiente, terminarJornada, zonaDeLaJornada } from "../jornada";
import type { ZonaJornada } from "../types/jornada";

const CACHE_KEY_MUESTRA = "mias_v1";

function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
const formatoDistancia = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

export default function DashboardScreen({ refreshRevision = 0, onNavigate, currentLocation }: {
  refreshRevision?: number; onNavigate?: (tab: string, abrir?: any) => void; currentLocation?: { latitude: number; longitude: number } | null;
}) {
  const { api, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [resumen, setResumen] = useState<ResumenMuestra | null>(null); // conteos de TODA la muestra, vengan o no cargados todos los casos
  const ultimaGuardada = useRef<any[] | null>(null);
  const [pendientesSync, setPendientesSync] = useState(0);
  const [rechazadas, setRechazadas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const requestId = useRef(0);
  // Jornada de campo: mientras está iniciada se comparte la ubicación en segundo plano (ver jornada.ts).
  const [jornada, setJornada] = useState<{ activa: boolean; desde: string | null; zona: string | null }>({ activa: false, desde: null, zona: null });
  const [jornadaOcupada, setJornadaOcupada] = useState(false);
  const [jornadaError, setJornadaError] = useState("");
  const leerJornada = useCallback(async () => {
    try { const activa = await jornadaEnCurso(); setJornada({ activa, desde: activa ? await inicioDeJornada() : null, zona: activa ? await zonaDeLaJornada() : null }); } catch {}
  }, []);
  // Al iniciar se manda también la zona (posición del celular y nombre del lugar); al terminar, solo la acción.
  const avisar = (accion: "INICIAR" | "TERMINAR") => (zona?: ZonaJornada) => api("/api/visitas/jornada", { method: "POST", body: JSON.stringify({ accion, ...(accion === "INICIAR" ? zona : {}) }) });
  // Si una jornada se terminó sin señal, al volver a abrir la app se le avisa al servidor.
  useEffect(() => { reintentarFinPendiente(avisar("TERMINAR")).finally(leerJornada); }, [leerJornada, refreshRevision]);
  const alternarJornada = async () => {
    setJornadaError("");
    if (jornada.activa) {
      Alert.alert("¿Terminar la jornada?", "Tu supervisor dejará de ver tu ubicación en tiempo real.", [
        { text: "Seguir en jornada", style: "cancel" },
        { text: "Terminar", style: "destructive", onPress: async () => { setJornadaOcupada(true); try { const avisado = await terminarJornada(avisar("TERMINAR")); if (!avisado) setJornadaError("Jornada terminada en este celular. Tu supervisor lo verá apenas haya conexión."); } catch (e: any) { setJornadaError(e.message || "No se pudo terminar la jornada."); } finally { setJornadaOcupada(false); leerJornada(); } } },
      ]);
      return;
    }
    setJornadaOcupada(true);
    try { await iniciarJornada(avisar("INICIAR")); } catch (e: any) { setJornadaError(e.message || "No se pudo iniciar la jornada."); } finally { setJornadaOcupada(false); leerJornada(); }
  };

  const load = useCallback(async (background = false, forzar = false) => {
    const current = ++requestId.current;
    if (background) setRefreshing(true);
    // El conteo de pendientes es local (SQLite) y no debe poder bloquear la carga de
    // los datos del servidor si tarda, falla o (en web) nunca resuelve.
    pendingVisitCount()
      .then((n) => { if (mounted.current && current === requestId.current) setPendientesSync(n); })
      .catch(() => {});
    rejectedVisits()
      .then((list) => { if (mounted.current && current === requestId.current) setRechazadas(list.length); })
      .catch(() => {});
    try {
      const m = await cargarMuestra(api, { forzar });
      if (!mounted.current || current !== requestId.current) return;
      setAsignaciones(m.data);
      setResumen(m.resumen);
      setError("");
      if (ultimaGuardada.current !== m.data) { ultimaGuardada.current = m.data; cacheSet(CACHE_KEY_MUESTRA, m.data); } // no se reescribe el caché si nada cambió
    } catch (e: any) {
      if (mounted.current && current === requestId.current) setError(e.message);
    } finally {
      if (mounted.current && current === requestId.current) { setLoading(false); setRefreshing(false); }
    }
  }, [api]);

  useEffect(() => {
    mounted.current = true;
    cacheGet<any[]>(CACHE_KEY_MUESTRA).then((cached) => {
      if (cached && mounted.current) { setAsignaciones(cached.value); setLoading(false); }
    });
    pendingVisitCount().then((n) => mounted.current && setPendientesSync(n)).catch(() => {});
    load();
    const timer = setInterval(() => load(true), 20000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, [load]);
  useEffect(() => { if (refreshRevision > 0) load(true, true); }, [refreshRevision, load]);

  if (loading && !asignaciones.length) return <Loading />;

  const consumo = asignaciones.filter((a) => a.expediente?.tipo_credito === "CONSUMO").length;
  const otros = asignaciones.filter((a) => a.expediente?.tipo_credito === "OTROS").length;
  const altaPrioridad = asignaciones.filter((a) => a.prioridad === "ALTA");
  // Los conteos salen del resumen del servidor (todo el universo); sin él (servidor anterior) se cuentan los casos cargados.
  const stats: Record<string, number> = resumen ? { total: resumen.total, alta: resumen.ALTA, consumo: resumen.CONSUMO, otros: resumen.OTROS } : { total: asignaciones.length, alta: altaPrioridad.length, consumo, otros };

  // "Siguiente caso": primero los de prioridad alta; si hay ubicación, el más cercano de ese grupo.
  const candidatos = altaPrioridad.length ? altaPrioridad : asignaciones;
  const conDistancia = candidatos.map((a) => {
    const lat = Number(a.expediente?.latitud);
    const lng = Number(a.expediente?.longitud);
    const ok = a.expediente?.latitud != null && Number.isFinite(lat) && Number.isFinite(lng) && currentLocation;
    return { a, d: ok ? distanciaMetros(currentLocation!.latitude, currentLocation!.longitude, lat, lng) : null };
  });
  conDistancia.sort((x, y) => (x.d ?? Infinity) - (y.d ?? Infinity));
  const siguiente = conDistancia[0];
  const nombre = (user?.nombres || user?.username || "Auditor").split(" ")[0];
  const esMype = siguiente?.a.expediente?.tipo_credito === "OTROS";
  const porEnviar = pendientesSync + rechazadas;
  const fecha = new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" }).replace(/^./, (c) => c.toUpperCase());

  const comoLlegar = () => { const e = siguiente?.a.expediente; if (e) comoLlegarA(e); };
  const prioridad = String(siguiente?.a.prioridad || "").toUpperCase();
  const chipPrioridad = prioridad === "ALTA" ? { t: "Prioridad alta", bg: N.rojoFondo, fg: N.rojoTexto } : prioridad === "MEDIA" ? { t: "Prioridad media", bg: N.ambarFondo, fg: N.ambar } : prioridad === "BAJA" ? { t: "Prioridad baja", bg: N.suave, fg: N.apagado } : null;
  const direccion = [conMayusculas(siguiente?.a.expediente?.direccion_domicilio), conMayusculas(siguiente?.a.expediente?.distrito)].filter(Boolean).join(", ");
  const textoDistancia = siguiente?.d != null ? `${formatoDistancia(siguiente.d)} referenciales.${siguiente.d >= 5000 ? " Valida la ubicación antes de desplazarte." : ""}` : "";
  const circulos = [
    { n: stats.total, sub: "Por visitar", color: N.tinta },
    { n: stats.alta, sub: "Prioritarias", color: stats.alta ? N.rojo : N.tinta },
    { n: pendientesSync, sub: "Listas para enviar", color: pendientesSync ? N.verde : N.tinta },
  ];
  const desde = jornada.desde ? new Date(jornada.desde).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <View style={s.pantalla}>
      <StatusBar style="light" />
      <LinearGradient colors={[N.marca2, "rgba(76,81,185,0)"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[s.cabeceraFondo, { height: insets.top + 250 }]} pointerEvents="none" />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true, true)} colors={[N.marca]} progressViewOffset={insets.top} />}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.contenido, { paddingTop: insets.top + 20 }]}
      >
        <View style={s.saludo}>
          <View style={s.fechaFila}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={16} color="rgba(255,255,255,0.85)" />
            <Text style={s.fecha}>{fecha}</Text>
          </View>
          <Text style={s.hola} accessibilityRole="header">Hola, <Text style={s.nombre}>{nombre}</Text> 👋</Text>
        </View>

        {jornadaDisponible ? (
          <View style={s.tarjeta}>
            <View style={s.cabezaTarjeta}>
              <Text style={s.tituloTarjeta}>{jornada.activa ? "Jornada en curso" : "Tu jornada de campo"}</Text>
              <View style={[s.estado, jornada.activa && s.estadoOn]}>
                {jornada.activa ? <View style={s.estadoPunto} /> : null}
                <Text style={[s.estadoTexto, jornada.activa && { color: "#0C8559" }]}>{jornada.activa ? "En curso" : "Sin iniciar"}</Text>
              </View>
            </View>
            <Text style={s.cuerpo}>{jornada.activa
              ? `${desde ? `Desde las ${desde}` : "Jornada iniciada"}${jornada.zona ? ` · Tu zona de hoy: ${jornada.zona}` : ""}`
              : "Inicia tu jornada cuando salgas a campo."}</Text>
            <View style={s.nota}>
              <MaterialCommunityIcons name="map-marker-outline" size={20} color={N.marca} style={{ marginTop: 1 }} />
              <Text style={s.notaTexto}>Tu supervisor verá tu ubicación solo durante la jornada, incluso con la pantalla apagada.</Text>
            </View>
            {jornadaError ? <Text style={s.jornadaError}>{jornadaError}</Text> : null}
            <Pressable disabled={jornadaOcupada} onPress={alternarJornada} accessibilityRole="button" style={({ pressed }) => [s.jornadaBtn, jornada.activa ? s.jornadaBtnOff : s.jornadaBtnOn, (pressed || jornadaOcupada) && { opacity: 0.75 }]}>
              <MaterialCommunityIcons name={jornada.activa ? "stop-circle-outline" : "play-outline"} size={21} color={jornada.activa ? "#C0243E" : "#fff"} />
              <Text style={[s.jornadaBtnTexto, jornada.activa && { color: "#C0243E" }]}>{jornadaOcupada ? "Un momento…" : jornada.activa ? "Terminar jornada" : "Iniciar jornada"}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={s.bloque}>
          <Text style={s.tituloBloque} accessibilityRole="header">Actividad de hoy</Text>
          <View style={s.circulos}>
            {circulos.map((c) => (
              <View key={c.sub} style={s.circuloCol} accessible accessibilityLabel={`${c.n} muestras. ${c.sub}`}>
                <View style={s.circulo}><Text style={[s.circuloNum, { color: c.color }]}>{c.n}</Text></View>
                <Text style={s.circuloEtiqueta}>{c.n === 1 ? "muestra" : "muestras"}</Text>
                <Text style={s.circuloSub}>{c.sub}</Text>
              </View>
            ))}
          </View>
        </View>

        {error && !asignaciones.length ? (
          <Empty title="No pudimos cargar tu muestra" text={error} />
        ) : siguiente ? (
          <View style={s.bloque}>
            <Text style={s.tituloBloque} accessibilityRole="header">Primera visita sugerida</Text>
            <View style={s.tarjeta}>
              <View style={s.chips}>
                {chipPrioridad ? <View style={[s.chip, { backgroundColor: chipPrioridad.bg }]}><Text style={[s.chipTexto, { color: chipPrioridad.fg }]}>{chipPrioridad.t}</Text></View> : <View />}
                <View style={[s.chip, { backgroundColor: N.suave }]}><Text style={[s.chipTexto, { color: N.marca }]}>{esMype ? "MYPE" : "Consumo"}</Text></View>
              </View>
              <Text style={s.caso} numberOfLines={2}>{nombreDePersona(siguiente.a.expediente?.nombres_cliente) || "Cliente sin nombre"}</Text>
              <Text style={s.casoCodigo} numberOfLines={1}>{[siguiente.a.expediente?.codigo_expediente, conMayusculas(siguiente.a.expediente?.distrito)].filter(Boolean).join(" · ")}</Text>
              <View style={s.direccion}>
                <MaterialCommunityIcons name="map-marker-outline" size={20} color={N.marca} style={{ marginTop: 1 }} />
                <Text style={s.direccionTexto} numberOfLines={2}>{direccion || "Sin dirección"}</Text>
              </View>
              {textoDistancia ? (
                <>
                  <View style={s.linea} />
                  <Text style={s.distancia}>{textoDistancia}</Text>
                </>
              ) : null}
              <View style={s.acciones}>
                <Pressable style={({ pressed }) => [s.revisar, pressed && { opacity: 0.8 }]} onPress={() => onNavigate?.("muestra", siguiente.a)} accessibilityRole="button">
                  <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
                  <Text style={s.revisarTexto}>Revisar caso</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [s.llegar, pressed && { opacity: 0.7 }]} onPress={comoLlegar} accessibilityRole="button" accessibilityLabel="Cómo llegar">
                  <MaterialCommunityIcons name="navigation-variant-outline" size={22} color={N.marca} />
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <View style={s.bloque}>
            <Text style={s.tituloBloque} accessibilityRole="header">Primera visita sugerida</Text>
            <View style={s.tarjeta}>
              <Text style={s.cuerpo}>Todavía no tienes casos en tu muestra. Revisa «Disponibles» en Mi muestra para tomar uno.</Text>
              <Pressable style={({ pressed }) => [s.revisar, pressed && { opacity: 0.8 }]} onPress={() => onNavigate?.("muestra")} accessibilityRole="button">
                <Text style={s.revisarTexto}>Ir a Mi muestra</Text>
              </Pressable>
            </View>
          </View>
        )}

        {porEnviar ? (
          <View style={[s.tarjeta, s.aviso, rechazadas ? { backgroundColor: "#FDE7EB", borderColor: "#F5C6CC" } : null]}>
            <MaterialCommunityIcons name={rechazadas ? "alert-octagon-outline" : "cloud-alert-outline"} size={26} color={rechazadas ? "#C0243E" : N.ambar} />
            <View style={{ flex: 1 }}>
              <Text style={s.avisoTitulo}>{rechazadas ? `${rechazadas} visita(s) rechazada(s)` : `${pendientesSync} visita(s) por sincronizar`}</Text>
              <Text style={s.avisoTexto}>{rechazadas ? "No se enviaron. Abre Perfil para ver el motivo; el expediente sigue en tu muestra." : "Se enviarán automáticamente al recuperar conexión."}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: N.fondo },
  cabeceraFondo: { position: "absolute", left: 0, right: 0, top: 0 },
  contenido: { paddingHorizontal: 20, paddingBottom: 32, gap: 24, width: "100%", maxWidth: 560, alignSelf: "center" },
  saludo: { gap: 4 },
  fechaFila: { flexDirection: "row", alignItems: "center", gap: 7 },
  fecha: { fontFamily: FI.med, fontSize: 14, color: "rgba(255,255,255,0.9)" },
  hola: { fontFamily: FI.reg, fontSize: 32, lineHeight: 40, color: "#fff" },
  nombre: { fontFamily: FI.bold },
  tarjeta: { backgroundColor: "#fff", borderWidth: 1, borderColor: N.borde, borderRadius: 20, padding: 20, gap: 14, shadowColor: "#20263D", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  cabezaTarjeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  tituloTarjeta: { flex: 1, fontFamily: FI.semi, fontSize: 18, color: N.tinta },
  estado: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: N.fondo, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  estadoOn: { backgroundColor: "#E4F7EF" },
  estadoPunto: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#0C8559" },
  estadoTexto: { fontFamily: FI.semi, fontSize: 12.5, color: N.apagado },
  cuerpo: { fontFamily: FI.reg, fontSize: 16, lineHeight: 23, color: N.tinta },
  nota: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  notaTexto: { flex: 1, fontFamily: FI.reg, fontSize: 13.5, lineHeight: 20, color: N.apagado },
  jornadaError: { fontFamily: FI.reg, color: "#C0243E", fontSize: 12.5, lineHeight: 17 },
  jornadaBtn: { minHeight: 52, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  jornadaBtnOn: { backgroundColor: N.verde },
  jornadaBtnOff: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#F5C6CC" },
  jornadaBtnTexto: { fontFamily: FI.semi, color: "#fff", fontSize: 16 },
  bloque: { gap: 16 },
  tituloBloque: { fontFamily: FI.semi, fontSize: 20, color: N.tinta, textAlign: "center" },
  circulos: { flexDirection: "row", justifyContent: "center", gap: 14 },
  circuloCol: { width: 98, alignItems: "center", gap: 2 },
  circulo: { width: 74, height: 74, borderRadius: 37, backgroundColor: "#fff", borderWidth: 1, borderColor: N.borde, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  circuloNum: { fontFamily: FI.semi, fontSize: 32, lineHeight: 38 },
  circuloEtiqueta: { fontFamily: FI.med, fontSize: 14, color: N.tinta },
  circuloSub: { fontFamily: FI.reg, fontSize: 11, lineHeight: 14, color: N.apagado, textAlign: "center" },
  chips: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  chipTexto: { fontFamily: FI.semi, fontSize: 12.5 },
  caso: { fontFamily: FI.bold, fontSize: 24, lineHeight: 30, color: N.tinta },
  casoCodigo: { fontFamily: FI.reg, fontSize: 14, color: N.apagado, marginTop: -6 },
  direccion: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  direccionTexto: { flex: 1, fontFamily: FI.med, fontSize: 15.5, lineHeight: 22, color: N.tinta },
  linea: { height: 1, backgroundColor: "#E9EBF4" },
  distancia: { fontFamily: FI.reg, fontSize: 14, lineHeight: 21, color: N.ambar },
  acciones: { flexDirection: "row", gap: 10 },
  revisar: { flex: 1, minHeight: 52, borderRadius: 12, backgroundColor: N.marca, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  revisarTexto: { fontFamily: FI.semi, fontSize: 16, color: "#fff" },
  llegar: { width: 52, height: 52, borderRadius: 12, backgroundColor: N.suave, alignItems: "center", justifyContent: "center" },
  aviso: { flexDirection: "row", alignItems: "center", backgroundColor: N.ambarFondo, borderColor: "#F2DDA6" },
  avisoTitulo: { fontFamily: FI.semi, fontSize: 14.5, color: N.tinta },
  avisoTexto: { fontFamily: FI.reg, fontSize: 12.5, lineHeight: 18, color: N.apagado, marginTop: 2 },
});
