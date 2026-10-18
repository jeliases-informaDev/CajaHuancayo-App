import React, { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../AuthContext";
import { nombreDeEmpresa, useEmpresa } from "../empresa";
import { Avatar, Button, Card, Header, Screen } from "../ui";
import { C, shadow } from "../theme";
import { discardRejectedVisit, lastSyncError, pendingVisitCount, rejectedVisits, syncPendingVisits, type RejectedVisit } from "../offlineSync";

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
  const empresa = useEmpresa();
  const displayName = advisorDisplayName(user);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<RejectedVisit[]>([]);
  const refreshPending = useCallback(() => {
    pendingVisitCount().then(setPending).catch(() => {});
    lastSyncError().then(setSyncError).catch(() => {});
    rejectedVisits().then(setRejected).catch(() => {});
  }, []);
  const discard = (visit: RejectedVisit) => Alert.alert(
    "Descartar visita rechazada",
    "Se borra del celular (ficha, fotos y firma). El expediente sigue en tu muestra y puedes volver a registrar la visita.",
    [
      { text: "Cancelar", style: "cancel" },
      { text: "Descartar", style: "destructive", onPress: () => { discardRejectedVisit(visit.id).then(refreshPending).catch(() => {}); } },
    ],
  );
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
      refreshPending();
      const rechazadas = result.rejected.length
        ? `\n\n${result.rejected.length} visita(s) fueron rechazadas por el servidor (ver abajo el motivo).`
        : "";
      Alert.alert(
        result.pending ? "Sincronización pendiente" : (result.synced ? "Visitas enviadas" : "Sin visitas por enviar"),
        (result.pending
          ? (reason ? `No se pudo enviar: ${reason}` : `${result.pending} visita(s) siguen seguras en el dispositivo y se reintentarán automáticamente.`)
          : "No quedan visitas pendientes de envío.") + rechazadas,
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
    <Header title="Perfil" subtitle="Cuenta, dispositivo y sincronización" />
    <View style={s.profile}>
      <Avatar name={displayName} size={60} />
      <View style={{ flex: 1 }}>
        <Text style={s.name}>{displayName}</Text>
        <Text style={s.username}>@{user?.username}</Text>
        <View style={s.roleBadge}><View style={s.roleDot} /><Text style={s.role}>{user?.rol || "AUDITOR"}</Text></View>
      </View>
    </View>
    <Card>
      <Text style={s.sectionLabel}>CUENTA Y SINCRONIZACIÓN</Text>
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
    {rejected.length ? (
      <Card>
        <Text style={s.sectionLabel}>VISITAS RECHAZADAS</Text>
        {rejected.map((visit) => (
          <View key={visit.id} style={s.syncErrorBox}>
            <MaterialCommunityIcons name="alert-octagon-outline" size={16} color={C.danger} />
            <View style={{ flex: 1 }}>
              <Text style={s.syncErrorText}>{`Expediente #${visit.idExpediente}: ${visit.reason}`}</Text>
              <Pressable onPress={() => discard(visit)} style={({ pressed }) => [s.discardBtn, pressed && s.pressed]}>
                <Text style={s.discardText}>Descartar</Text>
              </Pressable>
            </View>
          </View>
        ))}
        <Text style={s.rowSub}>No se reintentan solas. El expediente sigue en tu muestra: corrige lo indicado y vuelve a registrar la visita.</Text>
      </Card>
    ) : null}
    <Card>
      <Text style={s.sectionLabel}>AJUSTES</Text>
      <Pressable onPress={openSettings} style={({ pressed }) => [s.row, pressed && s.pressed]}><View style={[s.rowIcon, s.settingsIcon]}><MaterialCommunityIcons name="cellphone-cog" size={22} color={C.primary} /></View><View style={s.rowCopy}><Text style={s.rowTitle}>Permisos del dispositivo</Text><Text style={s.rowSub}>Administra ubicación, cámara y notificaciones.</Text></View><MaterialCommunityIcons name="chevron-right" size={22} color={C.placeholder} /></Pressable>
      <View style={s.separator} />
      <Pressable onPress={showFieldHelp} style={({ pressed }) => [s.row, pressed && s.pressed]}><View style={[s.rowIcon, s.helpIcon]}><MaterialCommunityIcons name="book-open-variant" size={22} color={C.warning} /></View><View style={s.rowCopy}><Text style={s.rowTitle}>Guía de la visita de auditoría</Text><Text style={s.rowSub}>Recomendaciones para registrar una ficha completa.</Text></View><MaterialCommunityIcons name="chevron-right" size={22} color={C.placeholder} /></Pressable>
    </Card>
    <Button title="Cerrar sesión" kind="danger" icon="logout" onPress={logout} />
    <Text style={s.version}>Auditoría de Visitas · {nombreDeEmpresa(empresa) || "Sulotec"} · Versión 0.1.0</Text>
  </Screen>;
}

const s = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 18, ...shadow.sm },
  name: { fontSize: 19, fontWeight: "700", color: C.ink, letterSpacing: -0.2 },
  username: { color: C.muted, fontSize: 12.5, fontWeight: "500", marginTop: 2 },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: C.successBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 8 },
  roleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
  role: { fontSize: 10.5, fontWeight: "700", color: C.success, letterSpacing: 0.5 },
  sectionLabel: { fontSize: 11, color: C.muted, fontWeight: "700", letterSpacing: 0.6, marginBottom: 6 },
  row: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 10 },
  rowIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  successIcon: { backgroundColor: C.successBg },
  syncIcon: { backgroundColor: C.blue50 },
  settingsIcon: { backgroundColor: C.blue50 },
  helpIcon: { backgroundColor: C.warningBg },
  rowCopy: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: "600", color: C.ink },
  rowSub: { fontSize: 12, lineHeight: 17, color: C.muted, marginTop: 2 },
  separator: { height: 1, backgroundColor: C.border },
  online: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.successBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
  onlineText: { color: C.success, fontSize: 10.5, fontWeight: "700" },
  pending: { backgroundColor: C.warningBg },
  pendingDot: { backgroundColor: C.warning },
  pendingText: { color: C.warning },
  pressed: { opacity: 0.6 },
  version: { textAlign: "center", fontSize: 11, color: C.placeholder },
  discardBtn: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: C.danger },
  discardText: { fontSize: 12, fontWeight: "600", color: C.danger },
  syncErrorBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: C.dangerBg, borderRadius: 8, padding: 10, marginTop: 2 },
  syncErrorText: { flex: 1, fontSize: 12, lineHeight: 17, color: C.danger, fontWeight: "500" },
});
