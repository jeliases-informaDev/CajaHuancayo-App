import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext";
import { FI, N } from "../theme";
import { Button } from "../ui";

// Términos y condiciones de la empresa: el servidor manda el texto vigente y su versión. Se leen hasta el final, se marca la
// casilla y se registra la aceptación (quién, cuándo, desde la app). Rechazar cierra la sesión. Se muestra antes de la app.
type Terminos = { version: string; titulo: string; subtitulo: string; secciones: { titulo: string; texto: string }[]; aceptado: boolean };

export default function TerminosScreen({ onAceptado }: { onAceptado: (version: string) => void }) {
  const { api, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [terminos, setTerminos] = useState<Terminos | null>(null);
  const [error, setError] = useState("");
  const [leido, setLeido] = useState(false);
  const [acepto, setAcepto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const alto = useRef({ vista: 0, contenido: 0 });

  const cargar = useCallback(() => {
    setError("");
    api<any>("/api/terminos")
      .then((r) => { setTerminos(r.data); if (r.data?.aceptado) onAceptado(r.data.version); })
      .catch((e: any) => setError(e.message || "No se pudieron cargar los términos."));
  }, [api, onAceptado]);
  useEffect(() => { cargar(); }, [cargar]);

  // Si el texto cabe sin desplazarse ya está leído; si no, la casilla se habilita al llegar al final.
  const revisar = () => {
    const { vista, contenido } = alto.current;
    if (vista > 0 && contenido > 0 && contenido <= vista + 8) setLeido(true);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 24) setLeido(true);
  };

  const aceptar = async () => {
    if (!terminos) return;
    setEnviando(true); setError("");
    try {
      await api("/api/terminos/aceptar", { method: "POST", body: JSON.stringify({ version: terminos.version }) });
      onAceptado(terminos.version);
    } catch (e: any) { setError(e.message || "No se pudo registrar la aceptación."); setEnviando(false); }
  };

  return (
    <View style={[s.root, { paddingTop: Math.max(insets.top, 16) + 8, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={s.head}>
        <View style={s.ic}><MaterialCommunityIcons name="file-document-check-outline" size={24} color={N.marca} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{terminos?.titulo ?? "Términos y condiciones"}</Text>
          <Text style={s.sub}>{terminos?.subtitulo ?? "Léelos y acéptalos para empezar a usar la app."}</Text>
        </View>
        {terminos ? <Text style={s.version}>Versión {terminos.version}</Text> : null}
      </View>

      <View style={s.caja}>
        {terminos ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.texto}
            onScroll={onScroll}
            scrollEventThrottle={64}
            onLayout={(e) => { alto.current.vista = e.nativeEvent.layout.height; revisar(); }}
            onContentSizeChange={(_w, h) => { alto.current.contenido = h; revisar(); }}
          >
            {terminos.secciones.map((sec, i) => (
              <View key={sec.titulo} style={{ marginBottom: 16 }}>
                <Text style={s.h3}>{i + 1}. {sec.titulo}</Text>
                <Text style={s.p}>{sec.texto}</Text>
              </View>
            ))}
          </ScrollView>
        ) : error ? (
          <View style={s.centro}>
            <MaterialCommunityIcons name="wifi-off" size={28} color={N.apagado} />
            <Text style={[s.p, { textAlign: "center" }]}>{error}</Text>
            <Button title="Reintentar" kind="ghost" onPress={cargar} />
          </View>
        ) : (
          <View style={s.centro}><ActivityIndicator color={N.marca} /></View>
        )}
      </View>

      <Text style={s.hint}>{leido ? "Ya puedes marcar la casilla." : "Desplázate hasta el final para continuar."}</Text>
      <Pressable
        onPress={() => leido && setAcepto((v) => !v)}
        style={[s.check, !leido && { opacity: 0.55 }]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: acepto, disabled: !leido }}
      >
        <MaterialCommunityIcons name={acepto ? "checkbox-marked" : "checkbox-blank-outline"} size={24} color={acepto ? N.marca : N.apagado} />
        <Text style={s.checkText}>He leído y acepto los términos y condiciones y la política de privacidad</Text>
      </Pressable>
      {error && terminos ? <Text style={s.error}>{error}</Text> : null}

      <View style={s.botones}>
        <View style={{ flex: 1 }}><Button title="Rechazar y salir" kind="ghost" onPress={logout} disabled={enviando} /></View>
        <View style={{ flex: 1 }}><Button title={enviando ? "Guardando…" : "Aceptar y continuar"} onPress={aceptar} disabled={!acepto || enviando || !terminos} /></View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: N.fondo, paddingHorizontal: 18 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  ic: { width: 46, height: 46, borderRadius: 14, backgroundColor: N.suave, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: FI.semi, fontSize: 22, lineHeight: 28, color: "#000" },
  sub: { fontFamily: FI.reg, color: N.apagado, fontSize: 13.5, marginTop: 2 },
  version: { fontFamily: FI.reg, color: N.apagado, fontSize: 12, marginTop: 6 },
  caja: { flex: 1, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: N.borde, overflow: "hidden" },
  texto: { padding: 18 },
  h3: { fontFamily: FI.semi, fontSize: 15, color: N.tinta, marginBottom: 4 },
  p: { fontFamily: FI.reg, fontSize: 14.5, lineHeight: 22, color: N.apagado },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  hint: { fontFamily: FI.reg, color: N.apagado, fontSize: 12.5, marginTop: 10 },
  check: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 10, paddingVertical: 4 },
  checkText: { flex: 1, fontFamily: FI.reg, fontSize: 14.5, lineHeight: 20, color: N.tinta },
  error: { fontFamily: FI.med, color: N.rojoTexto, fontSize: 13, marginTop: 8 },
  botones: { flexDirection: "row", gap: 10, marginTop: 14 },
});
