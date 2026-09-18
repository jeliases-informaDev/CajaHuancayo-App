import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import NetInfo from "@react-native-community/netinfo";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../AuthContext";
import { Badge, Button, Card, Empty, Header, Loading, Screen, SectionTitle } from "../ui";
import { C, money } from "../theme";
import SignaturePad from "../SignaturePad";
import { getAuditVisitFix } from "../useAuditorLocation";
import { checkDeviceIntegrity } from "../deviceIntegrity";
import { getDeviceId } from "../deviceIdentity";
import { cacheGet, cacheSet, createOfflineVisitId, enqueueVisit, syncPendingVisits } from "../offlineSync";

const CACHE_KEY_MUESTRA = "mias_v1";

const RESULTADOS = [
  { value: "CONFORME", label: "Conforme", icon: "check-circle-outline" },
  { value: "OBSERVADO", label: "Observado", icon: "alert-circle-outline" },
  { value: "NO_UBICADO", label: "No ubicado", icon: "map-marker-remove-outline" },
  { value: "RECHAZADO", label: "Rechazado", icon: "close-circle-outline" },
];

type YesNo = boolean | null;

function YesNoRow({ label, value, onChange }: { label: string; value: YesNo; onChange: (v: YesNo) => void }) {
  return (
    <View style={s.qRow}>
      <Text style={s.qLabel}>{label}</Text>
      <View style={s.qButtons}>
        <Pressable onPress={() => onChange(true)} style={[s.qBtn, value === true && s.qBtnYesOn]}>
          <Text style={[s.qBtnText, value === true && s.qBtnTextOn]}>SI</Text>
        </Pressable>
        <Pressable onPress={() => onChange(false)} style={[s.qBtn, value === false && s.qBtnNoOn]}>
          <Text style={[s.qBtnText, value === false && s.qBtnTextOn]}>NO</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ExpedienteInfo({ expediente }: { expediente: any }) {
  const rows: [string, any][] = [
    ["Cliente", expediente.nombres_cliente],
    ["Documento", `${expediente.tipo_documento_cliente || "DNI"} ${expediente.numero_documento_cliente}`],
    ["Dirección", expediente.direccion_domicilio || "No registrada"],
    ["Distrito / Provincia", `${expediente.distrito || "-"} / ${expediente.provincia || "-"}`],
    ["Teléfono", expediente.telefono_cliente || "No registrado"],
    ["Asesor responsable", expediente.asesor_responsable],
    ["Monto desembolsado", expediente.monto_desembolso ? money(expediente.monto_desembolso) : "-"],
  ];
  return (
    <Card>
      <SectionTitle title="Datos del expediente (referencia)" />
      {rows.map(([label, value]) => (
        <View key={label} style={s.infoRow}>
          <Text style={s.infoLabel}>{label}</Text>
          <Text style={s.infoValue}>{String(value ?? "-")}</Text>
        </View>
      ))}
    </Card>
  );
}

export default function MiMuestraScreen({ refreshRevision = 0, onDetailVisibilityChange, currentLocation }: { refreshRevision?: number; onDetailVisibilityChange?: (open: boolean) => void; currentLocation?: { latitude: number; longitude: number } | null }) {
  const { api } = useAuth();
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<any>(null);

  const [resultado, setResultado] = useState("CONFORME");
  const [entregoDinero, setEntregoDinero] = useState<YesNo>(null);
  const [pagoComision, setPagoComision] = useState<YesNo>(null);
  const [recibioMontoTotal, setRecibioMontoTotal] = useState<YesNo>(null);
  const [conyugeConoce, setConyugeConoce] = useState<YesNo>(null);
  const [creditosParalelos, setCreditosParalelos] = useState<YesNo>(null);
  const [comparteDinero, setComparteDinero] = useState<YesNo>(null);
  const [titularAdministra, setTitularAdministra] = useState<YesNo>(null);
  const [tieneMicroseguro, setTieneMicroseguro] = useState<YesNo>(null);
  const [dondePaga, setDondePaga] = useState("");
  const [comentarioNegocio, setComentarioNegocio] = useState("");
  const [comentarioAuditor, setComentarioAuditor] = useState("");

  const [photo, setPhoto] = useState("");
  const [photo2, setPhoto2] = useState("");
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [cameraSlot, setCameraSlot] = useState<1 | 2 | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [signature, setSignature] = useState("");
  const [signatureKey, setSignatureKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error2, setError2] = useState("");
  // La ficha (cuestionario/comentarios) no debe interrumpirse pidiendo la foto: se
  // llena completa primero, y recién después aparece el paso de evidencias.
  const [paso, setPaso] = useState<"ficha" | "evidencia">("ficha");

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
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

  const resetForm = () => {
    setSelected(null);
    setResultado("CONFORME");
    setEntregoDinero(null); setPagoComision(null); setRecibioMontoTotal(null);
    setConyugeConoce(null); setCreditosParalelos(null); setComparteDinero(null);
    setTitularAdministra(null); setTieneMicroseguro(null);
    setDondePaga(""); setComentarioNegocio(""); setComentarioAuditor("");
    setPhoto(""); setPhoto2(""); setSignature(""); setSignatureKey((k) => k + 1);
    setError2("");
    setPaso("ficha");
  };

  const takePhoto = async (slot: 1 | 2) => {
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!permission?.granted) {
      if (permission?.canAskAgain === false) {
        Alert.alert("Permiso de cámara bloqueado", "Activa el permiso de Cámara desde los ajustes del dispositivo.", [
          { text: "Cancelar", style: "cancel" }, { text: "Abrir ajustes", onPress: () => Linking.openSettings() },
        ]);
      } else {
        Alert.alert("Permiso requerido", "Debes permitir el uso de la cámara para registrar las evidencias.");
      }
      return;
    }
    setCameraSlot(slot);
  };

  const capturePhoto = async () => {
    if (!cameraSlot || capturing || !cameraRef.current) return;
    const slot = cameraSlot;
    try {
      setCapturing(true);
      setPhotoProcessing(true);
      const captured = await cameraRef.current.takePictureAsync({ quality: 0.8, skipProcessing: false });
      if (!captured?.uri) throw new Error("La cámara no devolvió una fotografía válida.");
      const compressed = await manipulateAsync(captured.uri, [{ resize: { width: 1024 } }], { compress: 0.65, format: SaveFormat.JPEG });
      const directory = `${FileSystem.documentDirectory}evidence-drafts`;
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(() => {});
      const persistentUri = `${directory}/expediente-${selected.expediente.id_expediente}-foto-${slot}-${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: compressed.uri, to: persistentUri });
      if (slot === 1) setPhoto(persistentUri); else setPhoto2(persistentUri);
      setCameraSlot(null);
    } catch (e: any) {
      Alert.alert("Fotografía no disponible", e.message);
    } finally {
      setCapturing(false);
      setPhotoProcessing(false);
    }
  };

  // Solo lo que se llena en el paso "Ficha" (cuestionario + comentarios). No incluye
  // foto ni firma: esas se piden recién en el paso "Evidencias".
  const validarPasoFicha = (): string | null => {
    if (entregoDinero === null || pagoComision === null || recibioMontoTotal === null) {
      return "Responde las 3 preguntas obligatorias del cuestionario de fraude.";
    }
    if (resultado !== "CONFORME" && comentarioAuditor.trim().length < 10) {
      return "Este resultado requiere un comentario del auditor de al menos 10 caracteres.";
    }
    return null;
  };

  const validarFicha = (): string | null => {
    const problemaFicha = validarPasoFicha();
    if (problemaFicha) return problemaFicha;
    if (!photo) return "Toma la fotografía principal de evidencia.";
    if (!signature) return "Solicita la firma del cliente antes de guardar.";
    return null;
  };

  const continuarAEvidencias = () => {
    setError2("");
    const problema = validarPasoFicha();
    if (problema) { setError2(problema); return; }
    setPaso("evidencia");
  };

  // Antes de enviar, se pide una confirmación explícita: una vez enviada la ficha
  // queda cerrada (no editable), así que es la última oportunidad de revisar.
  const confirmarEnvio = () => {
    setError2("");
    const problema = validarFicha();
    if (problema) { setError2(problema); return; }
    Alert.alert(
      "Revisa antes de enviar",
      `Resultado registrado: ${resultado}.\nCuestionario, foto principal y firma del cliente: completos.\n\nUna vez enviada, la ficha queda cerrada y no se puede editar. ¿Confirmas que toda la información es correcta?`,
      [
        { text: "Revisar de nuevo", style: "cancel" },
        { text: "Confirmar y enviar", onPress: () => save() },
      ],
    );
  };

  const save = async () => {
    try {
      setError2("");
      const problema = validarFicha();
      if (problema) throw new Error(problema);
      setSaving(true);
      const fix = await getAuditVisitFix();
      const integrity = checkDeviceIntegrity();
      const deviceId = await getDeviceId();
      const idExpediente = Number(selected.expediente.id_expediente);
      const queueId = createOfflineVisitId(idExpediente);
      await enqueueVisit({
        id: queueId,
        idExpediente,
        idAsignacion: Number(selected.id_asignacion),
        fechaHoraCheckin: new Date().toISOString(),
        resultado,
        respuestasCuestionario: {
          entrego_dinero_asesor: entregoDinero,
          pago_comision_adicional: pagoComision,
          recibio_monto_total: recibioMontoTotal,
          conyuge_conoce_prestamo: conyugeConoce ?? undefined,
          creditos_paralelos: creditosParalelos ?? undefined,
          comparte_dinero_credito: comparteDinero ?? undefined,
          titular_administra_negocio: titularAdministra ?? undefined,
          tiene_microseguro: tieneMicroseguro ?? undefined,
          donde_realiza_pagos: dondePaga.trim() || undefined,
        },
        comentarioNegocio: comentarioNegocio.trim(),
        comentarioAuditor: comentarioAuditor.trim(),
        otrosClientesDomicilio: [],
        otrosIngresos: [],
        firma: signature,
        photo1Uri: photo,
        photo2Uri: photo2,
        latitude: fix.latitude,
        longitude: fix.longitude,
        precisionMeters: fix.accuracy,
        mockLocation: fix.mocked,
        deviceIntegrityOk: integrity.ok,
      });
      resetForm();
      let synced = false;
      try {
        const network = await NetInfo.fetch();
        const connected = Boolean(network.isConnected && network.isInternetReachable !== false);
        if (connected) { const result = await syncPendingVisits(); synced = result.syncedIds.includes(queueId); }
      } catch {}
      await load(true);
      Alert.alert(
        synced ? "Visita registrada" : "Visita guardada localmente",
        synced ? "La ficha fue enviada correctamente." : "Se sincronizará automáticamente cuando haya conexión.",
      );
    } catch (e: any) {
      setError2(e.message || "No se pudo guardar la visita.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !asignaciones.length) return <Loading />;

  if (selected) {
    const expediente = selected.expediente;
    return (
      <Screen>
        <Header title="Ficha de entrevista" subtitle={expediente.codigo_expediente} right={
          <Pressable onPress={resetForm} style={s.closeBtn}><MaterialCommunityIcons name="close" size={20} color={C.muted} /></Pressable>
        } />

        <View style={s.checklist}>
          {[
            { label: "Cuestionario", done: entregoDinero !== null && pagoComision !== null && recibioMontoTotal !== null },
            { label: "Foto principal", done: Boolean(photo) },
            { label: "Firma", done: Boolean(signature) },
          ].map((step) => (
            <View key={step.label} style={s.checklistItem}>
              <MaterialCommunityIcons name={step.done ? "check-circle" : "circle-outline"} size={16} color={step.done ? C.success : "#C3CCDB"} />
              <Text style={[s.checklistText, step.done && s.checklistTextDone]}>{step.label}</Text>
            </View>
          ))}
        </View>

        <ExpedienteInfo expediente={expediente} />

        {paso === "ficha" ? (
          <>
            <Card>
              <SectionTitle title="Resultado de la visita" />
              <View style={s.resultGrid}>
                {RESULTADOS.map((item) => (
                  <Pressable key={item.value} onPress={() => setResultado(item.value)} style={[s.resultChip, resultado === item.value && s.resultChipOn]}>
                    <MaterialCommunityIcons name={item.icon as any} size={16} color={resultado === item.value ? "#fff" : C.muted} />
                    <Text style={[s.resultChipText, resultado === item.value && s.resultChipTextOn]}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>

            <Card>
              <SectionTitle title="Cuestionario al cliente" />
              <Text style={s.qHint}>Las 3 primeras preguntas son obligatorias (verificación anti-fraude).</Text>
              <YesNoRow label="¿Alguna vez entregó dinero al asesor por alguna razón?" value={entregoDinero} onChange={setEntregoDinero} />
              <YesNoRow label="¿Pagó alguna comisión adicional por el desembolso?" value={pagoComision} onChange={setPagoComision} />
              <YesNoRow label="¿Recibió el total del monto solicitado?" value={recibioMontoTotal} onChange={setRecibioMontoTotal} />
              <YesNoRow label="¿Cónyuge tiene conocimiento del préstamo?" value={conyugeConoce} onChange={setConyugeConoce} />
              <YesNoRow label="¿Tiene créditos paralelos?" value={creditosParalelos} onChange={setCreditosParalelos} />
              <YesNoRow label="¿Comparte el dinero del crédito con otra persona?" value={comparteDinero} onChange={setComparteDinero} />
              <YesNoRow label="¿Titular administra el negocio?" value={titularAdministra} onChange={setTitularAdministra} />
              <YesNoRow label="¿Tiene microseguro?" value={tieneMicroseguro} onChange={setTieneMicroseguro} />
              <View style={s.field}>
                <Text style={s.qLabel}>¿Dónde realiza sus pagos?</Text>
                <TextInput style={s.textInput} value={dondePaga} onChangeText={setDondePaga} placeholder="Agencia, agente, app, etc." />
              </View>
            </Card>

            <Card>
              <SectionTitle title="Comentarios" />
              <View style={s.field}>
                <Text style={s.qLabel}>Comentario general del negocio</Text>
                <TextInput style={[s.textInput, s.textArea]} value={comentarioNegocio} onChangeText={setComentarioNegocio} multiline placeholder="Situación observada del negocio" />
              </View>
              <View style={s.field}>
                <Text style={s.qLabel}>Comentarios finales del auditor</Text>
                <TextInput style={[s.textInput, s.textArea]} value={comentarioAuditor} onChangeText={setComentarioAuditor} multiline placeholder="Observaciones, incidencias encontradas en la visita" />
              </View>
            </Card>

            {error2 ? <Text style={s.error}>{error2}</Text> : null}
            <Button title="Ficha lista — continuar a evidencias" icon="arrow-right-circle-outline" onPress={continuarAEvidencias} />
          </>
        ) : (
          <>
            <Pressable onPress={() => setPaso("ficha")} style={s.backRow}>
              <MaterialCommunityIcons name="chevron-left" size={20} color={C.primary} />
              <Text style={s.backRowText}>Volver a la ficha</Text>
            </Pressable>

            <Card>
              <SectionTitle title="Evidencia fotográfica" />
              <View style={s.photoRow}>
                <Pressable onPress={() => takePhoto(1)} style={s.photoBox}>
                  {photo ? <MaterialCommunityIcons name="check-circle" size={28} color={C.success} /> : <MaterialCommunityIcons name="camera-plus-outline" size={28} color={C.muted} />}
                  <Text style={s.photoLabel}>{photo ? "Foto principal ✓" : "Foto principal"}</Text>
                </Pressable>
                <Pressable onPress={() => takePhoto(2)} style={s.photoBox}>
                  {photo2 ? <MaterialCommunityIcons name="check-circle" size={28} color={C.success} /> : <MaterialCommunityIcons name="camera-plus-outline" size={28} color={C.muted} />}
                  <Text style={s.photoLabel}>{photo2 ? "Foto adicional ✓" : "Foto adicional (opcional)"}</Text>
                </Pressable>
              </View>
              <Text style={s.qHint}>Solo se aceptan fotos tomadas en el momento desde la cámara de la app.</Text>
            </Card>

            <Card>
              <SectionTitle title="Firma del cliente" />
              <SignaturePad key={signatureKey} onChange={setSignature} />
            </Card>

            {error2 ? <Text style={s.error}>{error2}</Text> : null}
            <Button title={saving ? "Guardando…" : "Revisar y enviar visita"} icon="content-save-check-outline" onPress={confirmarEnvio} disabled={saving} />
          </>
        )}

        <Modal visible={cameraSlot !== null} animationType="slide">
          <View style={StyleSheet.absoluteFill}>
            {cameraSlot ? <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" /> : null}
            <View style={s.cameraControls}>
              <Pressable onPress={() => setCameraSlot(null)} style={s.cameraCancel}>
                <MaterialCommunityIcons name="close" size={26} color="#fff" />
              </Pressable>
              <Pressable onPress={capturePhoto} disabled={capturing || photoProcessing} style={s.cameraShutter}>
                <View style={s.cameraShutterInner} />
              </Pressable>
              <View style={{ width: 50 }} />
            </View>
          </View>
        </Modal>
      </Screen>
    );
  }

  const priorityColor = (p: string) => (p === "ALTA" ? C.danger : p === "BAJA" ? C.muted : C.warning);
  const initialsOf = (name: string) => (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const comoLlegar = (lat: number, lng: number) => {
    const origin = currentLocation ? `&origin=${currentLocation.latitude},${currentLocation.longitude}` : "";
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${origin}`);
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}>
      <Header title="Mi muestra" subtitle={`${asignaciones.length} expediente(s) asignado(s)`} />
      {error && !asignaciones.length ? <Empty title="No pudimos cargar tu muestra" text={error} /> : null}
      {!error && !asignaciones.length ? <Empty title="Sin expedientes asignados" text="Tu supervisor aún no te ha asignado una muestra para auditar." /> : null}
      {asignaciones.map((item) => {
        const isOtros = item.expediente.tipo_credito === "OTROS";
        const accent = priorityColor(item.prioridad);
        return (
          <Pressable key={item.id_asignacion} onPress={() => setSelected(item)} style={({ pressed }) => pressed && s.listCardPressed}>
            <Card style={StyleSheet.flatten([s.listCard, { borderLeftColor: accent, borderLeftWidth: 4 }])}>
              <View style={s.listRow}>
                <View style={[s.avatar, { backgroundColor: isOtros ? "#FFF3E0" : "#EAF1FF" }]}>
                  <Text style={[s.avatarText, { color: isOtros ? C.warning : C.primary }]}>{initialsOf(item.expediente.nombres_cliente)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.listHeader}>
                    <Text style={s.listTitle} numberOfLines={1}>{item.expediente.nombres_cliente}</Text>
                    <Badge status={item.prioridad === "ALTA" ? "NO_ENCONTRADO" : item.prioridad === "BAJA" ? "INACTIVO" : "PENDIENTE"} label={item.prioridad} />
                  </View>
                  <View style={s.chipRow}>
                    <View style={[s.typeChip, { backgroundColor: isOtros ? "#FFF3E0" : "#EAF1FF" }]}>
                      <MaterialCommunityIcons name={isOtros ? "store-outline" : "account-cash-outline"} size={12} color={isOtros ? C.warning : C.primary} />
                      <Text style={[s.typeChipText, { color: isOtros ? C.warning : C.primary }]}>{item.expediente.tipo_credito}</Text>
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
    </Screen>
  );
}

const s = StyleSheet.create({
  closeBtn: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F5F9" },
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
  qButtons: { flexDirection: "row", gap: 6 },
  qBtn: { width: 44, height: 34, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
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
