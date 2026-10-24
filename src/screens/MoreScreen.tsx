import React, { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useCameraPermissions } from "expo-camera";
import { useAuth } from "../AuthContext";
import { nombreDeEmpresa, useEmpresa } from "../empresa";
import { Screen } from "../ui";
import { FI, initials, N } from "../theme";
import { cacheGet, cacheSet, discardRejectedVisit, lastSyncError, pendingVisitCount, rejectedVisits, syncPendingVisits, type RejectedVisit } from "../offlineSync";

const CLAVE_ULTIMA_SYNC = "ultima_sync_v1";

const advisorDisplayName = (user: {
  nombres?: string;
  apellidos?: string;
  username?: string;
} | null) => {
  const names = user?.nombres?.trim().replace(/\s+/g, " ") || "";
  const firstSurname = user?.apellidos?.trim().split(/\s+/)[0] || "";
  return [names, firstSurname].filter(Boolean).join(" ") || user?.username || "Auditor";
};

const ROLES: Record<string, string> = { AUDITOR: "Auditor", SUPERVISOR: "Supervisor", ADMINISTRADOR: "Administrador" };
const hora = (iso: string) => new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const estadoPermiso = (granted?: boolean, canAskAgain?: boolean) => (granted ? "Permitido" : granted === undefined ? "Estado por verificar" : canAskAgain === false ? "Bloqueado: actívalo en ajustes" : "Sin permitir todavía");

