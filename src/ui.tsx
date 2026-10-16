import React, { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControlProps, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { avatarTone, C, F, G, initials, shadow, statusColors } from "./theme";

// Componentes base de la app. Criterios: lienzo frío con tarjetas blancas de borde fino y sombra tintada,
// titulares en serif, controles de 52 px de alto y un solo color de acción (azul) con el hilo de marca
// reservado a lo verificado. Nada de decoración sin función.

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

export function Header({ title, subtitle, right, eyebrow }: { title: string; subtitle?: string; right?: React.ReactNode; eyebrow?: string }) {
  return (
    <View style={s.header}>
      <View style={s.headerText}>
        {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
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

export function Avatar({ name, size = 40 }: { name?: string | null; size?: number }) {
  const { bg, fg } = avatarTone(name);
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: fg, fontWeight: "700", fontSize: size * 0.36, letterSpacing: 0.2 }}>{initials(name)}</Text>
    </View>
  );
}

export function Button({ title, onPress, kind = "primary", disabled = false, icon }: {
  title: string; onPress: () => void; kind?: "primary" | "ghost" | "danger"; disabled?: boolean; icon?: any;
}) {
  const ghost = kind === "ghost";
  const inner = (
    <>
      {icon ? <MaterialCommunityIcons name={icon} size={20} color={ghost ? C.ink : "#fff"} /> : null}
      <Text style={[s.buttonText, ghost && s.buttonGhostText]}>{title}</Text>
    </>
  );
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.buttonOuter, !ghost && shadow.sm, (pressed || disabled) && s.pressed, pressed && { transform: [{ scale: 0.985 }] }]}
    >
      {ghost ? <View style={[s.button, s.buttonGhost]}>{inner}</View> : (
        <LinearGradient colors={[...(kind === "danger" ? G.danger : G.action)]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.button}>{inner}</LinearGradient>
      )}
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
        {icon ? <MaterialCommunityIcons name={icon} size={20} color={focused ? C.primary : C.muted} /> : null}
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
    <View style={[s.badge, { backgroundColor: `${color}18` }]}>
      <View style={[s.badgeDot, { backgroundColor: color }]} />
      <Text style={[s.badgeText, { color }]}>{label || String(status || "").replaceAll("_", " ")}</Text>
    </View>
  );
}

// Control segmentado (mismo recurso que el panel): el elegido "flota" sobre el fondo hundido.
export function Seg<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={s.seg} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable key={o.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.id)} style={[s.segItem, on && s.segItemOn]}>
            <Text style={[s.segText, on && s.segTextOn]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Empty({ title = "Sin información", text = "Los datos aparecerán aquí cuando sean registrados." }: { title?: string; text?: string }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyArt}>
        <View style={s.emptyRing} />
        <View style={s.emptyIcon}><MaterialCommunityIcons name="map-marker-check-outline" size={28} color={C.primary} /></View>
      </View>
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
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28, gap: 16, flexGrow: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 2 },
  headerText: { flex: 1 },
  eyebrow: { fontSize: 12.5, fontWeight: "500", color: C.muted, marginBottom: 2 },
  title: { fontFamily: F.display, fontSize: 36, lineHeight: 40, fontWeight: "normal", color: C.ink, letterSpacing: -0.8 },
  subtitle: { fontSize: 13.5, lineHeight: 19, color: C.muted, marginTop: 3 },
  card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 18, ...shadow.sm },
  buttonOuter: { borderRadius: 14 },
  button: { minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, flexDirection: "row", gap: 9 },
  buttonGhost: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderStrong },
  buttonText: { color: "#fff", fontSize: 15.5, fontWeight: "600", letterSpacing: 0.1 },
  buttonGhostText: { color: C.ink },
  pressed: { opacity: 0.78 },
  field: { gap: 7 },
  label: { fontSize: 12.5, fontWeight: "600", color: C.text2 },
  inputWrap: { minHeight: 54, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 14, paddingHorizontal: 14, backgroundColor: C.surface, flexDirection: "row", alignItems: "center", gap: 10 },
  inputFocus: { borderColor: C.primary2, borderWidth: 1.5 },
  input: { flex: 1, fontSize: 15.5, color: C.ink, paddingVertical: 13 },
  inputError: { borderColor: C.danger },
  error: { color: C.danger, fontSize: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6 },
  badgeDot: { width: 6, height: 6, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  seg: { flexDirection: "row", padding: 3, borderRadius: 14, backgroundColor: C.soft, gap: 2 },
  segItem: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 11, paddingHorizontal: 8 },
  segItemOn: { backgroundColor: C.surface, ...shadow.sm },
  segText: { fontSize: 13, fontWeight: "500", color: C.muted },
  segTextOn: { color: C.ink, fontWeight: "700" },
  empty: { flex: 1, minHeight: 220, alignItems: "center", justifyContent: "center", gap: 8, padding: 28 },
  emptyArt: { width: 84, height: 84, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  emptyRing: { position: "absolute", width: 84, height: 84, borderRadius: 42, borderWidth: 1.5, borderColor: C.borderStrong, borderStyle: "dashed" },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: C.blue50, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: F.display, fontSize: 25, lineHeight: 29, fontWeight: "normal", color: C.ink, letterSpacing: -0.3, textAlign: "center" },
  emptyText: { fontSize: 13.5, lineHeight: 20, color: C.muted, textAlign: "center", maxWidth: 300 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: C.ink },
  sectionAction: { fontSize: 12.5, color: C.primary, fontWeight: "600" },
});
export const styles = s;
