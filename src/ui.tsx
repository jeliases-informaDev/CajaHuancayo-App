import React, { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControlProps, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, statusColors } from "./theme";

// Componentes base de la app. Criterios: superficies planas con borde fino, una sola jerarquía
// tipográfica (título 22, sección 15, cuerpo 14, apoyo 12), controles de 48 px de alto y un solo
// color de acción. Nada de sombras pesadas ni decoración sin función.

export function Screen({ children, scroll = true, refreshControl, scrollRef }: {
  children: React.ReactNode; scroll?: boolean; refreshControl?: React.ReactElement<RefreshControlProps>; scrollRef?: React.RefObject<ScrollView | null>;
}) {
  const content = <View style={s.content}>{children}</View>;
  return (
    <SafeAreaView edges={["top"]} style={s.safe}>
      {scroll ? (
        <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={refreshControl} contentContainerStyle={s.scroll}>
          {content}
        </ScrollView>
      ) : content}
    </SafeAreaView>
  );
}

export function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <View style={s.header}>
      <View style={s.headerText}>
        <Text style={s.title}>{title}</Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Button({ title, onPress, kind = "primary", disabled = false, icon }: {
  title: string; onPress: () => void; kind?: "primary" | "ghost" | "danger"; disabled?: boolean; icon?: any;
}) {
  const ghost = kind === "ghost";
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.button, ghost && s.buttonGhost, kind === "danger" && s.buttonDanger, (pressed || disabled) && s.pressed]}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={19} color={ghost ? C.ink : "#fff"} /> : null}
      <Text style={[s.buttonText, ghost && s.buttonGhostText]}>{title}</Text>
    </Pressable>
  );
}

export function Input({ label, error, icon = "magnify", secureTextEntry, ...props }: any) {
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.field}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={[s.inputWrap, focused && s.inputFocus, error && s.inputError]}>
        {icon ? <MaterialCommunityIcons name={icon} size={19} color={focused ? C.primary : C.muted} /> : null}
        <TextInput
          placeholderTextColor={C.placeholder}
          style={s.input}
          secureTextEntry={secureTextEntry ? hidden : false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {secureTextEntry ? (
          <Pressable accessibilityRole="button" accessibilityLabel={hidden ? "Mostrar contraseña" : "Ocultar contraseña"} hitSlop={10} onPress={() => setHidden((v) => !v)}>
            <MaterialCommunityIcons name={hidden ? "eye-outline" : "eye-off-outline"} size={21} color={C.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

export function Badge({ status, label }: { status?: string; label?: string }) {
  const color = statusColors[status || ""] || C.muted;
  return (
    <View style={[s.badge, { backgroundColor: `${color}14` }]}>
      <View style={[s.badgeDot, { backgroundColor: color }]} />
      <Text style={[s.badgeText, { color }]}>{label || String(status || "").replaceAll("_", " ")}</Text>
    </View>
  );
}

export function Empty({ title = "Sin información", text = "Los datos aparecerán aquí cuando sean registrados." }: { title?: string; text?: string }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}><MaterialCommunityIcons name="inbox-outline" size={26} color={C.primary} /></View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={s.empty}>
      <ActivityIndicator size="large" color={C.primary} />
      <Text style={s.emptyText}>Cargando…</Text>
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action ? <Text style={s.sectionAction}>{action}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1 },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24, gap: 14, flexGrow: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 2 },
  headerText: { flex: 1 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "700", color: C.ink, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, lineHeight: 19, color: C.muted, marginTop: 1 },
  card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16 },
  button: { minHeight: 48, borderRadius: 10, backgroundColor: C.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, flexDirection: "row", gap: 8 },
  buttonGhost: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderStrong },
  buttonDanger: { backgroundColor: C.danger },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  buttonGhostText: { color: C.ink },
  pressed: { opacity: 0.7 },
  field: { gap: 6 },
  label: { fontSize: 12.5, fontWeight: "600", color: C.text2 },
  inputWrap: { minHeight: 50, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 10, paddingHorizontal: 13, backgroundColor: C.surface, flexDirection: "row", alignItems: "center", gap: 9 },
  inputFocus: { borderColor: C.primary2, borderWidth: 1.5 },
  input: { flex: 1, fontSize: 15, color: C.ink, paddingVertical: 12 },
  inputError: { borderColor: C.danger },
  error: { color: C.danger, fontSize: 12 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5 },
  badgeDot: { width: 6, height: 6, borderRadius: 6 },
  badgeText: { fontSize: 10.5, fontWeight: "700", textTransform: "capitalize" },
  empty: { flex: 1, minHeight: 200, alignItems: "center", justifyContent: "center", gap: 8, padding: 26 },
  emptyIcon: { width: 52, height: 52, borderRadius: 12, backgroundColor: C.blue50, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: C.ink },
  emptyText: { fontSize: 13, lineHeight: 19, color: C.muted, textAlign: "center" },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: C.ink },
  sectionAction: { fontSize: 12.5, color: C.primary, fontWeight: "600" },
});
export const styles = s;
