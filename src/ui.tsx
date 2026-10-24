import React from "react";
import { ActivityIndicator, Pressable, RefreshControlProps, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { FI, N } from "./theme";

// Componentes base que siguen en uso: pantalla con desplazamiento, botón, estado vacío y «cargando».
// Mismo lenguaje del Figma: lienzo F1F2F8, tarjetas blancas, un solo azul de acción y la letra de la web (Be Vietnam Pro).

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

export function Button({ title, onPress, kind = "primary", disabled = false, icon }: {
  title: string; onPress: () => void; kind?: "primary" | "ghost" | "danger"; disabled?: boolean; icon?: any;
}) {
  const ghost = kind === "ghost";
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.button, kind === "primary" && s.buttonPrimary, ghost && s.buttonGhost, kind === "danger" && s.buttonDanger, (pressed || disabled) && s.pressed]}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={20} color={ghost ? N.marca : "#fff"} /> : null}
      <Text style={[s.buttonText, ghost && s.buttonGhostText]}>{title}</Text>
    </Pressable>
  );
}

export function Empty({ title = "Sin información", text = "Los datos aparecerán aquí cuando sean registrados." }: { title?: string; text?: string }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}><MaterialCommunityIcons name="map-marker-check-outline" size={28} color={N.marca} /></View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={s.empty}>
      <ActivityIndicator size="large" color={N.marca} />
      <Text style={s.emptyText}>Cargando…</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: N.fondo },
  scroll: { flexGrow: 1 },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28, gap: 16, flexGrow: 1 },
  button: { minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, flexDirection: "row", gap: 9 },
  buttonPrimary: { backgroundColor: N.marca },
  buttonGhost: { backgroundColor: "#fff", borderWidth: 1, borderColor: N.borde },
  buttonDanger: { backgroundColor: N.rojoBoton },
  buttonText: { fontFamily: FI.semi, color: "#fff", fontSize: 15.5 },
  buttonGhostText: { color: N.marca },
  pressed: { opacity: 0.75 },
  empty: { flex: 1, minHeight: 220, alignItems: "center", justifyContent: "center", gap: 8, padding: 28 },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: N.suave, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  emptyTitle: { fontFamily: FI.semi, fontSize: 18, lineHeight: 24, color: N.tinta, textAlign: "center" },
  emptyText: { fontFamily: FI.reg, fontSize: 14, lineHeight: 21, color: N.apagado, textAlign: "center", maxWidth: 300 },
});
