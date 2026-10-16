import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../AuthContext";
import { Avatar, Badge, Card, Empty, Loading, Screen } from "../ui";
import { C, F, G, shadow } from "../theme";
import { cacheGet, cacheSet, pendingVisitCount, rejectedVisits } from "../offlineSync";

const CACHE_KEY_MUESTRA = "mias_v1";

function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
const formatoDistancia = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

export default function DashboardScreen({ refreshRevision = 0, onNavigate, currentLocation }: {
  refreshRevision?: number; onNavigate?: (tab: string) => void; currentLocation?: { latitude: number; longitude: number } | null;
}) {
  const { api, user } = useAuth();
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [pendientesSync, setPendientesSync] = useState(0);
  const [rechazadas, setRechazadas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const requestId = useRef(0);

  const load = useCallback(async (background = false) => {
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
      const r: any = await api("/api/asignaciones/mias");
      if (!mounted.current || current !== requestId.current) return;
      setAsignaciones(r.data || []);
      setError("");
      cacheSet(CACHE_KEY_MUESTRA, r.data || []);
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
  useEffect(() => { if (refreshRevision > 0) load(true); }, [refreshRevision, load]);

  if (loading && !asignaciones.length) return <Loading />;

  const consumo = asignaciones.filter((a) => a.expediente?.tipo_credito === "CONSUMO").length;
  const otros = asignaciones.filter((a) => a.expediente?.tipo_credito === "OTROS").length;
  const altaPrioridad = asignaciones.filter((a) => a.prioridad === "ALTA");
  const stats: Record<string, number> = { total: asignaciones.length, alta: altaPrioridad.length, consumo, otros };

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

  const acciones = [
    { key: "muestra", label: "Mi muestra", icon: "folder-account-outline" },
    { key: "mapa", label: "Mapa", icon: "map-marker-radius-outline" },
    { key: "mas", label: "Sincronización", icon: "cloud-sync-outline", alerta: porEnviar > 0 },
  ];

  const comoLlegar = () => {
    const e = siguiente?.a.expediente;
    const destino = e?.latitud != null && Number.isFinite(Number(e.latitud)) ? `${e.latitud},${e.longitud}` : encodeURIComponent([e?.direccion_domicilio, e?.distrito].filter(Boolean).join(", "));
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destino}`);
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}>
      <View style={s.greetRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.date}>{fecha}</Text>
          <Text style={s.greet}>Hola, <Text style={s.greetName}>{nombre}</Text></Text>
        </View>
        <View style={s.syncPill}>
          <View style={[s.dot, (refreshing || pendientesSync > 0) && s.dotBusy]} />
          <Text style={s.syncText}>{refreshing ? "Actualizando" : pendientesSync ? `${pendientesSync} por enviar` : "Al día"}</Text>
        </View>
      </View>

      <LinearGradient colors={[...G.hero]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <LinearGradient colors={[...G.glow]} start={{ x: 0, y: 1 }} end={{ x: 0.9, y: 0.1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <Text style={s.heroEyebrow}>En tu muestra</Text>
        <View style={s.heroNumRow}>
          <Text style={s.heroNum}>{stats.total}</Text>
          <Text style={s.heroUnit}>{stats.total === 1 ? "caso por visitar" : "casos por visitar"}</Text>
        </View>
        <View style={s.heroBar}>
          {stats.otros > 0 ? <View style={[s.heroBarSeg, { flex: stats.otros, backgroundColor: C.magenta }]} /> : null}
          {stats.consumo > 0 ? <View style={[s.heroBarSeg, { flex: stats.consumo, backgroundColor: C.primary }]} /> : null}
          {!stats.total ? <View style={[s.heroBarSeg, { flex: 1, backgroundColor: C.soft }]} /> : null}
        </View>
        <View style={s.heroLegend}>
          <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: C.magenta }]} /><Text style={s.legendText}>MYPE <Text style={s.legendB}>{stats.otros}</Text></Text></View>
          <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: C.primary }]} /><Text style={s.legendText}>Consumo <Text style={s.legendB}>{stats.consumo}</Text></Text></View>
        </View>
        <View style={s.heroStats}>
          <View style={s.heroStat}><Text style={[s.heroStatNum, stats.alta ? { color: C.danger } : null]}>{stats.alta}</Text><Text style={s.heroStatLabel}>Prioritarios</Text></View>
          <View style={s.heroStatSep} />
          <View style={s.heroStat}><Text style={s.heroStatNum}>{porEnviar}</Text><Text style={s.heroStatLabel}>Por enviar</Text></View>
        </View>
      </LinearGradient>

      {error && !asignaciones.length ? (
        <Empty title="No pudimos cargar tu muestra" text={error} />
      ) : (
        <>
          {siguiente ? (
            <Card style={s.next}>
              <View style={s.nextHead}>
                <Text style={s.nextEyebrow}>Siguiente caso</Text>
                <View style={[s.typeChip, { backgroundColor: esMype ? C.magentaBg : C.infoBg }]}>
                  <MaterialCommunityIcons name={esMype ? "store-outline" : "account-cash-outline"} size={13} color={esMype ? C.magenta : C.primary} />
                  <Text style={[s.typeText, { color: esMype ? C.magenta : C.primary }]}>{esMype ? "MYPE" : "CONSUMO"}</Text>
                </View>
              </View>
              <View style={s.nextBody}>
                <Avatar name={siguiente.a.expediente?.nombres_cliente} size={52} />
                <View style={{ flex: 1 }}>
                  <Text style={s.nextName} numberOfLines={2}>{siguiente.a.expediente?.nombres_cliente}</Text>
                  <View style={s.nextMeta}>
                    <MaterialCommunityIcons name="map-marker-outline" size={14} color={C.muted} />
                    <Text style={s.nextAddr} numberOfLines={2}>{siguiente.a.expediente?.distrito || "Sin distrito"} · {siguiente.a.expediente?.direccion_domicilio || "Sin dirección"}</Text>
                  </View>
                </View>
              </View>
              <View style={s.nextChips}>
                {siguiente.d != null ? <View style={s.distChip}><MaterialCommunityIcons name="navigation-variant-outline" size={14} color={C.primary} /><Text style={s.distText}>a {formatoDistancia(siguiente.d)}</Text></View> : null}
                {siguiente.a.prioridad === "ALTA" ? <Badge status="NO_ENCONTRADO" label="Prioridad alta" /> : null}
              </View>
              <View style={s.nextActions}>
                <Pressable style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.8 }]} onPress={comoLlegar} accessibilityRole="button">
                  <LinearGradient colors={[...G.action]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.primaryBtnIn}>
                    <MaterialCommunityIcons name="directions" size={19} color="#fff" />
                    <Text style={s.primaryText}>Cómo llegar</Text>
                  </LinearGradient>
                </Pressable>
                <Pressable style={({ pressed }) => [s.ghostBtn, pressed && { opacity: 0.7 }]} onPress={() => onNavigate?.("muestra")} accessibilityRole="button">
                  <Text style={s.ghostText}>Ver muestra</Text>
                  <MaterialCommunityIcons name="arrow-right" size={16} color={C.ink} />
                </Pressable>
              </View>
            </Card>
          ) : null}

          <View style={s.actions}>
            {acciones.map((a) => (
              <Pressable key={a.key} style={({ pressed }) => [s.action, pressed && { opacity: 0.75 }]} onPress={() => onNavigate?.(a.key)} accessibilityRole="button">
                <View style={s.actionIcon}>
                  <MaterialCommunityIcons name={a.icon as any} size={22} color={C.primary} />
                  {a.alerta ? <View style={s.actionBadge} /> : null}
                </View>
                <Text style={s.actionLabel}>{a.label}</Text>
              </Pressable>
            ))}
          </View>

          {porEnviar ? (
            <Card>
              <View style={s.routeRow}>
                <View style={[s.routeIcon, s.routeIconWarn, rechazadas ? { backgroundColor: C.dangerBg } : null]}>
                  <MaterialCommunityIcons name={rechazadas ? "alert-octagon-outline" : "cloud-alert-outline"} size={24} color={rechazadas ? C.danger : C.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.routeTitle}>{rechazadas ? `${rechazadas} visita(s) rechazada(s)` : `${pendientesSync} visita(s) por sincronizar`}</Text>
                  <Text style={s.routeSub}>{rechazadas ? "No se enviaron. Abre Perfil para ver el motivo; el expediente sigue en tu muestra." : "Se enviarán automáticamente al recuperar conexión."}</Text>
                </View>
              </View>
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  greetRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  date: { fontSize: 12.5, fontWeight: "500", color: C.muted },
  greet: { fontFamily: F.display, fontSize: 38, lineHeight: 42, fontWeight: "normal", color: C.ink, letterSpacing: -0.9 },
  greetName: { fontFamily: F.italic, color: C.primary },
  syncPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, marginTop: 4, ...shadow.sm },
  syncText: { fontSize: 11.5, fontWeight: "600", color: C.text2 },
  dot: { width: 7, height: 7, borderRadius: 7, backgroundColor: C.success },
  dotBusy: { backgroundColor: "#E89A0C" },
  hero: { borderRadius: 24, padding: 22, overflow: "hidden", gap: 4, borderWidth: 1, borderColor: C.border, ...shadow.sm },
  heroEyebrow: { fontSize: 13, fontWeight: "600", color: C.muted },
  heroNumRow: { flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 2 },
  heroNum: { fontFamily: F.display, fontSize: 76, lineHeight: 80, fontWeight: "normal", color: C.ink, letterSpacing: -2 },
  heroUnit: { fontSize: 14.5, color: C.text2, fontWeight: "500" },
  heroBar: { flexDirection: "row", height: 8, borderRadius: 5, overflow: "hidden", gap: 3, marginTop: 14 },
  heroBarSeg: { borderRadius: 4 },
  heroLegend: { flexDirection: "row", gap: 18, marginTop: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 7 },
  legendDot: { width: 8, height: 8, borderRadius: 3 },
  legendText: { fontSize: 12.5, color: C.text2 },
  legendB: { color: C.ink, fontWeight: "700" },
  heroStats: { flexDirection: "row", alignItems: "center", marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.border },
  heroStat: { flex: 1, gap: 1 },
  heroStatNum: { fontFamily: F.display, fontSize: 34, lineHeight: 36, fontWeight: "normal", color: C.ink, letterSpacing: -0.6 },
  heroStatLabel: { fontSize: 12, color: C.muted, fontWeight: "500" },
  heroStatSep: { width: 1, height: 38, backgroundColor: C.border, marginHorizontal: 14 },
  next: { gap: 14 },
  nextHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nextEyebrow: { fontSize: 13, fontWeight: "600", color: C.muted },
  typeChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  typeText: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.4 },
  nextBody: { flexDirection: "row", gap: 14, alignItems: "center" },
  nextName: { fontFamily: F.display, fontSize: 27, lineHeight: 30, fontWeight: "normal", color: C.ink, letterSpacing: -0.4 },
  nextMeta: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 5 },
  nextAddr: { flex: 1, fontSize: 12.5, lineHeight: 17, color: C.muted },
  nextChips: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  distChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.blue50, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  distText: { fontSize: 12.5, fontWeight: "700", color: C.primary },
  nextActions: { flexDirection: "row", gap: 10 },
  primaryBtn: { flex: 1.3, borderRadius: 14, ...shadow.sm },
  primaryBtnIn: { minHeight: 50, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  ghostBtn: { flex: 1, minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 14, borderWidth: 1, borderColor: C.borderStrong, backgroundColor: C.surface },
  ghostText: { fontSize: 14, fontWeight: "600", color: C.ink },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1, alignItems: "center", gap: 9, paddingVertical: 15, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, ...shadow.sm },
  actionIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: C.blue50 },
  actionBadge: { position: "absolute", top: 8, right: 8, width: 10, height: 10, borderRadius: 5, backgroundColor: C.danger, borderWidth: 2, borderColor: "#fff" },
  actionLabel: { fontSize: 12.5, fontWeight: "600", color: C.text },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  routeIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: "#E4F7EF", alignItems: "center", justifyContent: "center" },
  routeIconWarn: { backgroundColor: C.warningBg },
  routeTitle: { fontSize: 14.5, fontWeight: "700", color: C.ink },
  routeSub: { fontSize: 12, lineHeight: 17, color: C.muted, marginTop: 3 },
});
