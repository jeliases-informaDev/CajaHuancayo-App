import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import { AuthProvider, useAuth } from "./src/AuthContext";
import { useFonts, InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif";
import { Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { LinearGradient } from "expo-linear-gradient";
import { C, FI, G, N } from "./src/theme";
import BienvenidaScreen from "./src/screens/BienvenidaScreen";
import LoginScreen from "./src/screens/LoginScreen";
import TerminosScreen from "./src/screens/TerminosScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import MapScreen from "./src/screens/MapScreen";
import MiMuestraScreen from "./src/screens/MiMuestraScreen";
import MoreScreen from "./src/screens/MoreScreen";
import { useFieldRealtime } from "./src/useFieldRealtime";
import { useAuditorLocation } from "./src/useAuditorLocation";
import {
  cacheGet,
  cacheSet,
  registerOfflineSyncTask,
  syncPendingVisits,
} from "./src/offlineSync";
// Versión de los términos aceptada en este celular por cada usuario (para no bloquear al abrir la app sin conexión).
const claveTerminos = (userId: string) => "ch_terminos_" + userId;
type Tab = "principal" | "muestra" | "mapa" | "mas";
const tabs: any[] = [
  { key: "principal", label: "Hoy", icon: "home-outline", active: "home" },
  {
    key: "muestra",
    label: "Mi muestra",
    icon: "folder-account-outline",
    active: "folder-account",
  },
  { key: "mapa", label: "Mapa", icon: "map-outline", active: "map" },
  {
    key: "mas",
    label: "Perfil",
    icon: "account-circle-outline",
    active: "account-circle",
  },
];
function Shell() {
  const { token, user, loading, api, offlineSession } = useAuth();
  const [fontsLoaded, fontsError] = useFonts({ InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic, Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [tab, setTab] = useState<Tab>("principal");
  // Al abrir la app sin sesión se ve primero la Bienvenida; «Entrar» lleva al inicio de sesión. Al cerrar sesión vuelve a empezar por ahí.
  const [entrar, setEntrar] = useState(false);
  // Caso que «Revisar caso» (pantalla Hoy) pide abrir al llegar a Mi muestra.
  const [abrir, setAbrir] = useState<any>(null);
  const irA = useCallback((siguiente: Tab, caso?: any) => { setAbrir(caso ?? null); setTab(siguiente); }, []);
  useEffect(() => { if (token) setEntrar(false); }, [token]);
  const [online, setOnline] = useState(true);
  const [revision, setRevision] = useState(0);
  const [renderedRevision, setRenderedRevision] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  // Términos y condiciones: antes de usar la app se comprueba si el usuario aceptó la versión vigente; si no, se le muestran.
  const [terminos, setTerminos] = useState<"cargando" | "pendiente" | "ok">("cargando");
  useEffect(() => {
    if (!token || !user) { setTerminos("cargando"); return; }
    let vigente = true;
    (async () => {
      const previa = await cacheGet<string>(claveTerminos(user.id)).catch(() => null);
      try {
        const r: any = await api("/api/terminos");
        if (!vigente) return;
        if (r?.data?.aceptado) { await cacheSet(claveTerminos(user.id), r.data.version); setTerminos("ok"); } else setTerminos("pendiente");
      } catch {
        // Sin conexión: si en este celular ya se aceptó alguna versión, se deja pasar y se vuelve a comprobar con red.
        if (vigente) setTerminos(previa?.value ? "ok" : "pendiente");
      }
    })();
    return () => { vigente = false; };
  }, [token, user?.id]);
  const { location, error: locationError } = useAuditorLocation(api, Boolean(token));
  useFieldRealtime(refresh);
  useEffect(() => {
    if (!detailOpen) setRenderedRevision(revision);
  }, [detailOpen, revision]);
  useEffect(() => {
    if (!token) return;
    registerOfflineSyncTask().catch(() => {});
    syncPendingVisits(token).catch(() => {});
    return NetInfo.addEventListener((state) => {
      const connected = Boolean(
        state.isConnected && state.isInternetReachable !== false,
      );
      setOnline(connected);
      if (connected) syncPendingVisits(token).catch(() => {});
    });
  }, [token]);
  if (loading || (!fontsLoaded && !fontsError))
    return (
      <View style={s.loading}>
        <LinearGradient colors={[...G.brand]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.loadingMark}>
          <MaterialCommunityIcons name="map-marker-check" size={34} color="#fff" />
        </LinearGradient>
        <ActivityIndicator size="small" color={C.primary} />
        <Text style={s.loadingText}>Preparando la app de auditoría</Text>
      </View>
    );
  if (!token) return entrar ? <LoginScreen /> : <BienvenidaScreen onEntrar={() => setEntrar(true)} />;
  if (terminos === "cargando")
    return (
      <View style={s.loading}>
        <ActivityIndicator size="small" color={C.primary} />
        <Text style={s.loadingText}>Comprobando tu acceso</Text>
      </View>
    );
  if (terminos === "pendiente")
    return <TerminosScreen onAceptado={async (version) => { if (user) await cacheSet(claveTerminos(user.id), version).catch(() => {}); setTerminos("ok"); }} />;
  const ScreenComponent: any = {
    principal: DashboardScreen,
    muestra: MiMuestraScreen,
    mapa: MapScreen,
    mas: MoreScreen,
  }[tab];
  return (
    <View style={s.shell}>
      {offlineSession ? (
        <View style={[s.offline, { paddingTop: Math.max(insets.top, 8) }]}>
          <MaterialCommunityIcons name="shield-lock-outline" size={16} color="#fff" />
          <Text style={s.offlineText}>Acceso offline protegido · válido hasta 8 horas</Text>
        </View>
      ) : null}
      {!online && !offlineSession ? (
        <View style={[s.offline, { paddingTop: Math.max(insets.top, 8) }]}>
          <MaterialCommunityIcons name="wifi-off" size={16} color="#fff" />
          <Text style={s.offlineText}>
            Sin conexión · tus visitas se guardarán y sincronizarán después
          </Text>
        </View>
      ) : null}
      {online && locationError ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir ajustes del permiso de ubicación"
          onPress={() => Linking.openSettings()}
          style={({ pressed }) => [
            s.locationWarning,
            { paddingTop: Math.max(insets.top, 8) },
            pressed && s.locationWarningPressed,
          ]}
        >
          <MaterialCommunityIcons name="crosshairs-question" size={16} color="#fff" />
          <Text style={s.offlineText}>{locationError}</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color="#fff" />
        </Pressable>
      ) : null}
      <View style={s.screen}>
        <ScreenComponent
          key={tab}
          refreshRevision={renderedRevision}
          currentLocation={location}
          onDetailVisibilityChange={setDetailOpen}
          abrirAsignacion={abrir}
          onNavigate={(next: Tab, caso?: any) => irA(next, caso)}
        />
      </View>
      <View style={[s.nav, { paddingBottom: Math.max(insets.bottom, 6) }]}>
        {tabs.map((item) => {
          const selected = tab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => irA(item.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [s.navItem, pressed && s.navItemPressed]}
            >
              <View style={[s.navPill, selected && s.navPillOn]}>
                <MaterialCommunityIcons name={selected ? item.active : item.icon} size={24} color={selected ? N.marca : N.apagado} />
              </View>
              <Text style={[s.navLabel, selected && s.navLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Shell />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  shell: { flex: 1, backgroundColor: C.bg },
  screen: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 15,
    backgroundColor: C.bg,
  },
  loadingMark: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  loadingText: { color: C.muted, fontWeight: "600" },
  offline: {
    backgroundColor: C.navy,
    paddingBottom: 7,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  locationWarning: { backgroundColor: C.warning, paddingBottom: 7, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  locationWarningPressed: { opacity: 0.82 },
  offlineText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  nav: { backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: C.border, flexDirection: "row", paddingTop: 6, shadowColor: "#0E1332", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: -3 }, elevation: 8 },
  navItem: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 2, paddingTop: 2, paddingBottom: 4 },
  navItemPressed: { opacity: 0.6 },
  navPill: { width: 58, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  navPillOn: { backgroundColor: N.suave },
  navLabel: { fontFamily: FI.med, fontSize: 12, lineHeight: 15, color: N.apagado },
  navLabelActive: { fontFamily: FI.bold, color: N.marca },
});
