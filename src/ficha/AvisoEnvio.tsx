import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { FI, N } from "../theme";
import type { ResultadoEnvio } from "./FichaWizard";

// Aviso que aparece cuando la ficha termina de enviarse (Figma «Tus respuestas han sido enviadas»). Mismo aviso, tres tonos:
// enviada (verde), guardada en el celular por falta de señal (ámbar) y rechazada por el servidor (rojo).
const TONOS = {
  ok: { fondo: N.verde, icono: "check" },
  guardada: { fondo: "#F5A524", icono: "cloud-upload-outline" },
  rechazada: { fondo: N.rojoBoton, icono: "close" },
} as const;

export default function AvisoEnvio({ aviso, onClose }: { aviso: ResultadoEnvio | null; onClose: () => void }) {
  if (!aviso) return null;
  const tono = TONOS[aviso.tono];
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose} statusBarTranslucent>
      <View style={s.velo}>
        <View style={s.tarjeta} accessibilityRole="alert" accessibilityViewIsModal>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar aviso" style={s.cerrar}>
            <MaterialCommunityIcons name="close" size={24} color={N.apagado} />
          </Pressable>
          <View style={[s.circulo, { backgroundColor: tono.fondo }]}>
            <MaterialCommunityIcons name={tono.icono as any} size={56} color="#fff" />
          </View>
          <Text style={s.titulo}>{aviso.titulo}</Text>
          <Text style={s.texto}>{aviso.texto}</Text>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  velo: { flex: 1, backgroundColor: "rgba(0,0,0,0.39)", alignItems: "center", justifyContent: "center", padding: 24 },
  tarjeta: { width: "100%", maxWidth: 380, backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 24, paddingTop: 36, paddingBottom: 30, alignItems: "center", gap: 10, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  cerrar: { position: "absolute", right: 14, top: 14 },
  circulo: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  titulo: { fontFamily: FI.semi, fontSize: 17, lineHeight: 24, color: "#000", textAlign: "center" },
  texto: { fontFamily: FI.reg, fontSize: 14.5, lineHeight: 21, color: "#000", textAlign: "center" },
});
