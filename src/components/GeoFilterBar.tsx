import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { C } from "../theme";

const TODOS = "TODOS";

export type GeoItem = { departamento?: string | null; provincia?: string | null; distrito?: string | null };
export type GeoFiltro = { departamento: string; provincia: string; distrito: string };

export const GEO_FILTRO_TODOS: GeoFiltro = { departamento: TODOS, provincia: TODOS, distrito: TODOS };

function uniqueSorted(values: (string | null | undefined)[]) {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort();
}

export function matchesGeoFiltro(item: GeoItem, filtro: GeoFiltro) {
  return (
    (filtro.departamento === TODOS || item.departamento === filtro.departamento) &&
    (filtro.provincia === TODOS || item.provincia === filtro.provincia) &&
    (filtro.distrito === TODOS || item.distrito === filtro.distrito)
  );
}

// Filtro geográfico en cascada (Departamento → Provincia → Distrito) para no listar
// de plano decenas de distritos de todo el país como si fueran etiquetas sueltas.
export default function GeoFilterBar({ items, onChange }: { items: GeoItem[]; onChange: (filtro: GeoFiltro) => void }) {
  const [departamento, setDepartamento] = useState(TODOS);
  const [provincia, setProvincia] = useState(TODOS);
  const [distrito, setDistrito] = useState(TODOS);

  const departamentos = useMemo(() => uniqueSorted(items.map((i) => i.departamento)), [items]);
  const enDepartamento = useMemo(
    () => items.filter((i) => departamento === TODOS || i.departamento === departamento),
    [items, departamento]
  );
  const provincias = useMemo(() => uniqueSorted(enDepartamento.map((i) => i.provincia)), [enDepartamento]);
  const enProvincia = useMemo(
    () => enDepartamento.filter((i) => provincia === TODOS || i.provincia === provincia),
    [enDepartamento, provincia]
  );
  const distritos = useMemo(() => uniqueSorted(enProvincia.map((i) => i.distrito)), [enProvincia]);

  useEffect(() => { onChange({ departamento, provincia, distrito }); }, [departamento, provincia, distrito]);

  if (!departamentos.length) return null;

  return (
    <View style={s.row}>
      {departamentos.length > 1 ? (
        <View style={s.field}>
          <Text style={s.label}>Departamento</Text>
          <View style={s.pickerWrap}>
            <Picker
              selectedValue={departamento}
              onValueChange={(v) => { setDepartamento(String(v)); setProvincia(TODOS); setDistrito(TODOS); }}
              style={s.picker}
            >
              <Picker.Item label={`Todos (${items.length})`} value={TODOS} />
              {departamentos.map((d) => (
                <Picker.Item key={d} label={`${d} (${items.filter((i) => i.departamento === d).length})`} value={d} />
              ))}
            </Picker>
          </View>
        </View>
      ) : null}
      {provincias.length > 1 ? (
        <View style={s.field}>
          <Text style={s.label}>Provincia</Text>
          <View style={s.pickerWrap}>
            <Picker
              selectedValue={provincia}
              onValueChange={(v) => { setProvincia(String(v)); setDistrito(TODOS); }}
              style={s.picker}
            >
              <Picker.Item label={`Todas (${enDepartamento.length})`} value={TODOS} />
              {provincias.map((p) => (
                <Picker.Item key={p} label={`${p} (${enDepartamento.filter((i) => i.provincia === p).length})`} value={p} />
              ))}
            </Picker>
          </View>
        </View>
      ) : null}
      {distritos.length > 1 ? (
        <View style={s.field}>
          <Text style={s.label}>Distrito</Text>
          <View style={s.pickerWrap}>
            <Picker selectedValue={distrito} onValueChange={(v) => setDistrito(String(v))} style={s.picker}>
              <Picker.Item label={`Todos (${enProvincia.length})`} value={TODOS} />
              {distritos.map((d) => (
                <Picker.Item key={d} label={`${d} (${enProvincia.filter((i) => i.distrito === d).length})`} value={d} />
              ))}
            </Picker>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  field: { minWidth: 140, flexGrow: 1 },
  label: { fontSize: 9, fontWeight: "800", color: C.muted, textTransform: "uppercase", marginBottom: 3, marginLeft: 2 },
  pickerWrap: { borderWidth: 1, borderColor: C.border, borderRadius: 10, backgroundColor: "#F8FAFD", overflow: "hidden", justifyContent: "center" },
  picker: { height: 46, color: C.text },
});
