import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../AuthContext";
import { Button, Input } from "../ui";
import { C, F, G } from "../theme";
import { request } from "../api";

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 760;
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

  const hero = (
    <View style={[s.hero, wide && s.heroWide, { paddingTop: Math.max(insets.top, 16) + 18 }]}>
      <View style={s.brandRow}>
        <LinearGradient colors={[...G.brand]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.mark}>
          <Text style={s.markText}>CH</Text>
        </LinearGradient>
        <View>
          <Text style={s.brandName}>Auditoría de Visitas</Text>
          <Text style={s.brandCompany}>CAJA HUANCAYO</Text>
        </View>
      </View>
      <View style={s.copy}>
        <Text style={s.headline}>Cada visita deja una prueba que se puede revisar.</Text>
        <Text style={s.lead}>Tu muestra, la ficha de entrevista y la evidencia, incluso sin señal.</Text>
      </View>
      <LinearGradient colors={[...G.brand]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.heroLine} />
    </View>
  );

  const form = (
    <View style={[s.sheet, wide && s.sheetWide]}>
      <Text style={s.title}>{challenge ? "Verificación en dos pasos" : "Iniciar sesión"}</Text>
      <Text style={s.sub}>{challenge ? "Confirma tu identidad para continuar." : "Ingresa con tu usuario de auditor."}</Text>

      {!challenge ? (
        <>
          <Input label="Usuario" icon="account-outline" value={username} onChangeText={setUsername} editable={!busy} autoCapitalize="none" autoCorrect={false} blurOnSubmit={false} returnKeyType="next" placeholder="Ingresa tu usuario" />
          <Input label="Contraseña" icon="lock-outline" value={password} onChangeText={setPassword} editable={!busy} secureTextEntry returnKeyType="done" onSubmitEditing={submit} placeholder="Ingresa tu contraseña" />
        </>
      ) : (
        <>
          {secret ? (
            <View style={s.secret}>
              <Text style={s.secretTitle}>Configura tu autenticador</Text>
              <Text selectable style={s.secretValue}>{secret}</Text>
            </View>
          ) : null}
          <Input label="Código de 6 dígitos" icon="shield-key-outline" value={code} onChangeText={(value: string) => setCode(value.replace(/\D/g, "").slice(0, 6))} editable={!busy} keyboardType="number-pad" maxLength={6} placeholder="000000" />
        </>
      )}

      {error ? (
        <View style={s.error}>
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color={C.danger} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      <Button title={busy ? "Validando…" : challenge ? "Verificar acceso" : "Ingresar"} icon={challenge ? "shield-check" : "login"} onPress={submit} disabled={busy} />
      {challenge ? (
        <Button title="Volver" kind="ghost" icon="arrow-left" onPress={() => { setChallenge(""); setCode(""); setError(""); }} />
      ) : null}
      <Text style={s.footer}>Tecnología financiera · Informa Perú</Text>
    </View>
  );

  return (
    <SafeAreaView edges={["bottom"]} style={s.safe}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.keyboard}>
        <ScrollView keyboardShouldPersistTaps="always" keyboardDismissMode="none" automaticallyAdjustKeyboardInsets={Platform.OS === "ios"} removeClippedSubviews={false} showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, wide && s.scrollWide]}>
          {hero}
          {form}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  keyboard: { flex: 1 },
  scroll: { flexGrow: 1 },
  scrollWide: { flexDirection: "row" },
  hero: { paddingHorizontal: 24, paddingBottom: 44, gap: 28, backgroundColor: C.navy },
  heroWide: { flex: 1.1, justifyContent: "space-between", paddingHorizontal: 48, paddingBottom: 48 },
  heroLine: { position: "absolute", left: 0, right: 0, bottom: 0, height: 4 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  mark: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  markText: { color: "#fff", fontWeight: "700", fontSize: 14, letterSpacing: 0.3 },
  brandName: { color: "#fff", fontSize: 16, fontWeight: "600" },
  brandCompany: { color: "#8E99C6", fontSize: 10, fontWeight: "600", letterSpacing: 1.6, marginTop: 2 },
  copy: { gap: 8 },
  headline: { fontFamily: F.displayLight, color: "#fff", fontSize: 31, lineHeight: 36, fontWeight: "normal", letterSpacing: -0.6, maxWidth: 360 },
  lead: { color: "#B6BFE0", fontSize: 14, lineHeight: 21, maxWidth: 340 },
  sheet: { flexGrow: 1, backgroundColor: "#fff", paddingHorizontal: 24, paddingTop: 26, paddingBottom: 28, gap: 14 },
  sheetWide: { flex: 1, marginTop: 0, borderRadius: 0, justifyContent: "center", paddingHorizontal: 56, backgroundColor: C.bg },
  title: { fontFamily: F.display, fontSize: 28, fontWeight: "normal", letterSpacing: -0.4, color: C.ink },
  sub: { fontSize: 14, color: C.muted, marginTop: -6, lineHeight: 20, marginBottom: 6 },
  secret: { backgroundColor: C.blue50, borderRadius: 14, padding: 14, gap: 6 },
  secretTitle: { fontSize: 13, fontWeight: "600", color: C.ink },
  secretValue: { fontSize: 13, fontWeight: "600", color: C.primary },
  error: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: C.dangerBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#F5C6CC" },
  errorText: { flex: 1, color: C.danger, fontSize: 13, fontWeight: "500" },
  footer: { textAlign: "center", color: C.placeholder, fontSize: 11.5, marginTop: 6 },
});
