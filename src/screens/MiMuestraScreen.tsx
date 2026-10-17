import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../AuthContext";
import { Avatar, Badge, Empty, Header, Loading, Screen, Seg } from "../ui";
import { C, shadow } from "../theme";
import FichaWizard from "../ficha/FichaWizard";
import { comoLlegarA } from "../ficha/destino";
import { cacheGet, cacheSet } from "../offlineSync";

function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const CACHE_KEY_MUESTRA = "mias_v1";
const CACHE_KEY_GEO = "geo_cfg_v1";
// Valores por defecto del servidor; se reemplazan por los reales (GET /api/visitas/config).
const GEO_DEFAULT = { radio: 100, precision: 100 };

export default function MiMuestraScreen({ refreshRevision = 0, onDetailVisibilityChange, currentLocation }: { refreshRevision?: number; onDetailVisibilityChange?: (open: boolean) => void; currentLocation?: { latitude: number; longitude: number } | null }) {
  const { api } = useAuth();
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<any>(null);

  // "Disponibles": expedientes pendientes de tu misma zona que nadie tomó todavía —
  // el auditor se los puede auto-asignar en vez de esperar a que el supervisor lo haga.
  const [vista, setVista] = useState<"mia" | "disponibles">("mia");
  const [disponibles, setDisponibles] = useState<any[]>([]);
  const [loadingDisponibles, setLoadingDisponibles] = useState(false);
  const [errorDisponibles, setErrorDisponibles] = useState("");
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [geoConfig, setGeoConfig] = useState(GEO_DEFAULT);
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<"TODOS" | "MYPE" | "CONSUMO" | "ALTA">("TODOS");

  const mounted = useRef(true);

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    try {
      const r: any = await api("/api/asignaciones/mias");
      if (!mounted.current) return;
      setAsignaciones(r.data || []);
      setError("");
      cacheSet(CACHE_KEY_MUESTRA, r.data || []);
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
  useEffect(() => { if (refreshRevision > 0) load(true); }, [refreshRevision, load]);
  useEffect(() => { onDetailVisibilityChange?.(Boolean(selected)); }, [selected, onDetailVisibilityChange]);

  const loadDisponibles = useCallback(async () => {
    setLoadingDisponibles(true);
    try {
      const r: any = await api("/api/asignaciones/disponibles");
      if (!mounted.current) return;
      setDisponibles(r.data || []);
      setErrorDisponibles("");
    } catch (e: any) {
      if (mounted.current) setErrorDisponibles(e.message || "No pudimos cargar los expedientes disponibles.");
    } finally {
      if (mounted.current) setLoadingDisponibles(false);
    }
  }, [api]);

  useEffect(() => { if (vista === "disponibles") loadDisponibles(); }, [vista, loadDisponibles]);

  useEffect(() => {
    cacheGet<typeof GEO_DEFAULT>(CACHE_KEY_GEO).then((cached) => { if (cached && mounted.current) setGeoConfig(cached.value); });
    api<any>("/api/visitas/config")
      .then((r) => {
        const next = { radio: Number(r.data?.geocerca_radio_m) || GEO_DEFAULT.radio, precision: Number(r.data?.precision_maxima_m) || GEO_DEFAULT.precision };
        if (mounted.current) setGeoConfig(next);
        cacheSet(CACHE_KEY_GEO, next);
      })
      .catch(() => {});
  }, [api]);

  const tomarCaso = async (idExpediente: number) => {
    if (claimingId) return;
    setClaimingId(idExpediente);
    try {
      await api(`/api/asignaciones/auto/${idExpediente}`, { method: "POST" });
      await Promise.all([load(true), loadDisponibles()]);
      setVista("mia");
      Alert.alert("Caso tomado", "Este expediente ya está en tu muestra.");
    } catch (e: any) {
      // ALREADY_CLAIMED: otro auditor lo tomó primero entre que se cargó la lista y
      // que este presionó "Tomar" — se refresca la lista para que deje de verlo.
      Alert.alert("No se pudo tomar", e.message || "Intenta de nuevo.");
      loadDisponibles();
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
        onSent={() => load(true)}
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
  // En MYPE con negocio pregunta a qué dirección va (domicilio o negocio); en los demás casos va directo.
  const comoLlegar = (exp: any) => comoLlegarA(exp, currentLocation);

  const Etiqueta = ({ exp }: { exp: any }) => {
    const mype = exp.tipo_credito === "OTROS";
    return (
      <View style={[s.tag, { backgroundColor: mype ? C.magentaBg : C.infoBg }]}>
        <Text style={[s.tagText, { color: mype ? C.magenta : C.primary }]}>{mype ? "MYPE" : "CONSUMO"}</Text>
      </View>
    );
  };

  const FILTROS: { id: typeof filtro; label: string }[] = [
    { id: "TODOS", label: "Todos" }, { id: "MYPE", label: "MYPE" }, { id: "CONSUMO", label: "Consumo" }, { id: "ALTA", label: "Prioritarios" },
  ];

  return (
    <Screen refreshControl={<RefreshControl refreshing={vista === "mia" ? refreshing : loadingDisponibles} onRefresh={() => (vista === "mia" ? load(true) : loadDisponibles())} colors={[C.primary]} />}>
      <Header title="Mi muestra" subtitle={vista === "mia" ? `${visiblesMias.length} de ${asignaciones.length} caso(s)` : `${visiblesDisp.length} disponible(s) en tu zona`} />

      <Seg options={[{ id: "mia", label: "Asignados" }, { id: "disponibles", label: "Disponibles en tu zona" }]} value={vista} onChange={setVista} />

      <View style={s.search}>
        <MaterialCommunityIcons name="magnify" size={19} color={C.muted} />
        <TextInput style={s.searchInput} value={query} onChangeText={setQuery} placeholder="Buscar por cliente, código, documento o distrito" placeholderTextColor={C.placeholder} autoCorrect={false} />
        {query ? <Pressable onPress={() => setQuery("")} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={18} color={C.placeholder} /></Pressable> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
        {FILTROS.filter((f) => vista === "mia" || f.id !== "ALTA").map((f) => (
          <Pressable key={f.id} onPress={() => setFiltro(f.id)} style={[s.filter, filtro === f.id && s.filterOn]}>
            <Text style={[s.filterText, filtro === f.id && s.filterTextOn]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {vista === "disponibles" ? (
        <>
          <Text style={s.hint}>Casos pendientes de tu departamento que ningún auditor ha tomado. Al tomar uno, pasa a tu muestra.</Text>
          {errorDisponibles && !disponibles.length ? <Empty title="No pudimos cargar la lista" text={errorDisponibles} /> : null}
          {!errorDisponibles && !loadingDisponibles && !visiblesDisp.length ? <Empty title="Nada para mostrar" text={disponibles.length ? "Ningún caso coincide con la búsqueda o el filtro." : "No hay casos pendientes sin tomar en tu zona."} /> : null}
          {visiblesDisp.map((exp) => {
            const claiming = claimingId === exp.id_expediente;
            return (
              <View key={exp.id_expediente} style={s.row}>
                <Avatar name={exp.nombres_cliente} size={44} />
                <View style={s.rowBody}>
                  <View style={s.rowTop}><Text style={s.name} numberOfLines={1}>{exp.nombres_cliente}</Text><Etiqueta exp={exp} /></View>
                  <Text style={s.meta} numberOfLines={1}>{exp.codigo_expediente} · {exp.distrito || "Sin distrito"}</Text>
                  <Text style={s.addr} numberOfLines={1}>{exp.direccion_domicilio || "Sin dirección registrada"}</Text>
                  <Pressable onPress={() => tomarCaso(exp.id_expediente)} disabled={claiming} style={[s.takeBtn, claiming && { opacity: 0.6 }]}>
                    <MaterialCommunityIcons name={claiming ? "timer-sand" : "hand-extended-outline"} size={16} color="#fff" />
                    <Text style={s.takeText}>{claiming ? "Tomando…" : "Tomar este caso"}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </>
      ) : (
        <>
          {error && !asignaciones.length ? <Empty title="No pudimos cargar tu muestra" text={error} /> : null}
          {!error && !asignaciones.length ? <Empty title="Sin casos asignados" text="Tu supervisor aún no te asignó una muestra. Revisa «Disponibles en tu zona» para tomar un caso." /> : null}
          {!!asignaciones.length && !visiblesMias.length ? <Empty title="Nada para mostrar" text="Ningún caso coincide con la búsqueda o el filtro." /> : null}
          {visiblesMias.map((item) => {
            const exp = item.expediente;
            const dist = distanciaA(exp);
            return (
              <Pressable key={item.id_asignacion} onPress={() => setSelected(item)} style={({ pressed }) => [s.row, pressed && s.rowPressed]}>
                <Avatar name={exp.nombres_cliente} size={44} />
                <View style={s.rowBody}>
                  <View style={s.rowTop}><Text style={s.name} numberOfLines={1}>{exp.nombres_cliente}</Text><Etiqueta exp={exp} /></View>
                  <Text style={s.meta} numberOfLines={1}>{exp.codigo_expediente} · {exp.distrito || "Sin distrito"}</Text>
                  <Text style={s.addr} numberOfLines={1}>{exp.direccion_domicilio || "Sin dirección registrada"}</Text>
                  <View style={s.rowFoot}>
                    {item.prioridad === "ALTA" ? <Badge status="NO_ENCONTRADO" label="Prioridad alta" /> : null}
                    {dist ? <View style={s.dist}><MaterialCommunityIcons name="navigation-variant-outline" size={13} color={C.primary} /><Text style={s.distText}>a {dist}</Text></View> : null}
                    <View style={{ flex: 1 }} />
                    <Pressable onPress={(e) => { e.stopPropagation(); comoLlegar(exp); }} hitSlop={6} style={s.goto}>
                      <MaterialCommunityIcons name="directions" size={15} color={C.primary} />
                      <Text style={s.gotoText}>Cómo llegar</Text>
                    </Pressable>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={C.placeholder} />
              </Pressable>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 50, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 14, paddingHorizontal: 14, backgroundColor: "#fff" },
  searchInput: { flex: 1, fontSize: 14, color: C.ink, paddingVertical: 10 },
  filters: { gap: 8, paddingRight: 8 },
  filter: { paddingHorizontal: 15, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.borderStrong, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  filterOn: { backgroundColor: C.blue50, borderColor: C.primary2 },
  filterText: { fontSize: 12.5, fontWeight: "500", color: C.text2 },
  filterTextOn: { color: C.primary, fontWeight: "700" },
  hint: { fontSize: 12, color: C.muted, lineHeight: 17 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: C.border, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, ...shadow.sm },
  rowPressed: { backgroundColor: C.surface2 },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flex: 1, fontSize: 15.5, fontWeight: "700", color: C.ink },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  tagText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  meta: { fontSize: 12, color: C.text2, fontWeight: "500" },
  addr: { fontSize: 12, color: C.muted },
  rowFoot: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  dist: { flexDirection: "row", alignItems: "center", gap: 4 },
  distText: { fontSize: 12, fontWeight: "600", color: C.primary },
  goto: { flexDirection: "row", alignItems: "center", gap: 4 },
  gotoText: { fontSize: 12, fontWeight: "600", color: C.primary },
  takeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10, minHeight: 44, borderRadius: 12, backgroundColor: C.primary },
  takeText: { fontSize: 13.5, fontWeight: "600", color: "#fff" },
});
