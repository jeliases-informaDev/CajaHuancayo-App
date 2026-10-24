import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../AuthContext";
import { FI, N } from "../theme";
import { request } from "../api";

// Inicio de sesión (Figma «Frame 3»): franja morada arriba y una hoja blanca con esquinas redondas que lleva el formulario.
const ALTO_FRANJA = 150;

function Campo({ etiqueta, secreto, ...props }: any) {
  const [oculto, setOculto] = useState(Boolean(secreto));
  const [enfocado, setEnfocado] = useState(false);
  return (
    <View style={s.campo}>
      <Text style={s.etiqueta}>{etiqueta}</Text>
      <View style={[s.caja, enfocado && s.cajaFoco]}>
        <TextInput placeholderTextColor="#9AA1B5" style={s.entrada} secureTextEntry={secreto ? oculto : false} onFocus={() => setEnfocado(true)} onBlur={() => setEnfocado(false)} accessibilityLabel={etiqueta} {...props} />
        {secreto ? (
          <Pressable accessibilityRole="button" accessibilityLabel={oculto ? "Mostrar contraseña" : "Ocultar contraseña"} hitSlop={10} onPress={() => setOculto((v) => !v)}>
            <MaterialCommunityIcons name={oculto ? "eye-outline" : "eye-off-outline"} size={21} color={N.apagado} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const { login, verifyMfa } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [enroll, setEnroll] = useState(false);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      if (challenge) {
        if (code.length !== 6) throw new Error("Ingresa los 6 dígitos.");
        await verifyMfa(challenge, code, enroll);
      } else {
        const data = await login(username.trim(), password);
        if (data.mfaRequired || data.mfaEnrollmentRequired) {
          setChallenge(data.challengeToken);
          setEnroll(Boolean(data.mfaEnrollmentRequired));
          if (data.mfaEnrollmentRequired) {
            const setup: any = await request("/api/auth/mfa/enroll/setup", { method: "POST", body: JSON.stringify({ challengeToken: data.challengeToken }) });
            setSecret(setup.secret || "");
          }
        }
      }
    } catch (e: any) {
      setError(e.message || "No se pudo iniciar sesión");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.pantalla}>
      <StatusBar style="light" />
      <LinearGradient colors={[N.marca, "#524CBC"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.franja} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.teclado}>
        <ScrollView keyboardShouldPersistTaps="always" keyboardDismissMode="none" automaticallyAdjustKeyboardInsets={Platform.OS === "ios"} removeClippedSubviews={false} showsVerticalScrollIndicator={false} contentContainerStyle={s.desplazar}>
          <View style={s.hoja}>
            <Text style={s.titulo} accessibilityRole="header">{challenge ? "Verificación en dos pasos" : "Iniciar sesión"}</Text>
            <Text style={s.sub}>{challenge ? "Confirma tu identidad para continuar." : "Ingresa tus datos para continuar"}</Text>

            {!challenge ? (
              <>
                <Campo etiqueta="Usuario" value={username} onChangeText={setUsername} editable={!busy} autoCapitalize="none" autoCorrect={false} blurOnSubmit={false} returnKeyType="next" placeholder="Ingresa tu usuario" />
                <Campo etiqueta="Contraseña" secreto value={password} onChangeText={setPassword} editable={!busy} returnKeyType="done" onSubmitEditing={submit} placeholder="Ingresa tu contraseña" />
              </>
            ) : (
              <>
                {secret ? (
                  <View style={s.secret}>
                    <Text style={s.secretTitle}>Configura tu autenticador</Text>
                    <Text selectable style={s.secretValue}>{secret}</Text>
                  </View>
                ) : null}
                <Campo etiqueta="Código de 6 dígitos" value={code} onChangeText={(value: string) => setCode(value.replace(/\D/g, "").slice(0, 6))} editable={!busy} keyboardType="number-pad" maxLength={6} placeholder="000000" />
              </>
            )}

            {error ? (
              <View style={s.error}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#C0243E" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable disabled={busy} onPress={submit} accessibilityRole="button" style={({ pressed }) => [s.boton, (pressed || busy) && { opacity: 0.8 }]}>
              <Text style={s.botonTexto}>{busy ? "Validando…" : challenge ? "Verificar acceso" : "Iniciar sesión"}</Text>
            </Pressable>
            {challenge ? (
              <Pressable accessibilityRole="button" onPress={() => { setChallenge(""); setCode(""); setError(""); }} style={s.volver}>
                <Text style={s.volverTexto}>Volver</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#fff" },
  franja: { position: "absolute", left: 0, right: 0, top: 0, height: ALTO_FRANJA + 60 },
  teclado: { flex: 1 },
  desplazar: { flexGrow: 1, paddingTop: ALTO_FRANJA, alignItems: "center" },
  hoja: { flexGrow: 1, width: "100%", maxWidth: 520, backgroundColor: "#fff", borderTopLeftRadius: 40, borderTopRightRadius: 40, paddingHorizontal: 32, paddingTop: 60, paddingBottom: 32, gap: 20 },
  titulo: { fontFamily: FI.bold, fontSize: 28, lineHeight: 34, color: N.tinta },
  sub: { fontFamily: FI.reg, fontSize: 15, lineHeight: 21, color: N.apagado, marginTop: -14 },
  campo: { gap: 8 },
  etiqueta: { fontFamily: FI.semi, fontSize: 14, color: "#2B3047" },
  caja: { minHeight: 52, borderWidth: 1, borderColor: "#E6E8F0", borderRadius: 12, paddingHorizontal: 16, backgroundColor: N.campo, flexDirection: "row", alignItems: "center", gap: 10 },
  cajaFoco: { borderColor: N.marca, backgroundColor: "#fff" },
  entrada: { flex: 1, fontFamily: FI.reg, fontSize: 15, color: N.tinta, paddingVertical: 14 },
  secret: { backgroundColor: N.suave, borderRadius: 14, padding: 14, gap: 6 },
  secretTitle: { fontFamily: FI.semi, fontSize: 13, color: N.tinta },
  secretValue: { fontFamily: FI.semi, fontSize: 13, color: N.marca },
  error: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: N.rojoFondo, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#F5C6CC" },
  errorText: { flex: 1, fontFamily: FI.med, color: "#C0243E", fontSize: 13 },
  boton: { minHeight: 52, borderRadius: 12, backgroundColor: N.marca, alignItems: "center", justifyContent: "center", marginTop: 4 },
  botonTexto: { fontFamily: FI.semi, fontSize: 16, color: "#fff" },
  volver: { alignSelf: "center", paddingVertical: 8, paddingHorizontal: 16 },
  volverTexto: { fontFamily: FI.semi, fontSize: 14, color: N.marca },
});
