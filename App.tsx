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
import { LinearGradient } from "expo-linear-gradient";
import { C, G } from "./src/theme";
import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import MapScreen from "./src/screens/MapScreen";
import MiMuestraScreen from "./src/screens/MiMuestraScreen";
import MoreScreen from "./src/screens/MoreScreen";
import { useFieldRealtime } from "./src/useFieldRealtime";
import { useAuditorLocation } from "./src/useAuditorLocation";
import {
  registerOfflineSyncTask,
  syncPendingVisits,
} from "./src/offlineSync";
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
  const { token, loading, api, offlineSession } = useAuth();
  const [fontsLoaded, fontsError] = useFonts({ InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic });
  const [tab, setTab] = useState<Tab>("principal");
  const [online, setOnline] = useState(true);
  const [revision, setRevision] = useState(0);
  const [renderedRevision, setRenderedRevision] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
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
  if (!token) return <LoginScreen />;
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
          onNavigate={(next: Tab) => setTab(next)}
        />
      </View>
      <View style={[s.nav, { paddingBottom: Math.max(insets.bottom, 6) }]}>
        {tabs.map((item) => {
          const selected = tab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [s.navItem, pressed && s.navItemPressed]}
            >
              <View style={[s.navPill, selected && s.navPillOn]}>
                <MaterialCommunityIcons name={selected ? item.active : item.icon} size={23} color={selected ? C.primary : C.muted} />
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
  navPill: { width: 54, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  navPillOn: { backgroundColor: C.blue50 },
  navLabel: { fontSize: 11, lineHeight: 14, color: C.muted, fontWeight: "600" },
  navLabelActive: { color: C.primary, fontWeight: "700" },
});
