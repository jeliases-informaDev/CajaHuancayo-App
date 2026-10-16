import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../AuthContext";
import { Badge, Card, Empty, Header, Loading, Screen } from "../ui";
import { C } from "../theme";
import FichaWizard from "../ficha/FichaWizard";
import { cacheGet, cacheSet } from "../offlineSync";

const CACHE_KEY_MUESTRA = "mias_v1";
const CACHE_KEY_GEO = "geo_cfg_v1";
// Valores por defecto del servidor; se reemplazan por los reales (GET /api/visitas/config).
const GEO_DEFAULT = { radio: 300, precision: 100 };

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

  const priorityColor = (p: string) => (p === "ALTA" ? C.danger : p === "BAJA" ? C.muted : C.warning);
  const initialsOf = (name: string) => (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const comoLlegar = (lat: number, lng: number) => {
    const origin = currentLocation ? `&origin=${currentLocation.latitude},${currentLocation.longitude}` : "";
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${origin}`);
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={vista === "mia" ? refreshing : loadingDisponibles} onRefresh={() => (vista === "mia" ? load(true) : loadDisponibles())} colors={[C.primary]} />}>
      <Header title="Mi muestra" subtitle={vista === "mia" ? `${asignaciones.length} expediente(s) asignado(s)` : `${disponibles.length} disponible(s) en tu zona`} />

      <View style={s.tabsRow}>
        <Pressable onPress={() => setVista("mia")} style={[s.tabBtn, vista === "mia" && s.tabBtnOn]}>
          <Text style={[s.tabBtnText, vista === "mia" && s.tabBtnTextOn]}>Mi muestra</Text>
        </Pressable>
        <Pressable onPress={() => setVista("disponibles")} style={[s.tabBtn, vista === "disponibles" && s.tabBtnOn]}>
          <Text style={[s.tabBtnText, vista === "disponibles" && s.tabBtnTextOn]}>Disponibles en tu zona</Text>
        </Pressable>
      </View>

      {vista === "disponibles" ? (
        <>
          <Text style={s.qHint}>Expedientes pendientes de tu departamento que ningún auditor ha tomado todavía. Al tomar uno, pasa a tu muestra.</Text>
          {errorDisponibles && !disponibles.length ? <Empty title="No pudimos cargar la lista" text={errorDisponibles} /> : null}
          {!errorDisponibles && !loadingDisponibles && !disponibles.length ? <Empty title="Nada disponible por ahora" text="No hay expedientes pendientes sin tomar en tu zona." /> : null}
          {disponibles.map((expediente) => {
            const isOtros = expediente.tipo_credito === "OTROS";
            const claiming = claimingId === expediente.id_expediente;
            return (
              <Card key={expediente.id_expediente} style={s.listCard}>
                <View style={s.listRow}>
                  <View style={[s.avatar, { backgroundColor: isOtros ? "#FCE8F3" : "#E9EEFC" }]}>
                    <Text style={[s.avatarText, { color: isOtros ? C.magenta : C.primary }]}>{initialsOf(expediente.nombres_cliente)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.listTitle} numberOfLines={1}>{expediente.nombres_cliente}</Text>
                    <View style={s.chipRow}>
                      <View style={[s.typeChip, { backgroundColor: isOtros ? "#FCE8F3" : "#E9EEFC" }]}>
                        <MaterialCommunityIcons name={isOtros ? "store-outline" : "account-cash-outline"} size={12} color={isOtros ? C.magenta : C.primary} />
                        <Text style={[s.typeChipText, { color: isOtros ? C.magenta : C.primary }]}>{expediente.tipo_credito}</Text>
                      </View>
                      <Text style={s.listCode}>{expediente.codigo_expediente}</Text>
                    </View>
                    <View style={s.listMetaRow}>
                      <MaterialCommunityIcons name="map-marker-outline" size={13} color={C.muted} />
                      <Text style={s.listSub} numberOfLines={1}>{expediente.distrito || "Sin distrito"} · {expediente.direccion_domicilio || "Sin dirección"}</Text>
                    </View>
                  </View>
                </View>
                <Pressable onPress={() => tomarCaso(expediente.id_expediente)} disabled={claiming} style={[s.claimBtn, claiming && s.claimBtnDisabled]}>
                  <MaterialCommunityIcons name={claiming ? "timer-sand" : "hand-extended-outline"} size={16} color="#fff" />
                  <Text style={s.claimBtnText}>{claiming ? "Tomando…" : "Tomar este caso"}</Text>
                </Pressable>
              </Card>
            );
          })}
        </>
      ) : (
      <>
      {error && !asignaciones.length ? <Empty title="No pudimos cargar tu muestra" text={error} /> : null}
      {!error && !asignaciones.length ? <Empty title="Sin expedientes asignados" text="Tu supervisor aún no te ha asignado una muestra, o revisa «Disponibles en tu zona» para tomar uno tú mismo." /> : null}
      {asignaciones.map((item) => {
        const isOtros = item.expediente.tipo_credito === "OTROS";
        const accent = priorityColor(item.prioridad);
        return (
          <Pressable key={item.id_asignacion} onPress={() => setSelected(item)} style={({ pressed }) => pressed && s.listCardPressed}>
            <Card style={StyleSheet.flatten([s.listCard, { borderLeftColor: accent, borderLeftWidth: 4 }])}>
              <View style={s.listRow}>
                <View style={[s.avatar, { backgroundColor: isOtros ? "#FCE8F3" : "#E9EEFC" }]}>
                  <Text style={[s.avatarText, { color: isOtros ? C.magenta : C.primary }]}>{initialsOf(item.expediente.nombres_cliente)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.listHeader}>
                    <Text style={s.listTitle} numberOfLines={1}>{item.expediente.nombres_cliente}</Text>
                    <Badge status={item.prioridad === "ALTA" ? "NO_ENCONTRADO" : item.prioridad === "BAJA" ? "INACTIVO" : "PENDIENTE"} label={item.prioridad} />
                  </View>
                  <View style={s.chipRow}>
                    <View style={[s.typeChip, { backgroundColor: isOtros ? "#FCE8F3" : "#E9EEFC" }]}>
                      <MaterialCommunityIcons name={isOtros ? "store-outline" : "account-cash-outline"} size={12} color={isOtros ? C.magenta : C.primary} />
                      <Text style={[s.typeChipText, { color: isOtros ? C.magenta : C.primary }]}>{item.expediente.tipo_credito}</Text>
                    </View>
                    <Text style={s.listCode}>{item.expediente.codigo_expediente}</Text>
                  </View>
                  <View style={s.listMetaRow}>
                    <MaterialCommunityIcons name="map-marker-outline" size={13} color={C.muted} />
                    <Text style={s.listSub} numberOfLines={1}>{item.expediente.distrito || "Sin distrito"} · {item.expediente.direccion_domicilio || "Sin dirección"}</Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#C3CCDB" />
              </View>
              {Number.isFinite(Number(item.expediente.latitud)) && Number.isFinite(Number(item.expediente.longitud)) ? (
                <Pressable
                  onPress={(e) => { e.stopPropagation(); comoLlegar(Number(item.expediente.latitud), Number(item.expediente.longitud)); }}
                  style={({ pressed }) => [s.gotoRow, pressed && s.pressed]}
                >
                  <MaterialCommunityIcons name="directions" size={15} color={C.primary} />
                  <Text style={s.gotoText}>Cómo llegar</Text>
                </Pressable>
              ) : null}
            </Card>
          </Pressable>
        );
      })}
      </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  tabsRow: { flexDirection: "row", gap: 8, marginTop: 4, marginBottom: 2 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: "#F1F5F9" },
  tabBtnOn: { backgroundColor: C.primary },
  tabBtnText: { fontSize: 12.5, fontWeight: "800", color: C.muted },
  tabBtnTextOn: { color: "#fff" },
  claimBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10, paddingVertical: 10, borderRadius: 12, backgroundColor: C.primary },
  claimBtnDisabled: { opacity: 0.6 },
  claimBtnText: { fontSize: 13, fontWeight: "800", color: "#fff" },
  closeBtn: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F5F9" },
  checklist: { flexDirection: "row", gap: 14, paddingHorizontal: 2, marginTop: -6 },
  checklistItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  checklistText: { fontSize: 11, fontWeight: "800", color: "#9AA5B5" },
  checklistTextDone: { color: C.success },
  backRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, alignSelf: "flex-start" },
  backRowText: { fontSize: 13, fontWeight: "800", color: C.primary },
  listCard: { gap: 0, paddingVertical: 12 },
  listCardPressed: { opacity: 0.75 },
  gotoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border, alignSelf: "flex-start" },
  gotoText: { fontSize: 12, fontWeight: "800", color: C.primary },
  pressed: { opacity: 0.6 },
  listRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 13, fontWeight: "900" },
  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  listTitle: { fontSize: 14, fontWeight: "900", color: C.text, flex: 1, marginRight: 8 },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5 },
  typeChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  typeChipText: { fontSize: 9.5, fontWeight: "900", letterSpacing: 0.3 },
  listCode: { fontSize: 11, color: C.muted, fontWeight: "700" },
  listMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
  listSub: { fontSize: 11.5, color: C.muted, flexShrink: 1 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, gap: 10 },
  infoLabel: { fontSize: 11, color: C.muted, fontWeight: "700" },
  infoValue: { fontSize: 12, color: C.text, fontWeight: "700", flexShrink: 1, textAlign: "right" },
  resultGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  resultChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: "#fff" },
  resultChipOn: { backgroundColor: C.primary, borderColor: C.primary },
  resultChipText: { fontSize: 12, fontWeight: "800", color: C.muted },
  resultChipTextOn: { color: "#fff" },
  qHint: { fontSize: 11, color: C.muted, marginBottom: 4 },
  qRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, gap: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  qLabel: { fontSize: 12, color: C.text, flex: 1, fontWeight: "600" },
  qButtons: { flexDirection: "row", gap: 8 },
  qBtn: { width: 50, height: 42, borderRadius: 11, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  qBtnYesOn: { backgroundColor: C.success, borderColor: C.success },
  qBtnNoOn: { backgroundColor: C.danger, borderColor: C.danger },
  qBtnText: { fontSize: 11, fontWeight: "900", color: C.muted },
  qBtnTextOn: { color: "#fff" },
  field: { gap: 6, marginTop: 8 },
  textInput: { minHeight: 44, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, fontSize: 13, color: C.text, backgroundColor: "#fff" },
  textArea: { minHeight: 80, paddingTop: 10, textAlignVertical: "top" },
  photoRow: { flexDirection: "row", gap: 10 },
  photoBox: { flex: 1, minHeight: 90, borderRadius: 14, borderWidth: 1, borderColor: C.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#F9FBFE" },
  photoLabel: { fontSize: 11, fontWeight: "700", color: C.muted, textAlign: "center" },
  error: { color: C.danger, fontSize: 12, textAlign: "center" },
  cameraControls: { position: "absolute", bottom: 40, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30 },
  cameraCancel: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#00000080", alignItems: "center", justifyContent: "center" },
  cameraShutter: { width: 74, height: 74, borderRadius: 37, backgroundColor: "#ffffff40", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff" },
  cameraShutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },
});
