import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { FI, N } from "../theme";
import type { YesNo } from "./types";

// Controles de la ficha con el diseño del Figma: tarjetas de fondo claro con borde fino, opciones tipo radio y botones Sí / No.
//   · BaseCard  → lo que viene de la base (solo lectura).
//   · CampoCard → lo que el auditor verifica; con `acento` lleva una franja de color a la izquierda (rojo = anti-fraude, azul marino = resto del cuestionario).

export function BaseCard({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle} accessibilityRole="header">{title}</Text>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

export function CampoCard({ title, children, acento, hint }: { title: string; children: React.ReactNode; color?: string; acento?: string; hint?: string }) {
  return (
    <View style={[s.card, acento ? { borderLeftColor: acento, borderLeftWidth: 3 } : null]}>
      <Text style={s.cardTitle} accessibilityRole="header">{title}</Text>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

export function ReadRow({ label, value, vacio = "-" }: { label: string; value: any; vacio?: string }) {
  const texto = value === null || value === undefined || value === "" ? vacio : String(value);
  return (
    <View style={s.readRow}>
      <Text style={s.readLabel}>{label}</Text>
      <Text style={s.readValue}>{texto}</Text>
    </View>
  );
}

export function YesNoRow({ label, value, onChange, required }: { label: string; value: YesNo; onChange: (v: YesNo) => void; required?: boolean }) {
  const boton = (si: boolean, texto: string) => {
    const on = value === si;
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${texto}`} accessibilityState={{ selected: on }} onPress={() => onChange(si)} style={[s.qBtn, on && s.qBtnOn]}>
        <Text style={[s.qBtnText, on && s.qBtnTextOn]}>{texto}</Text>
      </Pressable>
    );
  };
  return (
    <View style={s.qRow}>
      <Text style={s.qLabel}>{label}{required ? <Text style={{ color: N.rojo }}>*</Text> : null}</Text>
      <View style={s.qButtons}>{boton(true, "Sí")}{boton(false, "No")}</View>
    </View>
  );
}

// Sí / No / No aplica (la ficha de Consumo del banco lo ofrece en la pregunta del cónyuge).
export function YesNoNaRow({ label, value, noAplica, onChange }: { label: string; value: YesNo; noAplica: boolean; onChange: (v: YesNo, noAplica: boolean) => void }) {
  const boton = (on: boolean, texto: string, elegir: () => void) => (
    <Pressable key={texto} accessibilityRole="button" accessibilityLabel={`${label}: ${texto}`} accessibilityState={{ selected: on }} onPress={elegir} style={[s.qBtn, on && s.qBtnOn]}>
      <Text style={[s.qBtnText, on && s.qBtnTextOn]}>{texto}</Text>
    </Pressable>
  );
  return (
    <View style={s.qRow}>
      <Text style={s.qLabel}>{label}</Text>
      <View style={s.qButtons}>
        {boton(!noAplica && value === true, "Sí", () => onChange(true, false))}
        {boton(!noAplica && value === false, "No", () => onChange(false, false))}
        {boton(noAplica, "No aplica", () => onChange(null, true))}
      </View>
    </View>
  );
}

// Opciones en filas con círculo (radio): una sola se elige.
export function Chips({ options, value, onChange, disabled }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; color?: string; disabled?: string[] }) {
  return (
    <View style={s.radios}>
      {options.map((o) => {
        const on = value === o.value;
        const off = disabled?.includes(o.value);
        return (
          <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: off }} onPress={() => (off ? null : onChange(o.value))} style={[s.radio, on && s.radioOn, off && s.radioOff]}>
            <View style={[s.radioCirculo, on && s.radioCirculoOn]}>{on ? <View style={s.radioPunto} /> : null}</View>
            <Text style={[s.radioTexto, off && { color: N.hueco }]}>{o.label}</Text>
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
      {label ? <Text style={s.fieldLabel}>{label}{required ? <Text style={{ color: N.rojo }}>*</Text> : null}</Text> : null}
      <TextInput
        style={[s.textInput, multiline && s.textArea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={N.hueco}
        multiline={multiline}
        keyboardType={keyboardType}
        maxLength={maxLength}
        accessibilityLabel={label || placeholder}
      />
    </View>
  );
}

export function Callout({ tipo, children }: { tipo: "aviso" | "info" | "ok" | "error"; children: React.ReactNode }) {
  const paleta = {
    aviso: [N.ambarFondo, N.ambar, "alert-outline"],
    info: [N.suave, N.marino, "information-outline"],
    ok: [N.verdeFondo, N.verdeTexto, "check-circle-outline"],
    error: [N.rojoFondo, N.rojoTexto, "alert-circle-outline"],
  }[tipo];
  return (
    <View style={[s.callout, { backgroundColor: paleta[0] }]}>
      <MaterialCommunityIcons name={paleta[2] as any} size={18} color={paleta[1]} />
      <Text style={[s.calloutText, { color: paleta[1] }]}>{children}</Text>
    </View>
  );
}

// Botón blanco con borde y texto azul (Ubicación, Llamar, Ver todos los datos de la base…).
export function BotonClaro({ icono, texto, onPress, etiqueta }: { icono: any; texto: string; onPress: () => void; etiqueta?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={etiqueta || texto} style={({ pressed }) => [s.botonClaro, pressed && { opacity: 0.7 }]}>
      <MaterialCommunityIcons name={icono} size={20} color={N.marca} />
      <Text style={s.botonClaroTexto}>{texto}</Text>
    </Pressable>
  );
}

export const controlStyles = StyleSheet.create({
  hint: { fontFamily: FI.reg, fontSize: 12.5, color: N.apagado, marginBottom: 6 },
});

const s = StyleSheet.create({
  card: { backgroundColor: N.panel, borderRadius: 12, borderWidth: 1, borderColor: N.borde, padding: 16, gap: 8 },
  cardTitle: { fontFamily: FI.semi, fontSize: 16, lineHeight: 22, color: N.tinta },
  hint: { fontFamily: FI.reg, fontSize: 12.5, lineHeight: 17, color: N.apagado, marginTop: -4 },
  readRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, gap: 12 },
  readLabel: { fontFamily: FI.reg, fontSize: 13.5, color: N.apagado, flexShrink: 0, maxWidth: "45%" },
  readValue: { fontFamily: FI.semi, fontSize: 14, color: N.tinta, flex: 1, textAlign: "right" },
  qRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, gap: 12, borderBottomWidth: 1, borderBottomColor: N.borde2 },
  qLabel: { fontFamily: FI.reg, fontSize: 14, color: N.tinta, flex: 1, lineHeight: 20 },
  qButtons: { flexDirection: "row", gap: 8 },
  qBtn: { width: 40, height: 44, borderRadius: 10, borderWidth: 1, borderColor: N.borde, alignItems: "center", justifyContent: "center", backgroundColor: N.panel },
  qBtnOn: { backgroundColor: N.marca, borderColor: N.marca },
  qBtnText: { fontFamily: FI.med, fontSize: 13.5, color: N.apagado },
  qBtnTextOn: { color: "#fff", fontFamily: FI.semi },
  radios: { gap: 8 },
  radio: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 46, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: N.borde, backgroundColor: "#fff" },
  radioOn: { borderColor: N.marca },
  radioOff: { backgroundColor: N.panel, borderStyle: "dashed" },
  radioCirculo: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: N.apagado, alignItems: "center", justifyContent: "center" },
  radioCirculoOn: { borderColor: N.marca },
  radioPunto: { width: 11, height: 11, borderRadius: 6, backgroundColor: N.marca },
  radioTexto: { fontFamily: FI.med, fontSize: 14.5, color: N.tinta, flex: 1 },
  field: { gap: 6, marginTop: 4 },
  fieldLabel: { fontFamily: FI.reg, fontSize: 13.5, color: N.apagado },
  textInput: { minHeight: 48, borderWidth: 1, borderColor: N.borde, borderRadius: 10, paddingHorizontal: 14, fontFamily: FI.reg, fontSize: 14, color: N.tinta, backgroundColor: "#fff" },
  textArea: { minHeight: 84, paddingTop: 12, textAlignVertical: "top" },
  callout: { flexDirection: "row", gap: 8, padding: 12, borderRadius: 12, alignItems: "flex-start" },
  calloutText: { flex: 1, fontFamily: FI.med, fontSize: 13, lineHeight: 19 },
  botonClaro: { flex: 1, minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: N.borde, backgroundColor: "#fff" },
  botonClaroTexto: { fontFamily: FI.semi, fontSize: 15, color: N.marca },
});
