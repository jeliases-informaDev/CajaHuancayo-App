import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../AuthContext";
import { Button, Input } from "../ui";
import { C } from "../theme";
import { request } from "../api";

export default function LoginScreen() {
  const { width } = useWindowDimensions();
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
            const setup: any = await request("/api/auth/mfa/enroll/setup", {
              method: "POST",
              body: JSON.stringify({ challengeToken: data.challengeToken }),
            });
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
    <SafeAreaView edges={["top", "bottom"]} style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.keyboard}
      >
        <ScrollView
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          removeClippedSubviews={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            s.scroll,
            wide && s.scrollWide,
          ]}
        >
          <View style={[s.root, wide && s.rootWide]}>
            <LinearGradient
              colors={["#061839", "#0A2C70", C.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[s.brand, wide && s.brandWide]}
            >
              <View style={s.brandGlow} />
              <View style={s.brandLineVertical} />
              <View style={s.brandLineHorizontal} />
              <View style={s.brandTop}>
                <View style={s.logoBox}>
                  <Image
                    source={require("../../assets/radar-logo.png")}
                    resizeMode="contain"
                    style={s.logo}
                  />
                </View>
                <View>
                  <Text style={s.name}>Auditoría de Visitas</Text>
                  <Text style={s.company}>CAJA HUANCAYO</Text>
                </View>
              </View>
              {wide ? (
                <View style={s.brandCopy}>
                  <Text style={s.brandTitle}>
                    Verificación en campo{"\n"}con trazabilidad total.
                  </Text>
                  <Text style={s.brandText}>
                    Muestra asignada, ficha de entrevista y evidencia desde un solo lugar.
                  </Text>
                </View>
              ) : null}
              {wide ? <View style={s.orb} /> : null}
            </LinearGradient>
            <View style={[s.form, wide && s.formWide]}>
              <View style={[s.formAccent, wide && s.formAccentHidden]} />
              <View style={s.secure}>
                <MaterialCommunityIcons
                  name="shield-check-outline"
                  size={17}
                  color={C.primary}
                />
                <Text style={s.secureText}>ACCESO SEGURO</Text>
              </View>
              <Text style={s.title}>
                {challenge ? "Verificación" : "Inicia tu jornada"}
              </Text>
              <Text style={s.sub}>
                {challenge
                  ? "Confirma tu identidad para continuar."
                  : "Ingresa con las credenciales de tu organización."}
              </Text>
              {!challenge ? (
                <>
                  <Input
                    label="Usuario"
                    icon="account-outline"
                    value={username}
                    onChangeText={setUsername}
                    editable={!busy}
                    autoCapitalize="none"
                    autoCorrect={false}
                    blurOnSubmit={false}
                    returnKeyType="next"
                    placeholder="Ingresa tu usuario"
                  />
                  <Input
                    label="Contraseña"
                    icon="lock-outline"
                    value={password}
                    onChangeText={setPassword}
                    editable={!busy}
                    secureTextEntry
                    returnKeyType="done"
                    onSubmitEditing={submit}
                    placeholder="Ingresa tu contraseña"
                  />
                </>
              ) : (
                <>
                  {secret ? (
                    <View style={s.secret}>
                      <Text style={s.secretTitle}>
                        Configura tu autenticador
                      </Text>
                      <Text selectable style={s.secretValue}>
                        {secret}
                      </Text>
                    </View>
                  ) : null}
                  <Input
                    label="Código de 6 dígitos"
                    icon="shield-key-outline"
                    value={code}
                    onChangeText={(value: string) =>
                      setCode(value.replace(/\D/g, "").slice(0, 6))
                    }
                    editable={!busy}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="000000"
                  />
                </>
              )}
              {error ? (
                <View style={s.error}>
                  <MaterialCommunityIcons
                    name="alert-circle-outline"
                    size={18}
                    color={C.danger}
                  />
                  <Text style={s.errorText}>{error}</Text>
                </View>
              ) : null}
              <Button
                title={
                  busy
                    ? "Validando…"
                    : challenge
                      ? "Verificar acceso"
                      : "Ingresar"
                }
                icon={challenge ? "shield-check" : "login"}
                onPress={submit}
                disabled={busy}
              />
              {challenge ? (
                <Button
                  title="Volver"
                  kind="ghost"
                  icon="arrow-left"
                  onPress={() => {
                    setChallenge("");
                    setCode("");
                    setError("");
                  }}
                />
              ) : null}
              <Text style={s.footer}>Tecnología financiera · Informa Perú</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  keyboard: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: "#FFFFFF",
  },
  scrollWide: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  root: {
    flex: 1,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    justifyContent: "flex-start",
    paddingVertical: 0,
  },
  rootWide: {
    maxWidth: 980,
    flexDirection: "row",
    alignItems: "stretch",
    flex: 0,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: C.navy,
    shadowOpacity: 0.22,
    shadowRadius: 44,
    shadowOffset: { width: 0, height: 24 },
    elevation: 12,
  },
  brand: {
    borderRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 22,
    paddingVertical: 18,
    minHeight: 132,
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: C.navy,
    shadowOpacity: 0,
    elevation: 0,
  },
  brandWide: {
    flex: 1,
    minHeight: 500,
    justifyContent: "space-between",
    paddingHorizontal: 40,
    paddingVertical: 40,
  },
  brandTop: { flexDirection: "row", alignItems: "center", gap: 12, zIndex: 1 },
  logoBox: {
    width: 54,
    height: 54,
    backgroundColor: "#fff",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 44, height: 44, borderRadius: 12 },
  name: { color: "#fff", fontSize: 19, fontWeight: "900", letterSpacing: -0.4 },
  company: {
    color: "#AFC2FF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.6,
    marginTop: 2,
  },
  brandCopy: { zIndex: 1 },
  brandTitle: {
    color: "#fff",
    fontSize: 30,
    lineHeight: 35,
    fontWeight: "900",
    letterSpacing: -0.8,
    zIndex: 1,
  },
  brandText: {
    color: "#C8D5F8",
    marginTop: 10,
    fontSize: 13.5,
    maxWidth: 300,
    lineHeight: 20,
    zIndex: 1,
  },
  orb: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 100,
    right: -65,
    bottom: -70,
    borderWidth: 28,
    borderColor: "#FFFFFF10",
  },
  brandGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 160,
    right: -70,
    bottom: -95,
    backgroundColor: "#4B70FF1C",
    borderWidth: 44,
    borderColor: "#FFFFFF08",
  },
  brandLineVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: "31%",
    width: 1,
    backgroundColor: "#FFFFFF0A",
  },
  brandLineHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 20,
    height: 1,
    backgroundColor: "#FFFFFF0A",
  },
  form: {
    flexGrow: 1,
    backgroundColor: "#fff",
    borderRadius: 0,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
    gap: 14,
    marginTop: 0,
    marginHorizontal: 0,
    shadowOpacity: 0,
    elevation: 0,
    overflow: "hidden",
  },
  formWide: {
    flex: 1,
    justifyContent: "center",
    marginLeft: 0,
    marginRight: 0,
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 52,
    paddingTop: 38,
    paddingBottom: 32,
  },
  formAccentHidden: { opacity: 0 },
  formAccent: {
    position: "absolute",
    top: 0,
    left: 24,
    width: 48,
    height: 4,
    borderRadius: 4,
    backgroundColor: C.red,
  },
  secure: { flexDirection: "row", alignItems: "center", gap: 6 },
  secureText: {
    color: C.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  title: {
    fontSize: 27,
    fontWeight: "900",
    color: C.text,
    letterSpacing: -0.6,
  },
  sub: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: -5, marginBottom: 3 },
  field: { gap: 7 },
  fieldLabel: {
    color: "#5F6B7E",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  fieldLabelFocused: { color: C.primary },
  fieldShell: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DDE4EF",
    borderRadius: 15,
    backgroundColor: "#F9FBFE",
    paddingHorizontal: 10,
  },
  fieldShellFocused: {
    borderColor: C.primary2,
    backgroundColor: "#FFFFFF",
    shadowColor: C.primary,
    shadowOpacity: 0.1,
    shadowRadius: 7,
    elevation: 2,
  },
  fieldIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2F8",
  },
  fieldIconFocused: { backgroundColor: "#EEF2FF" },
  fieldInput: {
    flex: 1,
    minWidth: 0,
    color: C.text,
    fontSize: 15,
    paddingHorizontal: 10,
    paddingVertical: 13,
  },
  eyeButton: {
    width: 38,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  controlPressed: { opacity: 0.58 },
  error: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "#FFF1F2",
    padding: 11,
    borderRadius: 11,
  },
  errorText: { color: C.danger, fontSize: 12, flex: 1 },
  secret: { padding: 12, borderRadius: 12, backgroundColor: "#EEF4FF" },
  secretTitle: { fontWeight: "800", color: C.text },
  secretValue: { color: C.primary, marginTop: 6, fontSize: 12 },
  footer: { textAlign: "center", color: "#99A3B3", fontSize: 10, marginTop: 2 },
});
