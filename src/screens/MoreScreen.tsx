import React, { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../AuthContext";
import { Button, Card, Header, Screen } from "../ui";
import { C } from "../theme";
import { lastSyncError, pendingVisitCount, syncPendingVisits } from "../offlineSync";

const advisorDisplayName = (user: {
  nombres?: string;
  apellidos?: string;
  username?: string;
} | null) => {
  const names = user?.nombres?.trim().replace(/\s+/g, " ") || "";
  const firstSurname = user?.apellidos?.trim().split(/\s+/)[0] || "";
  return [names, firstSurname].filter(Boolean).join(" ") || user?.username || "Auditor";
};

export default function MoreScreen() {
  const { user, token, logout, offlineSession } = useAuth();
  const displayName = advisorDisplayName(user);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const refreshPending = useCallback(() => {
    pendingVisitCount().then(setPending).catch(() => {});
    lastSyncError().then(setSyncError).catch(() => {});
  }, []);
  useEffect(() => {
    refreshPending();
    const timer = setInterval(refreshPending, 5000);
    return () => clearInterval(timer);
  }, [refreshPending]);
  const syncNow = async () => {
    if (syncing) return;
    try {
      setSyncing(true);
      const result = await syncPendingVisits(token);
      setPending(result.pending);
      const reason = await lastSyncError();
      setSyncError(reason);
      Alert.alert(
        result.pending ? "Sincronización pendiente" : "Todo sincronizado",
        result.pending
          ? (reason ? `No se pudo enviar: ${reason}` : `${result.pending} visita(s) siguen seguras en el dispositivo y se reintentarán automáticamente.`)
          : "No quedan visitas ni evidencias pendientes de envío.",
      );
    } finally {
      setSyncing(false);
    }
  };

  const openSettings = async () => {
    try { await Linking.openSettings(); }
    catch { Alert.alert("Ajustes no disponibles", "Abre los ajustes del teléfono y selecciona esta app."); }
  };
  const showFieldHelp = () => Alert.alert("Visita de auditoría", "Mantén activa la ubicación durante la visita. Antes de guardar, verifica la fotografía, la firma del cliente y responde el cuestionario completo.");

  return <Screen>
    <Header title="Mi perfil" subtitle="Cuenta operativa de campo" />
    <View style={s.profile}>
      <View style={s.avatar}><Text style={s.letter}>{displayName[0].toUpperCase()}</Text></View>
      <Text style={s.name}>{displayName}</Text><Text style={s.username}>@{user?.username}</Text>
      <View style={s.roleBadge}><View style={s.roleDot} /><Text style={s.role}>{user?.rol || "AUDITOR"}</Text></View>
    </View>
    <Card>
      <Text style={s.sectionLabel}>ESTADO DE LA CUENTA</Text>
      {offlineSession ? <View style={s.row}><View style={[s.rowIcon, s.helpIcon]}><MaterialCommunityIcons name="timer-lock-outline" size={22} color={C.warning} /></View><View style={s.rowCopy}><Text style={s.rowTitle}>Acceso offline limitado</Text><Text style={s.rowSub}>Sesión cifrada válida hasta 8 horas. Se revalidará automáticamente al recuperar Internet.</Text></View></View> : null}
      <View style={s.row}><View style={[s.rowIcon, s.successIcon]}><MaterialCommunityIcons name="shield-check-outline" size={22} color={C.success} /></View><View style={s.rowCopy}><Text style={s.rowTitle}>Sesión protegida</Text><Text style={s.rowSub}>Tu acceso corresponde a una cuenta activa vinculada a este dispositivo.</Text></View><MaterialCommunityIcons name="check-circle" size={19} color={C.success} /></View>
      <View style={s.separator} />
      <Pressable onPress={syncNow} style={({ pressed }) => [s.row, pressed && s.pressed]}><View style={[s.rowIcon, s.syncIcon]}><MaterialCommunityIcons name={syncing ? "sync" : "sync-circle"} size={22} color={C.primary} /></View><View style={s.rowCopy}><Text style={s.rowTitle}>Sincronización operativa</Text><Text style={s.rowSub}>{pending ? `${pending} visita(s) guardadas localmente. Toca para reintentar.` : "Las visitas y evidencias están sincronizadas con el backoffice."}</Text></View><View style={[s.online, pending > 0 && s.pending]}><View style={[s.onlineDot, pending > 0 && s.pendingDot]} /><Text style={[s.onlineText, pending > 0 && s.pendingText]}>{pending ? `${pending} pendiente${pending === 1 ? "" : "s"}` : "Activa"}</Text></View></Pressable>
      {pending && syncError ? (
        <View style={s.syncErrorBox}>
          <MaterialCommunityIcons name="alert-circle-outline" size={14} color={C.danger} />
          <Text style={s.syncErrorText} numberOfLines={2}>{syncError}</Text>
        </View>
      ) : null}
    </Card>
    <Card>
      <Text style={s.sectionLabel}>AJUSTES Y AYUDA</Text>
      <Pressable onPress={openSettings} style={({ pressed }) => [s.row, pressed && s.pressed]}><View style={[s.rowIcon, s.settingsIcon]}><MaterialCommunityIcons name="cellphone-cog" size={22} color={C.primary} /></View><View style={s.rowCopy}><Text style={s.rowTitle}>Permisos del dispositivo</Text><Text style={s.rowSub}>Administra ubicación, cámara y notificaciones.</Text></View><MaterialCommunityIcons name="chevron-right" size={22} color="#9AA5B5" /></Pressable>
      <View style={s.separator} />
      <Pressable onPress={showFieldHelp} style={({ pressed }) => [s.row, pressed && s.pressed]}><View style={[s.rowIcon, s.helpIcon]}><MaterialCommunityIcons name="book-open-variant" size={22} color={C.warning} /></View><View style={s.rowCopy}><Text style={s.rowTitle}>Guía de la visita de auditoría</Text><Text style={s.rowSub}>Recomendaciones para registrar una ficha completa.</Text></View><MaterialCommunityIcons name="chevron-right" size={22} color="#9AA5B5" /></Pressable>
    </Card>
    <Button title="Cerrar sesión" kind="danger" icon="logout" onPress={logout} />
    <Text style={s.version}>Auditoría de Visitas · Caja Huancayo · Versión 0.1.0</Text>
  </Screen>;
}

const s = StyleSheet.create({
  profile: { alignItems: "center", backgroundColor: C.navy, borderRadius: 24, padding: 24 }, avatar: { width: 70, height: 70, borderRadius: 22, backgroundColor: C.primary2, alignItems: "center", justifyContent: "center" }, letter: { fontSize: 28, fontWeight: "900", color: "#fff" }, name: { fontSize: 20, fontWeight: "900", color: "#fff", marginTop: 12 }, username: { color: "#B9C9ED", fontSize: 11, fontWeight: "700", marginTop: 3 },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#173A7A", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, marginTop: 10 }, roleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success }, role: { fontSize: 9, fontWeight: "900", color: "#DCE6FF", letterSpacing: 1 },
  sectionLabel: { fontSize: 9, color: C.muted, fontWeight: "900", letterSpacing: 1, marginBottom: 7 }, row: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 10 }, rowIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" }, successIcon: { backgroundColor: "#E5F8F2" }, syncIcon: { backgroundColor: "#E8EEFF" }, settingsIcon: { backgroundColor: "#EAF2FF" }, helpIcon: { backgroundColor: "#FFF5DB" },
  rowCopy: { flex: 1 }, rowTitle: { fontSize: 14, fontWeight: "900", color: C.text }, rowSub: { fontSize: 10.5, lineHeight: 15, color: C.muted, marginTop: 3 }, separator: { height: 1, backgroundColor: C.border }, online: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#E5F8F2", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12 }, onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success }, onlineText: { color: C.success, fontSize: 9, fontWeight: "900" }, pending: { backgroundColor: "#FFF2D7" }, pendingDot: { backgroundColor: C.warning }, pendingText: { color: "#9A6300" }, pressed: { opacity: 0.62 }, version: { textAlign: "center", fontSize: 10, color: C.muted },
  syncErrorBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: "#FFF1F2", borderRadius: 10, padding: 9, marginTop: 2 }, syncErrorText: { flex: 1, fontSize: 10.5, lineHeight: 14, color: C.danger, fontWeight: "700" },
});
