import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControlProps,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { C, G, statusColors } from "./theme";

export function Screen({
  children,
  scroll = true,
  refreshControl,
  scrollRef,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  scrollRef?: React.RefObject<ScrollView | null>;
}) {
  const content = <View style={s.content}>{children}</View>;
  return (
    <SafeAreaView edges={["top"]} style={s.safe}>
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          contentContainerStyle={s.scroll}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
export function Header({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={s.header}>
      <LinearGradient colors={[...G.brand]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.headerMark} />
      <View style={s.headerText}>
        <Text style={s.title}>{title}</Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Button({
  title,
  onPress,
  kind = "primary",
  disabled = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  kind?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  icon?: any;
}) {
  const contenido = (
    <>
      {icon ? <MaterialCommunityIcons name={icon} size={19} color={kind === "ghost" ? C.navy2 : "#fff"} /> : null}
      <Text style={[s.buttonText, kind === "ghost" && s.buttonGhostText]}>{title}</Text>
    </>
  );
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.buttonWrap, kind === "ghost" && s.buttonGhost, kind === "danger" && s.buttonDanger, (pressed || disabled) && s.pressed]}
    >
      {kind === "primary" ? (
        <LinearGradient colors={[...G.brand]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={s.button}>{contenido}</LinearGradient>
      ) : (
        <View style={s.button}>{contenido}</View>
      )}
    </Pressable>
  );
}
export function Input({
  label,
  error,
  icon = "magnify",
  secureTextEntry,
  ...props
}: any) {
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));
  return (
    <View style={s.field}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={[s.inputWrap, error && s.inputError]}>
        {icon ? (
          <MaterialCommunityIcons name={icon} size={19} color={C.muted} />
        ) : null}
        <TextInput
          placeholderTextColor="#9AA5B5"
          style={s.input}
          secureTextEntry={secureTextEntry ? hidden : false}
          {...props}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              hidden ? "Mostrar contraseña" : "Ocultar contraseña"
            }
            hitSlop={10}
            onPress={() => setHidden((value) => !value)}
          >
            <MaterialCommunityIcons
              name={hidden ? "eye-outline" : "eye-off-outline"}
              size={22}
              color={C.muted}
            />
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
    <View style={[s.badge, { backgroundColor: `${color}16` }]}>
      <View style={[s.badgeDot, { backgroundColor: color }]} />
      <Text style={[s.badgeText, { color }]}>
        {label || String(status || "").replaceAll("_", " ")}
      </Text>
    </View>
  );
}
export function Empty({
  title = "Sin información",
  text = "Los datos aparecerán aquí cuando sean registrados.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <MaterialCommunityIcons
          name="database-outline"
          size={30}
          color={C.violet}
        />
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
      <Text style={s.emptyText}>Sincronizando información…</Text>
    </View>
  );
}
export function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: string;
}) {
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
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 16,
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 2,
  },
  headerMark: { width: 5, height: 40, borderRadius: 5 },
  headerText: { flex: 1 },
  title: {
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "900",
    color: C.navy,
    letterSpacing: -0.7,
  },
  subtitle: { fontSize: 13, lineHeight: 19, color: C.muted, marginTop: 2 },
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    padding: 16,
    shadowColor: C.navy,
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  buttonWrap: {
    borderRadius: 16,
    shadowColor: C.violet,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  button: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    flexDirection: "row",
    gap: 8,
  },
  buttonGhost: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, shadowOpacity: 0, elevation: 0 },
  buttonDanger: { backgroundColor: C.red, shadowColor: C.red },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 0.1 },
  buttonGhostText: { color: C.navy2 },
  pressed: { opacity: 0.68, transform: [{ scale: 0.99 }] },
  field: { gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  inputWrap: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: C.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  input: { flex: 1, fontSize: 15, color: C.text, paddingVertical: 12 },
  inputError: { borderColor: C.danger },
  error: { color: C.danger, fontSize: 12 },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  empty: {
    flex: 1,
    minHeight: 210,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    padding: 26,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#EEE6FA",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "900", color: C.text },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    color: C.muted,
    textAlign: "center",
  },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 17, fontWeight: "900", color: C.text },
  sectionAction: { fontSize: 12, color: C.primary, fontWeight: "800" },
});
export const styles = s;
