import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../AuthContext";
import { Badge, Card, Empty, Header, Loading, Screen } from "../ui";
import { C } from "../theme";
import { cacheGet, cacheSet, pendingVisitCount } from "../offlineSync";

const CACHE_KEY_MUESTRA = "mias_v1";

const STAT_TILES: { key: string; label: string; icon: string; tint: string }[] = [
  { key: "total", label: "Expedientes asignados", icon: "folder-account-outline", tint: C.primary },
  { key: "alta", label: "Prioridad alta", icon: "alert-octagon-outline", tint: C.danger },
  { key: "consumo", label: "Créditos consumo", icon: "account-cash-outline", tint: C.info },
  { key: "otros", label: "Créditos otros (MYPE)", icon: "store-outline", tint: C.warning },
];

export default function DashboardScreen({ refreshRevision = 0 }: { refreshRevision?: number }) {
  const { api, user } = useAuth();
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [pendientesSync, setPendientesSync] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const requestId = useRef(0);

  const load = useCallback(async (background = false) => {
    const current = ++requestId.current;
    if (background) setRefreshing(true);
    try {
      const [r, pending]: [any, number] = await Promise.all([api("/api/asignaciones/mias"), pendingVisitCount()]);
      if (!mounted.current || current !== requestId.current) return;
      setAsignaciones(r.data || []);
      setPendientesSync(pending);
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
  const prioritarias = [...altaPrioridad].slice(0, 3);

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}>
      <Header title="Mi jornada" subtitle="Auditoría de visitas · Caja Huancayo" />
      <LinearGradient colors={[C.navy, C.navy2, C.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <View style={s.heroGlow} />
        <Text style={s.hello}>HOLA, {(user?.nombres || user?.username || "AUDITOR").toUpperCase()}</Text>
        <Text style={s.title}>Tu muestra asignada,{"\n"}lista para verificar.</Text>
        <View style={s.sync}>
          <View style={[s.dot, refreshing && s.dotBusy]} />
          <Text style={s.syncText}>{refreshing ? "Actualizando datos…" : "Sincronizado con el backoffice"}</Text>
        </View>
      </LinearGradient>
      {error && !asignaciones.length ? (
        <Empty title="No pudimos cargar tu muestra" text={error} />
      ) : (
        <>
          <View style={s.grid}>
            {STAT_TILES.map((tile) => (
              <Card key={tile.key} style={s.kpi}>
                <View style={[s.kpiIcon, { backgroundColor: `${tile.tint}18` }]}>
                  <MaterialCommunityIcons name={tile.icon as any} size={20} color={tile.tint} />
                </View>
                <Text style={s.value}>{stats[tile.key]}</Text>
                <Text style={s.label}>{tile.label}</Text>
              </Card>
            ))}
          </View>

          {prioritarias.length ? (
            <Card>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>Prioridad alta</Text>
                <Badge status="NO_ENCONTRADO" label={`${altaPrioridad.length} en total`} />
              </View>
              {prioritarias.map((item, index) => (
                <View key={item.id_asignacion} style={[s.priorityRow, index === prioritarias.length - 1 && s.priorityRowLast]}>
                  <View style={s.priorityDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.priorityName}>{item.expediente?.nombres_cliente}</Text>
                    <Text style={s.prioritySub}>{item.expediente?.codigo_expediente} · {item.expediente?.distrito || "Sin distrito"}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color="#9AA5B5" />
                </View>
              ))}
            </Card>
          ) : null}

          <Card>
            <View style={s.routeRow}>
              <View style={[s.routeIcon, pendientesSync ? s.routeIconWarn : null]}>
                <MaterialCommunityIcons name={pendientesSync ? "cloud-alert-outline" : "cloud-check-outline"} size={26} color={pendientesSync ? C.warning : C.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.routeTitle}>{pendientesSync ? `${pendientesSync} visita(s) por sincronizar` : "Todo sincronizado"}</Text>
                <Text style={s.routeSub}>{pendientesSync ? "Se enviarán automáticamente al recuperar conexión." : "No hay visitas pendientes de envío."}</Text>
              </View>
              {pendientesSync ? <Badge status="PENDIENTE" label="Pendiente" /> : <Badge status="ACTIVO" label="Al día" />}
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { padding: 22, borderRadius: 24, gap: 10, overflow: "hidden" },
  heroGlow: { position: "absolute", width: 180, height: 180, borderRadius: 100, right: -60, top: -70, backgroundColor: "#4B70FF22" },
  hello: { color: "#8DB1FF", fontWeight: "900", fontSize: 10, letterSpacing: 1.2 },
  title: { color: "#fff", fontSize: 27, lineHeight: 32, fontWeight: "900" },
  sync: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 4 },
  dot: { width: 7, height: 7, borderRadius: 7, backgroundColor: "#4CE0A7" },
  dotBusy: { backgroundColor: "#FBBF24" },
  syncText: { color: "#C6D5F6", fontSize: 11 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpi: { width: "48%", minHeight: 122 },
  kpiIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  value: { fontSize: 26, fontWeight: "900", color: C.text, marginTop: 10 },
  label: { fontSize: 11, fontWeight: "700", color: C.muted, marginTop: 3 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "900", color: C.text },
  priorityRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  priorityRowLast: { borderBottomWidth: 0 },
  priorityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.danger },
  priorityName: { fontSize: 13, fontWeight: "800", color: C.text },
  prioritySub: { fontSize: 11, color: C.muted, marginTop: 2 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  routeIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: "#EAFBF3", alignItems: "center", justifyContent: "center" },
  routeIconWarn: { backgroundColor: "#FFF6E5" },
  routeTitle: { fontSize: 16, fontWeight: "900", color: C.text },
  routeSub: { fontSize: 11, lineHeight: 16, color: C.muted, marginTop: 3 },
});
