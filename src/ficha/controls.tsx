import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C } from "../theme";
import type { YesNo } from "./types";

// Dos lenguajes visuales distintos para no mezclar lo que viene de la base con lo que el
// auditor verifica en campo:
//   · BaseCard  → fondo gris azulado, candado, "solo lectura".
//   · CampoCard → fondo blanco, borde de color y la etiqueta "Tú verificas".

export function BaseCard({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <View style={s.baseCard}>
      <View style={s.cardHead}>
        <MaterialCommunityIcons name="lock-outline" size={14} color={C.muted} />
        <Text style={s.baseTitle}>{title}</Text>
        <Text style={s.baseTag}>De la base · solo lectura</Text>
      </View>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

export function CampoCard({ title, children, color = C.success, hint }: { title: string; children: React.ReactNode; color?: string; hint?: string }) {
  return (
    <View style={[s.campoCard, { borderLeftColor: color }]}>
      <View style={s.cardHead}>
        <MaterialCommunityIcons name="pencil-outline" size={14} color={color} />
        <Text style={s.campoTitle}>{title}</Text>
        <Text style={[s.campoTag, { color }]}>Tú verificas</Text>
      </View>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

export function ReadRow({ label, value }: { label: string; value: any }) {
  const texto = value === null || value === undefined || value === "" ? "-" : String(value);
  return (
    <View style={s.readRow}>
      <Text style={s.readLabel}>{label}</Text>
      <Text style={s.readValue}>{texto}</Text>
    </View>
  );
}

export function YesNoRow({ label, value, onChange, required }: { label: string; value: YesNo; onChange: (v: YesNo) => void; required?: boolean }) {
  return (
    <View style={s.qRow}>
      <Text style={s.qLabel}>{label}{required ? <Text style={{ color: C.danger }}> *</Text> : null}</Text>
      <View style={s.qButtons}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: Sí`} onPress={() => onChange(true)} style={[s.qBtn, value === true && s.qBtnYesOn]}>
          <Text style={[s.qBtnText, value === true && s.qBtnTextOn]}>SÍ</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: No`} onPress={() => onChange(false)} style={[s.qBtn, value === false && s.qBtnNoOn]}>
          <Text style={[s.qBtnText, value === false && s.qBtnTextOn]}>NO</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function Chips({ options, value, onChange, color = C.primary }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; color?: string }) {
  return (
    <View style={s.chips}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <Pressable key={o.value} accessibilityRole="button" onPress={() => onChange(o.value)} style={[s.chip, on && { backgroundColor: color, borderColor: color }]}>
            <Text style={[s.chipText, on && { color: "#fff" }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function TextField({ label, value, onChangeText, placeholder, multiline, keyboardType, maxLength, required }: {
  label?: string; value: string; onChangeText: (v: string) => void; placeholder?: string; multiline?: boolean; keyboardType?: any; maxLength?: number; required?: boolean;
}) {
  return (
    <View style={s.field}>
      {label ? <Text style={s.qLabel}>{label}{required ? <Text style={{ color: C.danger }}> *</Text> : null}</Text> : null}
      <TextInput
        style={[s.textInput, multiline && s.textArea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AA5B5"
        multiline={multiline}
        keyboardType={keyboardType}
        maxLength={maxLength}
      />
    </View>
  );
}

export function Callout({ tipo, children }: { tipo: "aviso" | "info" | "ok" | "error"; children: React.ReactNode }) {
  const paleta = { aviso: [C.warningBg, "#6F4300", "alert-outline"], info: [C.infoBg, "#223A82", "information-outline"], ok: [C.successBg, "#0B5A3F", "check-circle-outline"], error: [C.dangerBg, "#8F1B2A", "alert-circle-outline"] }[tipo];
  return (
    <View style={[s.callout, { backgroundColor: paleta[0] }]}>
      <MaterialCommunityIcons name={paleta[2] as any} size={16} color={paleta[1]} />
      <Text style={[s.calloutText, { color: paleta[1] }]}>{children}</Text>
    </View>
  );
}

export const controlStyles = StyleSheet.create({
  hint: { fontSize: 11, color: C.muted, marginBottom: 6 },
});

const s = StyleSheet.create({
  baseCard: { backgroundColor: C.surface2, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, gap: 2 },
  campoCard: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: C.border, borderLeftWidth: 3, padding: 14, gap: 2 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  baseTitle: { flex: 1, fontSize: 13.5, fontWeight: "700", color: C.ink },
  baseTag: { fontSize: 10, fontWeight: "600", color: C.muted },
  campoTitle: { flex: 1, fontSize: 13.5, fontWeight: "700", color: C.ink },
  campoTag: { fontSize: 10, fontWeight: "600" },
  hint: { fontSize: 11, color: C.muted, marginBottom: 6 },
  readRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, gap: 10 },
  readLabel: { fontSize: 12, color: C.muted, fontWeight: "500", flexShrink: 0, maxWidth: "45%" },
  readValue: { fontSize: 12.5, color: C.ink, fontWeight: "600", flex: 1, textAlign: "right" },
  qRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, gap: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  qLabel: { fontSize: 13, color: C.text, flex: 1, fontWeight: "500", lineHeight: 18 },
  qButtons: { flexDirection: "row", gap: 8 },
  qBtn: { width: 52, height: 44, borderRadius: 10, borderWidth: 1, borderColor: C.borderStrong, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  qBtnYesOn: { backgroundColor: C.success, borderColor: C.success },
  qBtnNoOn: { backgroundColor: C.danger, borderColor: C.danger },
  qBtnText: { fontSize: 11.5, fontWeight: "900", color: C.muted },
  qBtnTextOn: { color: "#fff" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: C.borderStrong, backgroundColor: "#fff" },
  chipText: { fontSize: 13, fontWeight: "600", color: C.text2 },
  field: { gap: 6, marginTop: 8 },
  textInput: { minHeight: 46, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 10, paddingHorizontal: 12, fontSize: 13.5, color: C.text, backgroundColor: "#fff" },
  textArea: { minHeight: 84, paddingTop: 10, textAlignVertical: "top" },
  callout: { flexDirection: "row", gap: 8, padding: 11, borderRadius: 10, alignItems: "flex-start" },
  calloutText: { flex: 1, fontSize: 12.5, fontWeight: "500", lineHeight: 18 },
});
