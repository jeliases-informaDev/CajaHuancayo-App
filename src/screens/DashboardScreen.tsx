import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../AuthContext";
import { Badge, Card, Empty, Header, Loading, Screen } from "../ui";
import { C } from "../theme";
import { pendingVisitCount } from "../offlineSync";

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
    } catch (e: any) {
      if (mounted.current && current === requestId.current) setError(e.message);
    } finally {
      if (mounted.current && current === requestId.current) { setLoading(false); setRefreshing(false); }
    }
  }, [api]);

  useEffect(() => {
    mounted.current = true;
    load();
    const timer = setInterval(() => load(true), 20000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, [load]);
  useEffect(() => { if (refreshRevision > 0) load(true); }, [refreshRevision, load]);

  if (loading && !asignaciones.length) return <Loading />;

  const consumo = asignaciones.filter((a) => a.expediente?.tipo_credito === "CONSUMO").length;
  const otros = asignaciones.filter((a) => a.expediente?.tipo_credito === "OTROS").length;
  const altaPrioridad = asignaciones.filter((a) => a.prioridad === "ALTA").length;

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}>
      <Header title="Mi jornada" subtitle="Auditoría de visitas · Caja Huancayo" />
      <LinearGradient colors={[C.navy, C.primary]} style={s.hero}>
        <Text style={s.hello}>HOLA, {(user?.nombres || user?.username || "AUDITOR").toUpperCase()}</Text>
        <Text style={s.title}>Tu muestra asignada,{"\n"}lista para verificar.</Text>
        <View style={s.sync}>
          <View style={s.dot} />
          <Text style={s.syncText}>{refreshing ? "Actualizando datos…" : "Sincronizado con el backoffice"}</Text>
        </View>
      </LinearGradient>
      {error && !asignaciones.length ? (
        <Empty title="No pudimos cargar tu muestra" text={error} />
      ) : (
        <>
          <View style={s.grid}>
            {[
              ["Expedientes asignados", asignaciones.length, "folder-account-outline"],
              ["Prioridad alta", altaPrioridad, "alert-octagon-outline"],
              ["Créditos consumo", consumo, "account-cash-outline"],
              ["Créditos otros (MYPE)", otros, "store-outline"],
            ].map(([label, value, icon]) => (
              <Card key={String(label)} style={s.kpi}>
                <MaterialCommunityIcons name={icon as any} size={23} color={C.primary} />
                <Text style={s.value}>{value}</Text>
                <Text style={s.label}>{label}</Text>
              </Card>
            ))}
          </View>
          <Card>
            <View style={s.routeRow}>
              <View style={s.routeIcon}>
                <MaterialCommunityIcons name="cloud-sync-outline" size={26} color={C.primary} />
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
  hello: { color: "#8DB1FF", fontWeight: "900", fontSize: 10, letterSpacing: 1.2 },
  title: { color: "#fff", fontSize: 27, lineHeight: 32, fontWeight: "900" },
  sync: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 4 },
  dot: { width: 7, height: 7, borderRadius: 7, backgroundColor: "#4CE0A7" },
  syncText: { color: "#C6D5F6", fontSize: 11 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpi: { width: "48%", minHeight: 128 },
  value: { fontSize: 28, fontWeight: "900", color: C.text, marginTop: 10 },
  label: { fontSize: 11, fontWeight: "700", color: C.muted, marginTop: 3 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  routeIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  routeTitle: { fontSize: 16, fontWeight: "900", color: C.text },
  routeSub: { fontSize: 11, lineHeight: 16, color: C.muted, marginTop: 3 },
});
