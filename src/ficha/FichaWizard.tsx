import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, BackHandler, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import * as ScreenCapture from "expo-screen-capture";
import NetInfo from "@react-native-community/netinfo";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { FI, N } from "../theme";
import { getAuditVisitFix } from "../useAuditorLocation";
import { checkDeviceIntegrity } from "../deviceIntegrity";
import { cacheGet, cacheSet, createOfflineVisitId, enqueueVisit, syncPendingVisits } from "../offlineSync";
import { PASOS, plantillaDe } from "./config";
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

// Lo que se le cuenta al auditor cuando termina de enviar (lo muestra Mi muestra en un aviso, porque la ficha ya se cerró).
export type ResultadoEnvio = { tono: "ok" | "guardada" | "rechazada"; titulo: string; texto: string };

type Props = {
  asignacion: any;
  geo: GeoConfig;
  currentLocation?: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onSent: (resultado?: ResultadoEnvio) => void;
};

export default function FichaWizard({ asignacion, geo, currentLocation, onClose, onSent }: Props) {
  const expediente = asignacion.expediente;
  const idExpediente = Number(expediente.id_expediente);
  const plantilla = plantillaDe(expediente);
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
  // Mientras se dibuja la firma, la pantalla no se desplaza: si el ScrollView se queda con el gesto, el lienzo solo recibe el inicio y la firma sale como una raya.
  const [firmando, setFirmando] = useState(false);
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
  const confirmarEnvio = (ficha: FichaState = s) => {
    setError("");
    const problema = validarEnvio(ficha, plantilla, distanciaM, geo.radio);
    if (problema) { setError(problema.mensaje); irAPaso(problema.paso); return; }
    Alert.alert(
      "Revisa antes de enviar",
      `Resultado: ${ficha.resultado}.\n\nUna vez enviada, la ficha queda cerrada y no se puede editar. ¿Confirmas que toda la información es correcta?`,
      [{ text: "Revisar de nuevo", style: "cancel" }, { text: "Confirmar y enviar", onPress: () => guardar(ficha) }],
    );
  };
  const registrarNoUbicado = () => confirmarEnvio({ ...s, resultado: "NO_UBICADO" });

  const guardar = async (ficha: FichaState = s) => {
    const s = ficha; // todo lo que sigue lee del estado con el que se confirmó el envío
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
      poner("titular_administra_negocio", s.titularAdministra);
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
        // En Consumo es opcional (cómo se encontró el negocio o centro de trabajo); en MYPE lo exige el servidor.
        estadoNegocio: s.estadoNegocio,
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
      const alerta = ubicacionObservada ? ` Quedó con alerta de ubicación: ${ubicacionObservada}.` : "";
      if (rejectedReason) {
        onSent({ tono: "rechazada", titulo: "Visita rechazada por el servidor", texto: `${rejectedReason} No se registró: el expediente sigue en tu muestra, corrige lo indicado y vuelve a registrarlo. El detalle queda en Perfil.` });
      } else if (synced) {
        onSent({ tono: "ok", titulo: "Tus respuestas han sido enviadas", texto: `Puedes continuar con el resto de tus muestras.${alerta}` });
      } else {
        onSent({ tono: "guardada", titulo: "Visita guardada en tu celular", texto: `Aún no llegó al servidor: se enviará sola cuando haya conexión. Hasta entonces el expediente NO cambia de estado.${alerta}` });
      }
    } catch (e: any) {
      if (mounted.current) setError(e.message || "No se pudo guardar la visita.");
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const ultimo = idx === pasos.length - 1;
  const actual = pasos[idx];
  const siguienteCorto = !ultimo ? pasos[idx + 1].corto : "";
  const textoSiguiente = `Continuar ${/^(Cuestionario|Negocio)$/.test(siguienteCorto) ? "al" : "a"} ${siguienteCorto}`;

  return (
    <SafeAreaView edges={["bottom"]} style={st.safe}>
      <StatusBar style="dark" />
      <View style={[st.top, { paddingTop: Math.max(insets.top, 10) + 14 }]}>
        <View style={st.head}>
          <MaterialCommunityIcons name="account-circle" size={26} color="#000" />
          <Text style={st.title} accessibilityRole="header" numberOfLines={1}>Detalles del caso</Text>
          <View style={st.tipo}><Text style={st.tipoText}>{plantilla === "MYPE_V1" ? "MYPE" : "Consumo"}</Text></View>
          <Pressable onPress={salir} style={st.cerrar} accessibilityLabel="Cerrar ficha" hitSlop={8}><MaterialCommunityIcons name="close" size={22} color={N.tinta} /></Pressable>
        </View>
        <Text style={st.sub}>Información para preparar tu visita</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.pasosFila}>
          {pasos.map((p, i) => (
            <React.Fragment key={p.id}>
              <Pressable onPress={() => irA(i)} accessibilityRole="button" accessibilityState={{ selected: i === idx }} hitSlop={6}>
                <Text style={[st.paso, i === idx && st.pasoOn]}>{i + 1} {p.corto}</Text>
              </Pressable>
              {i < pasos.length - 1 ? <MaterialCommunityIcons name="arrow-right" size={13} color={N.apagado} /> : null}
            </React.Fragment>
          ))}
        </ScrollView>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={scrollRef} scrollEnabled={!firmando} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={st.body}>
          <View style={st.hoja}>
            <Text style={st.stepTitle} accessibilityRole="header">{actual.titulo}</Text>
            {restaurado ? <Callout tipo="info">Recuperamos el avance que dejaste en esta ficha.</Callout> : null}

            {actual.id === "verificacion" ? (
              <PasoVerificacion expediente={expediente} plantilla={plantilla} punto={punto} puntos={puntos} onElegir={(p) => set({ destino: p.tipo, indiceNegocio: p.indice })} distanciaM={distanciaM} geo={geo} onVerBase={() => setVerBase("cliente")} onNoUbicado={registrarNoUbicado} onFoto={tomarFoto} ficha={s} set={set} />
            ) : null}
            {actual.id === "negocio" ? <PasoNegocio s={s} set={set} expediente={expediente} onVerBase={() => setVerBase("negocio")} /> : null}
            {actual.id === "evaluacion" ? <PasoEvaluacion s={s} set={set} expediente={expediente} onVerBase={() => setVerBase("evaluacion")} /> : null}
            {actual.id === "cuestionario" ? <PasoCuestionario s={s} set={set} plantilla={plantilla} /> : null}
            {actual.id === "otros" ? <PasoOtros s={s} set={set} plantilla={plantilla} /> : null}
            {actual.id === "cierre" ? <PasoCierre s={s} set={set} plantilla={plantilla} distanciaM={distanciaM} geo={geo} irA={irAPaso} /> : null}
            {actual.id === "evidencias" ? <PasoEvidencias s={s} set={set} onFoto={tomarFoto} signatureKey={signatureKey} onFirmando={setFirmando} onLimpiarFirma={() => { setSignatureKey((k) => k + 1); set({ signature: "" }); setFirmando(false); }} /> : null}

            {error ? <Callout tipo="error">{error}</Callout> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={st.footer}>
        {idx > 0 ? (
          <Pressable onPress={() => irA(idx - 1)} style={st.backBtn} accessibilityRole="button"><MaterialCommunityIcons name="chevron-left" size={20} color={N.tinta} /><Text style={st.backText}>Atrás</Text></Pressable>
        ) : null}
        <Pressable
          onPress={ultimo ? () => confirmarEnvio() : () => irA(idx + 1)}
          disabled={saving}
          accessibilityRole="button"
          style={[st.nextBtn, { backgroundColor: ultimo ? N.verde : N.marca }, saving && { opacity: 0.6 }]}
        >
          {!ultimo ? <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" /> : null}
          <Text style={st.nextText}>{saving ? "Guardando…" : ultimo ? "Revisar y enviar" : textoSiguiente}</Text>
          {ultimo ? <MaterialCommunityIcons name="send-outline" size={20} color="#fff" /> : null}
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
  safe: { flex: 1, backgroundColor: N.fondo },
  top: { paddingHorizontal: 20, paddingBottom: 12, gap: 6 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontFamily: FI.bold, fontSize: 24, lineHeight: 30, color: "#000" },
  tipo: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: N.suave },
  tipoText: { fontFamily: FI.semi, fontSize: 12, color: N.marca },
  cerrar: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: N.borde },
  sub: { fontFamily: FI.reg, fontSize: 14, color: N.apagado },
  pasosFila: { alignItems: "center", gap: 6, paddingTop: 4, paddingRight: 8 },
  paso: { fontFamily: FI.reg, fontSize: 12.5, color: N.marca },
  pasoOn: { fontFamily: FI.med, textDecorationLine: "underline" },
  body: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
  hoja: { backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: N.borde, padding: 16, gap: 14 },
  stepTitle: { fontFamily: FI.semi, fontSize: 20, lineHeight: 26, color: N.tinta },
  footer: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: N.borde, backgroundColor: N.fondo },
  backBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingRight: 6 },
  backText: { fontFamily: FI.semi, fontSize: 16, color: N.tinta },
  nextBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, minHeight: 52, borderRadius: 12 },
  nextText: { fontFamily: FI.semi, fontSize: 16, color: "#fff" },
  cameraControls: { position: "absolute", bottom: 40, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30 },
  cameraCancel: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#00000080", alignItems: "center", justifyContent: "center" },
  cameraShutter: { width: 74, height: 74, borderRadius: 37, backgroundColor: "#ffffff40", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff" },
  cameraShutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },
});
