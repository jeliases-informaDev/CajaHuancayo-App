import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../AuthContext";
import { Badge, Card, Empty, Header, Loading, Screen } from "../ui";
import { C } from "../theme";
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

  const acciones = [
    { key: "muestra", label: "Mi muestra", icon: "folder-account-outline" },
    { key: "mapa", label: "Mapa", icon: "map-marker-radius-outline" },
    { key: "mas", label: "Sincronización", icon: "cloud-sync-outline", alerta: pendientesSync + rechazadas > 0 },
  ];

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}>
      <Header
        title={`Hola, ${nombre}`}
        subtitle={new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" }).replace(/^./, (c) => c.toUpperCase())}
        right={
          <View style={s.syncPill}>
            <View style={[s.dot, (refreshing || pendientesSync > 0) && s.dotBusy]} />
            <Text style={s.syncText}>{refreshing ? "Actualizando" : pendientesSync ? `${pendientesSync} pendiente(s)` : "Sincronizado"}</Text>
          </View>
        }
      />

      <Card style={s.summary}>
        <View style={s.summaryCol}><Text style={s.summaryValue}>{stats.total}</Text><Text style={s.summaryLabel}>Por visitar</Text></View>
        <View style={s.summaryDivider} />
        <View style={s.summaryCol}><Text style={[s.summaryValue, stats.alta ? { color: C.danger } : null]}>{stats.alta}</Text><Text style={s.summaryLabel}>Prioritarios</Text></View>
        <View style={s.summaryDivider} />
        <View style={s.summaryCol}><Text style={s.summaryValue}>{pendientesSync + rechazadas}</Text><Text style={s.summaryLabel}>Por enviar</Text></View>
      </Card>

      {error && !asignaciones.length ? (
        <Empty title="No pudimos cargar tu muestra" text={error} />
      ) : (
        <>
          {siguiente ? (
            <Card style={s.next}>
              <View style={s.nextHead}>
                <Text style={s.nextEyebrow}>SIGUIENTE CASO</Text>
                <View style={[s.typeChip, { backgroundColor: esMype ? C.magentaBg : C.infoBg }]}>
                  <MaterialCommunityIcons name={esMype ? "store-outline" : "account-cash-outline"} size={12} color={esMype ? C.magenta : C.primary} />
                  <Text style={[s.typeText, { color: esMype ? C.magenta : C.primary }]}>{esMype ? "MYPE" : "CONSUMO"}</Text>
                </View>
              </View>
              <Text style={s.nextName} numberOfLines={1}>{siguiente.a.expediente?.nombres_cliente}</Text>
              <View style={s.nextMeta}>
                <MaterialCommunityIcons name="map-marker-outline" size={14} color={C.muted} />
                <Text style={s.nextAddr} numberOfLines={1}>{siguiente.a.expediente?.distrito || "Sin distrito"} · {siguiente.a.expediente?.direccion_domicilio || "Sin dirección"}</Text>
              </View>
              <View style={s.nextActions}>
                {siguiente.d != null ? <View style={s.distChip}><MaterialCommunityIcons name="navigation-variant-outline" size={13} color={C.violet} /><Text style={s.distText}>a {formatoDistancia(siguiente.d)}</Text></View> : <View style={{ flex: 1 }} />}
                <Pressable
                  style={s.ghostBtn}
                  onPress={() => {
                    const e = siguiente.a.expediente;
                    const destino = e?.latitud != null && Number.isFinite(Number(e.latitud)) ? `${e.latitud},${e.longitud}` : encodeURIComponent([e?.direccion_domicilio, e?.distrito].filter(Boolean).join(", "));
                    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destino}`);
                  }}
                >
                  <MaterialCommunityIcons name="directions" size={16} color={C.navy2} />
                  <Text style={s.ghostText}>Cómo llegar</Text>
                </Pressable>
                <Pressable style={s.goBtn} onPress={() => onNavigate?.("muestra")}>
                  <Text style={s.goText}>Abrir muestra</Text>
                  <MaterialCommunityIcons name="arrow-right" size={16} color="#fff" />
                </Pressable>
              </View>
            </Card>
          ) : null}

          <View style={s.actions}>
            {acciones.map((a) => (
              <Pressable key={a.key} style={s.action} onPress={() => onNavigate?.(a.key)}>
                <View style={s.actionIcon}>
                  <MaterialCommunityIcons name={a.icon as any} size={22} color={C.primary} />
                  {a.alerta ? <View style={s.actionBadge} /> : null}
                </View>
                <Text style={s.actionLabel}>{a.label}</Text>
              </Pressable>
            ))}
          </View>

          <Card style={s.types}>
            <Text style={s.typesTitle}>Mi muestra por tipo de crédito</Text>
            {[{ label: "MYPE · Créditos Otros", n: stats.otros, color: C.magenta, icon: "store-outline" }, { label: "Consumo", n: stats.consumo, color: C.primary, icon: "account-cash-outline" }].map((t) => (
              <View key={t.label} style={s.typeRow}>
                <MaterialCommunityIcons name={t.icon as any} size={18} color={t.color} />
                <Text style={s.typeLabel}>{t.label}</Text>
                <View style={s.typeBar}><View style={[s.typeBarFill, { width: `${stats.total ? Math.round((t.n / stats.total) * 100) : 0}%`, backgroundColor: t.color }]} /></View>
                <Text style={s.typeCount}>{t.n}</Text>
              </View>
            ))}
          </Card>

          {pendientesSync || rechazadas ? (
            <Card>
              <View style={s.routeRow}>
                <View style={[s.routeIcon, s.routeIconWarn]}>
                  <MaterialCommunityIcons name={rechazadas ? "alert-octagon-outline" : "cloud-alert-outline"} size={24} color={rechazadas ? C.danger : C.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.routeTitle}>{rechazadas ? `${rechazadas} visita(s) rechazada(s)` : `${pendientesSync} visita(s) por sincronizar`}</Text>
                  <Text style={s.routeSub}>{rechazadas ? "No se enviaron. Abre Perfil para ver el motivo; el expediente sigue en tu muestra." : "Se enviarán automáticamente al recuperar conexión."}</Text>
                </View>
                {!rechazadas ? <Badge status="PENDIENTE" label="Pendiente" /> : null}
              </View>
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  syncPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  syncText: { fontSize: 11.5, fontWeight: "600", color: C.text2 },
  dot: { width: 7, height: 7, borderRadius: 7, backgroundColor: C.success },
  dotBusy: { backgroundColor: "#E89A0C" },
  summary: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  summaryCol: { flex: 1, alignItems: "center", gap: 2 },
  summaryValue: { fontSize: 28, fontWeight: "700", color: C.ink, letterSpacing: -0.6 },
  summaryLabel: { fontSize: 12, color: C.muted, fontWeight: "500" },
  summaryDivider: { width: 1, height: 34, backgroundColor: C.border },
  next: { gap: 6 },
  nextHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nextEyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 0.4, color: C.muted },
  typeChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  nextName: { fontSize: 18, fontWeight: "700", color: C.ink, letterSpacing: -0.3 },
  nextMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  nextAddr: { flex: 1, fontSize: 12, color: C.muted },
  nextActions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  distChip: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  distText: { fontSize: 12.5, fontWeight: "600", color: C.primary },
  ghostBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: C.borderStrong, backgroundColor: "#fff" },
  ghostText: { fontSize: 12.5, fontWeight: "600", color: C.ink },
  goBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, backgroundColor: C.primary },
  goText: { fontSize: 12.5, fontWeight: "600", color: "#fff" },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1, alignItems: "center", gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: C.border },
  actionIcon: { width: 44, height: 44, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: C.blue50 },
  actionBadge: { position: "absolute", top: 8, right: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: C.danger, borderWidth: 1.5, borderColor: "#fff" },
  actionLabel: { fontSize: 12, fontWeight: "600", color: C.text },
  types: { gap: 12 },
  typesTitle: { fontSize: 13, fontWeight: "700", color: C.ink },
  typeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  typeLabel: { width: 128, fontSize: 12.5, color: C.text2, fontWeight: "500" },
  typeBar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.soft, overflow: "hidden" },
  typeBarFill: { height: 6, borderRadius: 3 },
  typeCount: { width: 26, textAlign: "right", fontSize: 13, fontWeight: "700", color: C.ink },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  routeIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: "#E4F7EF", alignItems: "center", justifyContent: "center" },
  routeIconWarn: { backgroundColor: "#FFF3D9" },
  routeTitle: { fontSize: 14.5, fontWeight: "700", color: C.ink },
  routeSub: { fontSize: 11, lineHeight: 16, color: C.muted, marginTop: 3 },
});
