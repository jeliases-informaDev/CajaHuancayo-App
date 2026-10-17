import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, BackHandler, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import * as ScreenCapture from "expo-screen-capture";
import NetInfo from "@react-native-community/netinfo";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, G } from "../theme";
import { getAuditVisitFix } from "../useAuditorLocation";
import { checkDeviceIntegrity } from "../deviceIntegrity";
import { cacheGet, cacheSet, createOfflineVisitId, enqueueVisit, syncPendingVisits } from "../offlineSync";
import { PASOS, TEMA, plantillaDe } from "./config";
import { Callout } from "./controls";
import { PasoCierre, PasoCuestionario, PasoEvaluacion, PasoEvidencias, PasoNegocio, PasoOtros, PasoVerificacion } from "./Pasos";
import Referencia, { TabRef } from "./Referencia";
import { estadoInicial, FichaState, GeoConfig, StepId } from "./types";
import { puntoElegido, puntosDe, tieneCoordenadas } from "./destino";
import { distanciaTexto, pasoCompleto, validarEnvio } from "./validacion";

const DRAFT_KEY = (idExpediente: number) => `draft_v2_${idExpediente}`;

function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type Props = {
  asignacion: any;
  geo: GeoConfig;
  currentLocation?: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onSent: () => void;
};

export default function FichaWizard({ asignacion, geo, currentLocation, onClose, onSent }: Props) {
  const expediente = asignacion.expediente;
  const idExpediente = Number(expediente.id_expediente);
  const plantilla = plantillaDe(expediente);
  const tema = TEMA[plantilla];
  const pasos = PASOS[plantilla];

  const [s, setS] = useState<FichaState>(() => estadoInicial(String(expediente.numero_documento_cliente || "").trim()));
  const [idx, setIdx] = useState(0);
  const [visitados, setVisitados] = useState<Set<StepId>>(new Set(["verificacion"]));
  const [restaurado, setRestaurado] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [verBase, setVerBase] = useState<TabRef | null>(null);
  const [cameraSlot, setCameraSlot] = useState<1 | 2 | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [signatureKey, setSignatureKey] = useState(0);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const scrollRef = useRef<ScrollView>(null);
  const mounted = useRef(true);
  const listo = useRef(false); // el borrador solo se guarda después de intentar restaurarlo

  const set = useCallback((patch: Partial<FichaState>) => setS((prev) => ({ ...prev, ...patch })), []);

  // Dirección que se visita: el domicilio de la persona o, en MYPE, un negocio (la distancia y la regla de 100 m van contra ella).
  const puntos = useMemo(() => puntosDe(expediente), [expediente]);
  const punto = useMemo(() => puntoElegido(expediente, s.destino, s.indiceNegocio), [expediente, s.destino, s.indiceNegocio]);
  const tieneCoord = tieneCoordenadas(punto);
  const lugar = punto.tipo === "NEGOCIO" ? "negocio" : "domicilio";
  const distanciaM = useMemo(
    () => (tieneCoord && currentLocation ? distanciaMetros(punto.lat as number, punto.lng as number, currentLocation.latitude, currentLocation.longitude) : null),
    [tieneCoord, currentLocation, punto],
  );

  // La ficha muestra datos del cliente, sus fotos y su firma: sin capturas ni grabación de pantalla.
  useEffect(() => {
    mounted.current = true;
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    return () => { mounted.current = false; ScreenCapture.allowScreenCaptureAsync().catch(() => {}); };
  }, []);

  // Borrador: si la app se cierra o entra una llamada, el avance no se pierde.
  useEffect(() => {
    cacheGet<{ s: FichaState; idx: number; visitados: StepId[] }>(DRAFT_KEY(idExpediente)).then((draft) => {
      if (draft?.value && mounted.current) {
        setS({ ...estadoInicial(String(expediente.numero_documento_cliente || "").trim()), ...draft.value.s });
        setIdx(Math.min(draft.value.idx || 0, pasos.length - 1));
        setVisitados(new Set(draft.value.visitados || ["verificacion"]));
        setRestaurado(true);
      }
      listo.current = true;
    });
  }, [idExpediente]);
  useEffect(() => {
    if (!listo.current) return;
    const t = setTimeout(() => cacheSet(DRAFT_KEY(idExpediente), { s, idx, visitados: [...visitados] }), 500);
    return () => clearTimeout(t);
  }, [s, idx, visitados, idExpediente]);

  const irA = useCallback((n: number) => {
    const destino = Math.max(0, Math.min(pasos.length - 1, n));
    setIdx(destino);
    setVisitados((prev) => new Set(prev).add(pasos[destino].id));
    setRestaurado(false); // el aviso de «avance recuperado» solo acompaña al paso donde se retomó
    setError("");
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [pasos]);
  const irAPaso = useCallback((id: StepId) => irA(pasos.findIndex((p) => p.id === id)), [irA, pasos]);

  const salir = useCallback(() => {
    Alert.alert("¿Salir de la ficha?", "Tu avance queda guardado como borrador en este celular; podrás continuarlo cuando quieras.", [
      { text: "Seguir aquí", style: "cancel" },
      { text: "Salir", onPress: onClose },
    ]);
    return true;
  }, [onClose]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (cameraSlot !== null) { setCameraSlot(null); return true; }
      if (verBase !== null) { setVerBase(null); return true; }
      if (idx > 0) { irA(idx - 1); return true; }
      return salir();
    });
    return () => sub.remove();
  }, [idx, cameraSlot, verBase, irA, salir]);

  // ----- cámara
  const tomarFoto = async (slot: 1 | 2) => {
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
  const capturar = async () => {
    if (!cameraSlot || capturing || !cameraRef.current) return;
    const slot = cameraSlot;
    try {
      setCapturing(true);
      const captured = await cameraRef.current.takePictureAsync({ quality: 0.8, skipProcessing: false });
      if (!captured?.uri) throw new Error("La cámara no devolvió una fotografía válida.");
      const compressed = await manipulateAsync(captured.uri, [{ resize: { width: 1024 } }], { compress: 0.65, format: SaveFormat.JPEG });
      let persistentUri = compressed.uri; // en el navegador (solo pruebas) la foto se queda como data URI
      if (Platform.OS !== "web") {
        const directory = `${FileSystem.documentDirectory}evidence-drafts`;
        await FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(() => {});
        persistentUri = `${directory}/expediente-${idExpediente}-foto-${slot}-${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: compressed.uri, to: persistentUri });
      }
      set(slot === 1 ? { photo: persistentUri } : { photo2: persistentUri });
      setCameraSlot(null);
    } catch (e: any) {
      Alert.alert("Fotografía no disponible", e.message);
    } finally {
      setCapturing(false);
    }
  };

  // ----- envío
  const confirmarEnvio = () => {
    setError("");
    const problema = validarEnvio(s, plantilla, distanciaM, geo.radio);
    if (problema) { setError(problema.mensaje); irAPaso(problema.paso); return; }
    Alert.alert(
      "Revisa antes de enviar",
      `Resultado: ${s.resultado}.\n\nUna vez enviada, la ficha queda cerrada y no se puede editar. ¿Confirmas que toda la información es correcta?`,
      [{ text: "Revisar de nuevo", style: "cancel" }, { text: "Confirmar y enviar", onPress: () => guardar() }],
    );
  };

  const guardar = async () => {
    try {
      setError("");
      setSaving(true);
      const fix = await getAuditVisitFix();
      const integrity = checkDeviceIntegrity();

      // Verificación en el propio celular ANTES de guardar: la misma regla del servidor, pero
      // el auditor la ve al instante (incluso sin señal) en vez de un rechazo horas después.
      if (fix.mocked) throw new Error("Se detectó una ubicación simulada (Fake GPS). Desactívala para poder registrar la visita.");
      if (!integrity.ok) throw new Error("Este dispositivo no pasa la verificación de integridad (emulador, root o jailbreak). No se puede registrar la visita.");
      const distancia = tieneCoord ? distanciaMetros(punto.lat as number, punto.lng as number, fix.latitude, fix.longitude) : null;
      const motivos: string[] = [];
      if (distancia != null && distancia > geo.radio) motivos.push(`estás a ${distanciaTexto(distancia)} del ${lugar} (máximo ${geo.radio} m)`);
      if (fix.accuracy != null && fix.accuracy > geo.precision) motivos.push(`el GPS tiene una precisión de ${Math.round(fix.accuracy)} m (máximo ${geo.precision} m)`);
      const ubicacionObservada = motivos.join("; ");
      if (motivos.length && s.resultado === "CONFORME") {
        throw new Error(`No puedes registrar CONFORME: ${ubicacionObservada}. Acércate al ${lugar} y espera a que el GPS se estabilice, o elige otro resultado (Observado / No ubicado) y explica el motivo en el comentario.`);
      }
      const problema = validarEnvio(s, plantilla, distancia, geo.radio);
      if (problema) { irAPaso(problema.paso); throw new Error(problema.mensaje); }

      const llegoAlCliente = s.resultado === "CONFORME" || s.resultado === "OBSERVADO";
      const respuestas: Record<string, unknown> = {};
      const poner = (clave: string, valor: boolean | null) => { if (valor !== null) respuestas[clave] = valor; };
      poner("entrego_dinero_asesor", s.entregoDinero);
      poner("pago_comision_adicional", s.pagoComision);
      poner("recibio_monto_total", s.recibioMontoTotal);
      poner("conyuge_conoce_prestamo", s.conyugeConoce);
      poner("creditos_paralelos", s.creditosParalelos);
      poner("comparte_dinero_credito", s.comparteDinero);
      if (plantilla === "MYPE_V1") poner("titular_administra_negocio", s.titularAdministra);
      poner("tiene_microseguro", s.tieneMicroseguro);
      poner("recibio_info_microseguro", s.infoMicroseguro);
      poner("conforme_microseguro", s.conformeMicroseguro);
      if (s.comentarioMicroseguro.trim()) respuestas.comentario_microseguro = s.comentarioMicroseguro.trim();
      if (s.dondePaga.trim()) respuestas.donde_realiza_pagos = s.dondePaga.trim();

      const queueId = createOfflineVisitId(idExpediente);
      await enqueueVisit({
        id: queueId,
        idExpediente,
        idAsignacion: Number(asignacion.id_asignacion),
        fechaHoraCheckin: new Date().toISOString(),
        resultado: s.resultado,
        plantilla,
        ubicacionVisitada: punto.tipo,
        indiceNegocio: punto.indice,
        respuestasCuestionario: respuestas,
        comentarioNegocio: s.comentarioNegocio.trim(),
        comentarioAuditor: s.comentarioAuditor.trim(),
        estadoNegocio: plantilla === "MYPE_V1" ? s.estadoNegocio : "",
        propiedadLocal: plantilla === "MYPE_V1" ? s.propiedadLocal : "",
        conformidadFinanciera: plantilla === "MYPE_V1" && llegoAlCliente
          ? Object.fromEntries((["ingresos", "balance", "resultados"] as const).map((k) => [k, { conforme: s.conf[k].conforme === true, ...(s.conf[k].comentario.trim() ? { comentario: s.conf[k].comentario.trim() } : {}) }]))
          : null,
        otrosClientesDomicilio: s.otrosClientes
          .filter((x) => x.nombre.trim())
          .map((x) => ({ nombre: x.nombre.trim(), parentesco: x.parentesco.trim() || undefined, actividad: x.actividad.trim() || undefined, antiguedad_negocio: x.antiguedad.trim() || undefined })),
        otrosPasivos: s.otrosPasivos.trim(),
        otrosIngresos: s.otrosIngresos
          .filter((x) => x.origen.trim() || x.monto)
          .map((x) => ({ origen: x.origen.trim() || undefined, monto_mensual: x.monto ? Number(x.monto) : undefined })),
        firmanteDocumento: llegoAlCliente ? s.firmanteDocumento.trim() : "",
        firma: llegoAlCliente ? s.signature : "",
        photo1Uri: s.photo,
        photo2Uri: s.photo2,
        latitude: fix.latitude,
        longitude: fix.longitude,
        precisionMeters: fix.accuracy,
        mockLocation: fix.mocked,
        deviceIntegrityOk: integrity.ok,
      });
      await cacheSet(DRAFT_KEY(idExpediente), null);
      mounted.current = false;
      onClose();

      let synced = false;
      let rejectedReason: string | null = null;
      try {
        const network = await NetInfo.fetch();
        const connected = Boolean(network.isConnected && network.isInternetReachable !== false);
        if (connected) {
          const result = await syncPendingVisits();
          synced = result.syncedIds.includes(queueId);
          rejectedReason = result.rejected.find((r) => r.id === queueId)?.reason ?? null;
        }
      } catch {}
      onSent();
      const alerta = ubicacionObservada ? `\n\nQuedó con alerta de ubicación: ${ubicacionObservada}.` : "";
      if (rejectedReason) {
        Alert.alert("Visita rechazada por el servidor", `${rejectedReason}\n\nNo se registró. El expediente sigue en tu muestra: corrige lo indicado y vuelve a registrarlo. (El detalle queda en Perfil.)`);
      } else {
        Alert.alert(
          synced ? "Visita registrada" : "Visita guardada localmente",
          (synced ? "La ficha fue enviada correctamente." : "Aún no llegó al servidor: se enviará automáticamente cuando haya conexión. Hasta entonces el expediente NO cambia de estado.") + alerta,
        );
      }
    } catch (e: any) {
      if (mounted.current) setError(e.message || "No se pudo guardar la visita.");
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const ultimo = idx === pasos.length - 1;
  const actual = pasos[idx];

  return (
    <SafeAreaView edges={["bottom"]} style={st.safe}>
      <StatusBar style="dark" />
      <LinearGradient colors={[...G.hero]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.top, { paddingTop: Math.max(insets.top, 10) }]}>
        <View style={st.head}>
          <Pressable onPress={salir} style={st.iconBtn} accessibilityLabel="Cerrar ficha"><MaterialCommunityIcons name="close" size={20} color={C.ink} /></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={st.tipoText}>{tema.nombre.toUpperCase()}</Text>
            <Text style={st.title} numberOfLines={1}>{expediente.nombres_cliente}</Text>
            <Text style={st.sub} numberOfLines={1}>{expediente.codigo_expediente}</Text>
          </View>
          <Pressable onPress={() => setVerBase("cliente")} style={st.baseBtn} accessibilityLabel="Ver datos de la base">
            <MaterialCommunityIcons name="database-eye-outline" size={17} color={C.ink} />
            <Text style={st.baseBtnText}>Datos base</Text>
          </Pressable>
        </View>

        <View style={st.progressWrap}>
          <View style={st.progressTrack}>
            <LinearGradient colors={[...G.brand]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[st.progressFill, { width: `${((idx + 1) / pasos.length) * 100}%` }]} />
          </View>
          <Text style={st.progressText}>Paso {idx + 1} de {pasos.length}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.stepperScroll} contentContainerStyle={st.stepper}>
          {pasos.map((p, i) => {
            const actualPaso = i === idx;
            const visto = visitados.has(p.id);
            const completo = visto && pasoCompleto(p.id, s, plantilla);
            const pendiente = visto && !completo && !actualPaso && p.id !== "verificacion" && p.id !== "otros";
            return (
              <Pressable key={p.id} onPress={() => irA(i)} style={[st.stepChip, actualPaso && st.stepChipOn]}>
                {completo && !actualPaso ? <MaterialCommunityIcons name="check" size={13} color={C.success} /> : pendiente ? <MaterialCommunityIcons name="alert-circle-outline" size={13} color={C.warning} /> : <Text style={[st.stepNum, actualPaso && st.stepTextOn]}>{i + 1}</Text>}
                <Text style={[st.stepText, actualPaso && st.stepTextOn]}>{p.corto}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={st.body}>
          <Text style={st.stepTitle}>{actual.titulo}</Text>
          {restaurado ? <Callout tipo="info">Recuperamos el avance que dejaste en esta ficha.</Callout> : null}

          {actual.id === "verificacion" ? (
            <PasoVerificacion expediente={expediente} plantilla={plantilla} punto={punto} puntos={puntos} onElegir={(p) => set({ destino: p.tipo, indiceNegocio: p.indice })} distanciaM={distanciaM} geo={geo} onVerBase={() => setVerBase("cliente")} onNoUbicado={() => { set({ resultado: "NO_UBICADO" }); irAPaso("cierre"); }} />
          ) : null}
          {actual.id === "negocio" ? <PasoNegocio s={s} set={set} expediente={expediente} onVerBase={() => setVerBase("negocio")} /> : null}
          {actual.id === "evaluacion" ? <PasoEvaluacion s={s} set={set} expediente={expediente} onVerBase={() => setVerBase("evaluacion")} /> : null}
          {actual.id === "cuestionario" ? <PasoCuestionario s={s} set={set} plantilla={plantilla} /> : null}
          {actual.id === "otros" ? <PasoOtros s={s} set={set} plantilla={plantilla} /> : null}
          {actual.id === "cierre" ? <PasoCierre s={s} set={set} plantilla={plantilla} distanciaM={distanciaM} geo={geo} irA={irAPaso} /> : null}
          {actual.id === "evidencias" ? <PasoEvidencias s={s} set={set} onFoto={tomarFoto} signatureKey={signatureKey} /> : null}

          {error ? <Callout tipo="error">{error}</Callout> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={st.footer}>
        {idx > 0 ? (
          <Pressable onPress={() => irA(idx - 1)} style={st.backBtn}><MaterialCommunityIcons name="chevron-left" size={20} color={C.primary} /><Text style={st.backText}>Atrás</Text></Pressable>
        ) : <View style={{ width: 8 }} />}
        <Pressable
          onPress={ultimo ? confirmarEnvio : () => irA(idx + 1)}
          disabled={saving}
          style={[st.nextBtn, { backgroundColor: ultimo ? C.success : C.primary }, saving && { opacity: 0.6 }]}
        >
          <Text style={st.nextText}>{saving ? "Guardando…" : ultimo ? "Revisar y enviar" : `Continuar · ${pasos[idx + 1].corto}`}</Text>
          <MaterialCommunityIcons name={ultimo ? "send-check-outline" : "chevron-right"} size={20} color="#fff" />
        </Pressable>
      </View>

      <Referencia visible={verBase !== null} onClose={() => setVerBase(null)} expediente={expediente} plantilla={plantilla} inicial={verBase || "cliente"} />

      <Modal visible={cameraSlot !== null} animationType="slide" onRequestClose={() => setCameraSlot(null)}>
        <View style={StyleSheet.absoluteFill}>
          {cameraSlot ? <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" /> : null}
          <View style={st.cameraControls}>
            <Pressable onPress={() => setCameraSlot(null)} style={st.cameraCancel}><MaterialCommunityIcons name="close" size={26} color="#fff" /></Pressable>
            <Pressable onPress={capturar} disabled={capturing} style={st.cameraShutter}><View style={st.cameraShutterInner} /></Pressable>
            <View style={{ width: 50 }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  top: { paddingBottom: 14, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, borderBottomWidth: 1, borderColor: C.border },
  head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingBottom: 10 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.soft },
  tipoText: { fontSize: 10, fontWeight: "700", letterSpacing: 1, color: C.magenta },
  title: { fontFamily: F.display, fontSize: 25, lineHeight: 28, fontWeight: "normal", color: C.ink, marginTop: 1, letterSpacing: -0.4 },
  sub: { fontSize: 11.5, color: C.muted, fontWeight: "500" },
  baseBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, height: 36, borderRadius: 12, backgroundColor: C.soft },
  baseBtnText: { fontSize: 11.5, fontWeight: "600", color: C.ink },
  progressWrap: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingBottom: 10 },
  progressTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: C.soft, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },
  progressText: { fontSize: 11, fontWeight: "600", color: C.muted },
  stepperScroll: { flexGrow: 0 },
  stepper: { paddingHorizontal: 14, gap: 6 },
  stepChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: C.soft },
  stepChipOn: { backgroundColor: C.primary },
  stepNum: { fontSize: 11.5, fontWeight: "700", color: C.muted },
  stepText: { fontSize: 12, fontWeight: "600", color: C.text2 },
  stepTextOn: { color: "#fff" },
  body: { padding: 14, gap: 12, paddingBottom: 24 },
  stepTitle: { fontFamily: F.display, fontSize: 32, lineHeight: 36, fontWeight: "normal", color: C.ink, letterSpacing: -0.3 },
  footer: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: "#fff" },
  backBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 12 },
  backText: { fontSize: 14, fontWeight: "600", color: C.text2 },
  nextBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 52, borderRadius: 14 },
  nextText: { fontSize: 14.5, fontWeight: "600", color: "#fff" },
  cameraControls: { position: "absolute", bottom: 40, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30 },
  cameraCancel: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#00000080", alignItems: "center", justifyContent: "center" },
  cameraShutter: { width: 74, height: 74, borderRadius: 37, backgroundColor: "#ffffff40", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff" },
  cameraShutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },
});
