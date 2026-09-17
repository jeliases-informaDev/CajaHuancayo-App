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
import { LinearGradient } from "expo-linear-gradient";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import { AuthProvider, useAuth } from "./src/AuthContext";
import { C } from "./src/theme";
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
  if (loading)
    return (
      <View style={s.loading}>
        <MaterialCommunityIcons name="clipboard-check-outline" size={42} color={C.primary} />
        <ActivityIndicator size="large" color={C.primary} />
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
        />
      </View>
      <View
        style={[
          s.nav,
          { marginBottom: Math.max(insets.bottom, 8) },
        ]}
      >
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
              {selected ? <LinearGradient colors={[C.primary2, C.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.iconWrap, s.iconWrapActive]}>
                <MaterialCommunityIcons
                  name={item.active}
                  size={23}
                  color="#fff"
                />
              </LinearGradient> : <View style={s.iconWrap}><MaterialCommunityIcons name={item.icon} size={22} color="#78869B" /></View>}
              <Text style={[s.navLabel, selected && s.navLabelActive]}>
                {item.label}
              </Text>
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
  loadingText: { color: C.muted, fontWeight: "700" },
  offline: {
    backgroundColor: C.redDark,
    paddingBottom: 7,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  locationWarning: { backgroundColor: "#C56A00", paddingBottom: 7, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  locationWarningPressed: { opacity: 0.82 },
  offlineText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  nav: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E4EAF3",
    borderRadius: 23,
    flexDirection: "row",
    height: 72,
    marginHorizontal: 10,
    paddingHorizontal: 7,
    paddingVertical: 7,
    elevation: 18,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.13,
    shadowRadius: 14,
  },
  navItem: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 17 },
  navItemPressed: { opacity: 0.62, transform: [{ scale: 0.96 }] },
  iconWrap: {
    width: 40,
    height: 34,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: { elevation: 7, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 7 },
  navLabel: { fontSize: 9, lineHeight: 11, color: "#78869B", fontWeight: "700" },
  navLabelActive: { color: C.primary, fontWeight: "900" },
});