export default function MoreScreen() {
  const { user, token, logout, offlineSession } = useAuth();
  const empresa = useEmpresa();
  const displayName = advisorDisplayName(user);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<RejectedVisit[]>([]);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [camara] = useCameraPermissions();
  const [ubicacion, setUbicacion] = useState<{ granted: boolean; canAskAgain: boolean } | null>(null);
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
  useEffect(() => {
    cacheGet<string>(CLAVE_ULTIMA_SYNC).then((c) => { if (c?.value) setUltimaSync(c.value); }).catch(() => {});
    Location.getForegroundPermissionsAsync().then((p) => setUbicacion({ granted: p.granted, canAskAgain: p.canAskAgain })).catch(() => {});
  }, []);
  const syncNow = async () => {
    if (syncing) return;
    try {
      setSyncing(true);
      const result = await syncPendingVisits(token);
      setPending(result.pending);
      const reason = await lastSyncError();
      setSyncError(reason);
      refreshPending();
      if (!result.pending) { const ahora = new Date().toISOString(); setUltimaSync(ahora); cacheSet(CLAVE_ULTIMA_SYNC, ahora).catch(() => {}); }
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

  const permisos = [
    { icono: "map-marker-outline", titulo: "Ubicación", estado: estadoPermiso(ubicacion?.granted, ubicacion?.canAskAgain), nota: "Se comparte con el supervisor solo durante la jornada de campo." },
    { icono: "camera-outline", titulo: "Cámara", estado: estadoPermiso(camara?.granted, camara?.canAskAgain) },
    { icono: "bell-outline", titulo: "Notificaciones", estado: "Estado por verificar" },
  ];

  return <Screen>
    <View>
      <Text style={s.titulo} accessibilityRole="header">Perfil</Text>
      <Text style={s.subtitulo}>Cuenta, dispositivo y sincronización</Text>
    </View>

    <View style={s.perfil}>
      <View style={s.avatar}><Text style={s.avatarTexto}>{initials(displayName)}</Text></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.nombre} numberOfLines={2}>{displayName}</Text>
        <Text style={s.usuario}>@{user?.username}</Text>
        <View style={s.rol}><Text style={s.rolTexto}>{ROLES[String(user?.rol || "AUDITOR")] || "Auditor"}</Text></View>
      </View>
    </View>

    <Text style={s.seccion} accessibilityRole="header">Cuenta y sincronización</Text>
    <View style={s.tarjeta}>
      {offlineSession ? (
        <>
          <View style={s.fila}>
            <MaterialCommunityIcons name="timer-lock-outline" size={24} color={N.ambar} />
            <View style={s.filaTexto}><Text style={s.filaTitulo}>Acceso offline limitado</Text><Text style={s.filaSub}>Sesión cifrada válida hasta 8 horas. Se revalidará automáticamente al recuperar Internet.</Text></View>
          </View>
          <View style={s.linea} />
        </>
      ) : null}
      <View style={s.fila}>
        <MaterialCommunityIcons name="shield-check-outline" size={24} color={N.verdeTexto} />
        <View style={s.filaTexto}><Text style={s.filaTitulo}>Sesión protegida</Text><Text style={s.filaSub}>Cuenta activa vinculada a este dispositivo.</Text></View>
      </View>
      <View style={s.linea} />
      <View style={s.sync}>
        <Text style={s.filaTitulo}>Sincronización</Text>
        <View style={[s.estado, pending > 0 && s.estadoPendiente]}><Text style={[s.estadoTexto, pending > 0 && { color: N.ambar }]}>{pending ? `${pending} pendiente${pending === 1 ? "" : "s"}` : "Activa"}</Text></View>
      </View>
      <Text style={s.filaSub}>{pending ? `${pending} visita(s) guardadas en el celular. Toca «Sincronizar ahora» para reintentar.` : `Última sincronización: ${ultimaSync ? hora(ultimaSync) : "no disponible"}.`}</Text>
      {pending && syncError ? (
        <View style={s.error}>
          <MaterialCommunityIcons name="alert-circle-outline" size={16} color={N.rojoTexto} />
          <Text style={s.errorTexto} numberOfLines={2}>{syncError}</Text>
        </View>
      ) : null}
      <Pressable onPress={syncNow} disabled={syncing} accessibilityRole="button" accessibilityLabel="Sincronización operativa: sincronizar ahora" style={({ pressed }) => [s.boton, (pressed || syncing) && { opacity: 0.7 }]}>
        <MaterialCommunityIcons name="sync" size={22} color={N.marca} />
        <Text style={s.botonTexto}>{syncing ? "Sincronizando…" : "Sincronizar ahora"}</Text>
      </Pressable>
    </View>

    {rejected.length ? (
      <View style={s.tarjeta}>
        <Text style={s.filaTitulo}>Visitas rechazadas</Text>
        {rejected.map((visit) => (
          <View key={visit.id} style={s.error}>
            <MaterialCommunityIcons name="alert-octagon-outline" size={18} color={N.rojoTexto} />
            <View style={{ flex: 1 }}>
              <Text style={s.errorTexto}>{`Expediente #${visit.idExpediente}: ${visit.reason}`}</Text>
              <Pressable onPress={() => discard(visit)} accessibilityRole="button" style={({ pressed }) => [s.descartar, pressed && { opacity: 0.6 }]}>
                <Text style={s.descartarTexto}>Descartar</Text>
              </Pressable>
            </View>
          </View>
        ))}
        <Text style={s.filaSub}>No se reintentan solas. El expediente sigue en tu muestra: corrige lo indicado y vuelve a registrar la visita.</Text>
      </View>
    ) : null}

    <Text style={s.seccion} accessibilityRole="header">Permisos del dispositivo</Text>
    <View style={s.tarjeta}>
      {permisos.map((p, i) => (
        <React.Fragment key={p.titulo}>
          {i > 0 ? <View style={s.linea} /> : null}
          <Pressable onPress={openSettings} accessibilityRole="button" accessibilityLabel={`${p.titulo}: ${p.estado}`} style={({ pressed }) => [s.fila, pressed && { opacity: 0.6 }]}>
            <MaterialCommunityIcons name={p.icono as any} size={24} color={N.marca} />
            <View style={s.filaTexto}><Text style={s.filaTitulo}>{p.titulo}</Text><Text style={s.filaSub}>{p.estado}</Text></View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={N.marca} />
          </Pressable>
          {p.nota ? <Text style={s.filaSub}>{p.nota}</Text> : null}
        </React.Fragment>
      ))}
      <Pressable onPress={openSettings} accessibilityRole="button" style={({ pressed }) => [s.boton, pressed && { opacity: 0.7 }]}>
        <MaterialCommunityIcons name="tune-variant" size={22} color={N.marca} />
        <Text style={s.botonTexto}>Revisar permisos</Text>
      </Pressable>
    </View>

    <Pressable onPress={showFieldHelp} accessibilityRole="button" style={({ pressed }) => [s.guia, pressed && { opacity: 0.6 }]}>
      <MaterialCommunityIcons name="book-open-variant" size={20} color={N.marca} />
      <Text style={s.guiaTexto}>Guía de la visita de auditoría</Text>
    </Pressable>

    <Pressable onPress={logout} accessibilityRole="button" style={({ pressed }) => [s.boton, s.cerrar, pressed && { opacity: 0.7 }]}>
      <MaterialCommunityIcons name="logout" size={22} color={N.marca} />
      <Text style={s.botonTexto}>Cerrar sesión</Text>
    </Pressable>
    <Text style={s.version}>Auditoría de Visitas · {nombreDeEmpresa(empresa) || "Sulotec"}{"\n"}Versión 0.1.0</Text>
  </Screen>;
}

const s = StyleSheet.create({
  titulo: { fontFamily: FI.bold, fontSize: 26, lineHeight: 32, color: "#000" },
  subtitulo: { fontFamily: FI.reg, fontSize: 14, color: N.apagado, marginTop: 2 },
  perfil: { flexDirection: "row", alignItems: "center", gap: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: N.borde, borderRadius: 20, padding: 18 },
  avatar: { width: 100, height: 100, borderRadius: 20, backgroundColor: N.suave, alignItems: "center", justifyContent: "center" },
  avatarTexto: { fontFamily: FI.bold, fontSize: 34, color: N.marca },
  nombre: { fontFamily: FI.bold, fontSize: 22, lineHeight: 28, color: "#000" },
  usuario: { fontFamily: FI.reg, fontSize: 15, color: N.apagado },
  rol: { alignSelf: "flex-start", backgroundColor: N.gris, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  rolTexto: { fontFamily: FI.semi, fontSize: 13, color: N.grisTexto },
  seccion: { fontFamily: FI.semi, fontSize: 20, color: N.tinta, marginTop: 4 },
  tarjeta: { backgroundColor: "#fff", borderWidth: 1, borderColor: N.borde, borderRadius: 20, padding: 16, gap: 12 },
  fila: { flexDirection: "row", alignItems: "center", gap: 12 },
  filaTexto: { flex: 1, gap: 2 },
  filaTitulo: { fontFamily: FI.semi, fontSize: 16, color: N.tinta },
  filaSub: { fontFamily: FI.reg, fontSize: 14, lineHeight: 20, color: N.apagado },
  linea: { height: 1, backgroundColor: N.borde2 },
  sync: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  estado: { backgroundColor: N.verdeFondo, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  estadoPendiente: { backgroundColor: N.ambarFondo },
  estadoTexto: { fontFamily: FI.semi, fontSize: 13, color: N.verdeTexto },
  boton: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: N.borde, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  botonTexto: { fontFamily: FI.semi, fontSize: 16, color: N.marca },
  cerrar: { marginTop: 4 },
  guia: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 4 },
  guiaTexto: { fontFamily: FI.med, fontSize: 14.5, color: N.marca },
  version: { textAlign: "center", fontFamily: FI.reg, fontSize: 13, lineHeight: 19, color: N.apagado },
  error: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: N.rojoFondo, borderRadius: 10, padding: 12 },
  errorTexto: { flex: 1, fontFamily: FI.med, fontSize: 13, lineHeight: 18, color: N.rojoTexto },
  descartar: { alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: N.rojoBoton },
  descartarTexto: { fontFamily: FI.semi, fontSize: 13, color: N.rojoBoton },
});
