import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, money } from "../theme";
import SignaturePad from "../SignaturePad";
import { BaseCard, CampoCard, Callout, Chips, ReadRow, TextField, YesNoRow } from "./controls";
import { ESTADOS_NEGOCIO, EXIGE_FICHA, PROPIEDADES_LOCAL, RESULTADOS, TEMA } from "./config";
import { bloqueosConforme, validarEnvio } from "./validacion";
import type { Conformidad, FichaState, GeoConfig, OtroCliente, OtroIngreso, Plantilla, StepId } from "./types";

type Set = (patch: Partial<FichaState>) => void;

const ORIGEN_UBICACION: Record<string, string> = {
  REFERENCIA: "Coordenadas de la base",
  MANUAL: "Fijada por un supervisor",
  PRIMERA_VISITA: "Tomada en una primera visita",
};

const num = (v: any) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? "-" : Number(v).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

// ---------------------------------------------------------------- 1. Verificación
export function PasoVerificacion({ expediente, plantilla, distanciaM, geo, onVerBase, onNoUbicado }: {
  expediente: any; plantilla: Plantilla; distanciaM: number | null; geo: GeoConfig; onVerBase: () => void; onNoUbicado: () => void;
}) {
  const e = expediente;
  const c = e.datos_cliente || {};
  const cr = e.datos_credito || {};
  const n = e.datos_negocio || {};
  const tieneCoord = e.latitud != null && e.longitud != null && Number.isFinite(Number(e.latitud));
  const telefono = e.telefono_cliente || c.telefono_celular || c.telefono_fijo;
  const direccion = [e.direccion_domicilio, e.distrito, e.provincia].filter(Boolean).join(", ");
  const comoLlegar = () => {
    const destino = tieneCoord ? `${e.latitud},${e.longitud}` : encodeURIComponent(direccion);
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destino}`);
  };
  return (
    <>
      <BaseCard title="Cliente a visitar">
        <Text style={s.cliente}>{e.nombres_cliente}</Text>
        <ReadRow label="Documento" value={`${e.tipo_documento_cliente || "DNI"} ${e.numero_documento_cliente}`} />
        <ReadRow label="Dirección" value={e.direccion_domicilio} />
        <ReadRow label="Distrito / provincia" value={`${e.distrito || "-"} / ${e.provincia || "-"}`} />
        <ReadRow label="Referencia" value={c.referencia_domicilio} />
        {plantilla === "MYPE_V1" ? <ReadRow label="Actividad" value={n.actividad} /> : null}
        <View style={s.actions}>
          <Pressable onPress={comoLlegar} style={s.actionBtn}><MaterialCommunityIcons name="directions" size={16} color={C.primary} /><Text style={s.actionText}>Cómo llegar</Text></Pressable>
          {telefono ? <Pressable onPress={() => Linking.openURL(`tel:${String(telefono).replace(/[^\d+]/g, "")}`)} style={s.actionBtn}><MaterialCommunityIcons name="phone-outline" size={16} color={C.primary} /><Text style={s.actionText}>Llamar</Text></Pressable> : null}
        </View>
      </BaseCard>

      <BaseCard title="Ubicación de referencia">
        {tieneCoord ? (
          <>
            <ReadRow label="Origen" value={ORIGEN_UBICACION[e.ubicacion_origen] || "Coordenadas registradas"} />
            {distanciaM != null ? (
              <View style={[s.dist, { backgroundColor: distanciaM <= geo.radio ? "#EAFBF5" : "#FFF1F2" }]}>
                <MaterialCommunityIcons name={distanciaM <= geo.radio ? "map-marker-check-outline" : "map-marker-alert-outline"} size={18} color={distanciaM <= geo.radio ? C.success : C.danger} />
                <Text style={[s.distText, { color: distanciaM <= geo.radio ? "#0A7A56" : "#B42318" }]}>
                  Estás a {Math.round(distanciaM)} m del domicilio {distanciaM <= geo.radio ? "(dentro del rango)" : `(el máximo es ${geo.radio} m)`}
                </Text>
              </View>
            ) : <Text style={s.mini}>Activa el GPS para ver tu distancia al domicilio.</Text>}
          </>
        ) : (
          <Callout tipo="info">La base no trae coordenadas de este domicilio. Si la visita sale limpia, tu ubicación quedará como referencia (se registra en el historial del expediente).</Callout>
        )}
      </BaseCard>

      <BaseCard title="Resumen del crédito">
        <ReadRow label="Monto desembolsado" value={e.monto_desembolso ? money(e.monto_desembolso) : "-"} />
        <ReadRow label="Saldo de capital" value={cr.saldo_capital != null ? num(cr.saldo_capital) : "-"} />
        <ReadRow label="Estado" value={cr.estado} />
        <ReadRow label="Destino" value={cr.destino} />
        <ReadRow label="Asesor responsable" value={e.asesor_responsable} />
        <Pressable onPress={onVerBase} style={s.linkRow}><MaterialCommunityIcons name="database-eye-outline" size={16} color={C.primary} /><Text style={s.actionText}>Ver todos los datos de la base</Text></Pressable>
      </BaseCard>

      <View style={s.noEncontrado}>
        <Text style={s.noTitle}>¿No encontraste al cliente?</Text>
        <Text style={s.mini}>Registra la visita como «No ubicado»: solo necesitas un comentario y la foto del lugar.</Text>
        <Pressable onPress={onNoUbicado} style={s.noBtn}><MaterialCommunityIcons name="map-marker-remove-outline" size={16} color={C.danger} /><Text style={[s.actionText, { color: C.danger }]}>Registrar como No ubicado</Text></Pressable>
      </View>
    </>
  );
}

// ---------------------------------------------------------------- 2. Negocio (MYPE)
export function PasoNegocio({ s: st, set, expediente, onVerBase }: { s: FichaState; set: Set; expediente: any; onVerBase: () => void }) {
  const n = expediente.datos_negocio || {};
  const locales: any[] = n.negocios || [];
  return (
    <>
      <BaseCard title="Según la base" hint="Compara lo que ves con lo que registró el asesor.">
        <ReadRow label="Actividad" value={n.actividad} />
        <ReadRow label="Antigüedad" value={n.antiguedad_meses != null ? `${n.antiguedad_meses} meses` : n.antiguedad_texto} />
        {locales.map((l, i) => (
          <View key={i} style={s.localBox}>
            <ReadRow label={`Local ${locales.length > 1 ? i + 1 : ""}`.trim()} value={l.direccion} />
            <ReadRow label="Referencia" value={l.referencia} />
          </View>
        ))}
        <Pressable onPress={onVerBase} style={s.linkRow}><MaterialCommunityIcons name="database-eye-outline" size={16} color={C.primary} /><Text style={s.actionText}>Ver más datos de la base</Text></Pressable>
      </BaseCard>

      <CampoCard title="Estado del negocio" color={TEMA.MYPE_V1.color}>
        <Text style={s.label}>¿Cómo encontraste el negocio? <Text style={{ color: C.danger }}>*</Text></Text>
        <Chips options={ESTADOS_NEGOCIO} value={st.estadoNegocio} onChange={(v) => set({ estadoNegocio: v })} color={TEMA.MYPE_V1.color} />
        {st.estadoNegocio && st.estadoNegocio !== "EN_FUNCIONAMIENTO" ? (
          <View style={{ marginTop: 10 }}><Callout tipo="aviso">Un negocio {st.estadoNegocio === "INOPERATIVO" ? "inoperativo" : "de terceros"} no puede registrarse como Conforme: usa Observado y explica el motivo.</Callout></View>
        ) : null}
        <Text style={[s.label, { marginTop: 14 }]}>Propiedad del local <Text style={{ color: C.danger }}>*</Text></Text>
        <Chips options={PROPIEDADES_LOCAL} value={st.propiedadLocal} onChange={(v) => set({ propiedadLocal: v })} color={TEMA.MYPE_V1.color} />
      </CampoCard>

      <CampoCard title="Comentario general del negocio" color={TEMA.MYPE_V1.color}>
        <TextField value={st.comentarioNegocio} onChangeText={(v) => set({ comentarioNegocio: v })} multiline placeholder="Situación observada: stock, movimiento de clientes, instalaciones…" />
      </CampoCard>
    </>
  );
}

// ---------------------------------------------------------------- 3. Evaluación (MYPE)
function BloqueConformidad({ titulo, detalle, valor, onChange }: { titulo: string; detalle: string; valor: Conformidad; onChange: (c: Conformidad) => void }) {
  return (
    <View style={s.confBox}>
      <Text style={s.confTitle}>{titulo}</Text>
      <Text style={s.mini}>{detalle}</Text>
      <View style={s.confBtns}>
        <Pressable onPress={() => onChange({ ...valor, conforme: true })} style={[s.confBtn, valor.conforme === true && { backgroundColor: C.success, borderColor: C.success }]}>
          <MaterialCommunityIcons name="check" size={16} color={valor.conforme === true ? "#fff" : C.muted} /><Text style={[s.confBtnText, valor.conforme === true && { color: "#fff" }]}>Conforme</Text>
        </Pressable>
        <Pressable onPress={() => onChange({ ...valor, conforme: false })} style={[s.confBtn, valor.conforme === false && { backgroundColor: C.warning, borderColor: C.warning }]}>
          <MaterialCommunityIcons name="alert-outline" size={16} color={valor.conforme === false ? "#fff" : C.muted} /><Text style={[s.confBtnText, valor.conforme === false && { color: "#fff" }]}>Observado</Text>
        </Pressable>
      </View>
      {valor.conforme === false ? <TextField value={valor.comentario} onChangeText={(v) => onChange({ ...valor, comentario: v })} placeholder="¿Qué no cuadra con lo que viste? (mín. 5 caracteres)" multiline /> : null}
    </View>
  );
}

export function PasoEvaluacion({ s: st, set, expediente, onVerBase }: { s: FichaState; set: Set; expediente: any; onVerBase: () => void }) {
  const ev = expediente.evaluacion_financiera || {};
  const p = ev.reevaluacion || ev.anterior;
  const ingresos: any[] = ev.ingresos || [];
  const ventas = ingresos.reduce((suma, l) => suma + (Number(l.total_ventas) || 0), 0);
  return (
    <>
      {p ? (
        <BaseCard title="Evaluación del asesor" hint={`${ev.reevaluacion ? "Reevaluación" : "Evaluación"} del ${p.fecha ? p.fecha.split("-").reverse().join("/") : "—"}`}>
          <ReadRow label="Ventas del negocio" value={num(ventas || p.resultados?.ventas_netas)} />
          <ReadRow label="Utilidad neta" value={num(p.resultados?.utilidad_neta)} />
          <ReadRow label="Resultado U.E.F." value={num(p.resultados?.resultado_uef)} />
          <ReadRow label="Capacidad de pago" value={num(p.resultados?.capacidad_pago)} />
          <ReadRow label="Total activo" value={num(p.balance?.total_activo)} />
          <ReadRow label="Patrimonio" value={num(p.balance?.patrimonio)} />
          <Pressable onPress={onVerBase} style={s.linkRow}><MaterialCommunityIcons name="database-eye-outline" size={16} color={C.primary} /><Text style={s.actionText}>Ver balance y estado de resultados completos</Text></Pressable>
        </BaseCard>
      ) : <Callout tipo="aviso">La base no trae evaluación financiera de este crédito. Marca cada bloque según lo que puedas verificar.</Callout>}

      <CampoCard title="Análisis y conformidad" color={TEMA.MYPE_V1.color} hint="Contrasta los números del asesor con lo que ves en el negocio.">
        <BloqueConformidad titulo="Ingresos del negocio" detalle="Ventas, frecuencia y precios son coherentes con el movimiento real." valor={st.conf.ingresos} onChange={(c) => set({ conf: { ...st.conf, ingresos: c } })} />
        <BloqueConformidad titulo="Balance general" detalle="Existencias, activos y deudas coinciden con lo observado." valor={st.conf.balance} onChange={(c) => set({ conf: { ...st.conf, balance: c } })} />
        <BloqueConformidad titulo="Estado de resultados" detalle="Gastos y utilidad son razonables para este negocio." valor={st.conf.resultados} onChange={(c) => set({ conf: { ...st.conf, resultados: c } })} />
      </CampoCard>
    </>
  );
}

// ---------------------------------------------------------------- 4. Cuestionario
export function PasoCuestionario({ s: st, set, plantilla }: { s: FichaState; set: Set; plantilla: Plantilla }) {
  const color = TEMA[plantilla].color;
  return (
    <>
      <CampoCard title="Verificación anti-fraude" color={C.danger} hint="Las 3 preguntas son obligatorias.">
        <YesNoRow required label="¿Alguna vez entregó dinero al asesor por alguna razón?" value={st.entregoDinero} onChange={(v) => set({ entregoDinero: v })} />
        <YesNoRow required label="¿Pagó alguna comisión adicional por el desembolso?" value={st.pagoComision} onChange={(v) => set({ pagoComision: v })} />
        <YesNoRow required label="¿Recibió el total del monto solicitado?" value={st.recibioMontoTotal} onChange={(v) => set({ recibioMontoTotal: v })} />
      </CampoCard>

      <CampoCard title="Crédito y hogar" color={color}>
        <YesNoRow label="¿Cónyuge tiene conocimiento del préstamo?" value={st.conyugeConoce} onChange={(v) => set({ conyugeConoce: v })} />
        <YesNoRow label="¿Tiene créditos paralelos?" value={st.creditosParalelos} onChange={(v) => set({ creditosParalelos: v })} />
        <YesNoRow label="¿Comparte el dinero del crédito con otra persona?" value={st.comparteDinero} onChange={(v) => set({ comparteDinero: v })} />
        {plantilla === "MYPE_V1" ? <YesNoRow label="¿El titular administra el negocio?" value={st.titularAdministra} onChange={(v) => set({ titularAdministra: v })} /> : null}
        <TextField label="¿Dónde realiza sus pagos?" value={st.dondePaga} onChangeText={(v) => set({ dondePaga: v })} placeholder="Agencia, agente, app, etc." />
      </CampoCard>

      <CampoCard title="Microseguro" color={color}>
        <YesNoRow label="¿Tiene microseguro?" value={st.tieneMicroseguro} onChange={(v) => set({ tieneMicroseguro: v, ...(v === false ? { infoMicroseguro: null, conformeMicroseguro: null, comentarioMicroseguro: "" } : {}) })} />
        {st.tieneMicroseguro === true ? (
          <>
            <YesNoRow label="¿Recibió toda la información necesaria antes de comprarlo?" value={st.infoMicroseguro} onChange={(v) => set({ infoMicroseguro: v })} />
            <YesNoRow label="¿Está conforme con el microseguro comprado?" value={st.conformeMicroseguro} onChange={(v) => set({ conformeMicroseguro: v })} />
            <TextField label="Comentario" value={st.comentarioMicroseguro} onChangeText={(v) => set({ comentarioMicroseguro: v })} placeholder="Opcional" />
          </>
        ) : null}
      </CampoCard>
    </>
  );
}

// ---------------------------------------------------------------- 5. Otros datos
export function PasoOtros({ s: st, set, plantilla }: { s: FichaState; set: Set; plantilla: Plantilla }) {
  const color = TEMA[plantilla].color;
  const cambiarCliente = (i: number, patch: Partial<OtroCliente>) => set({ otrosClientes: st.otrosClientes.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const cambiarIngreso = (i: number, patch: Partial<OtroIngreso>) => set({ otrosIngresos: st.otrosIngresos.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <>
      <CampoCard title="Otros clientes que domician en la vivienda" color={color} hint="Solo si hay otras personas con crédito en la misma vivienda.">
        {st.otrosClientes.map((x, i) => (
          <View key={i} style={s.itemBox}>
            <View style={s.itemHead}><Text style={s.itemTitle}>Persona {i + 1}</Text><Pressable onPress={() => set({ otrosClientes: st.otrosClientes.filter((_, j) => j !== i) })} hitSlop={8}><MaterialCommunityIcons name="trash-can-outline" size={18} color={C.danger} /></Pressable></View>
            <TextField label="Nombre" value={x.nombre} onChangeText={(v) => cambiarCliente(i, { nombre: v })} />
            <TextField label="Parentesco" value={x.parentesco} onChangeText={(v) => cambiarCliente(i, { parentesco: v })} />
            <TextField label="Actividad" value={x.actividad} onChangeText={(v) => cambiarCliente(i, { actividad: v })} />
            <TextField label="Antigüedad del negocio" value={x.antiguedad} onChangeText={(v) => cambiarCliente(i, { antiguedad: v })} placeholder="Ej. 2 años" />
          </View>
        ))}
        {st.otrosClientes.length < 5 ? (
          <Pressable onPress={() => set({ otrosClientes: [...st.otrosClientes, { nombre: "", parentesco: "", actividad: "", antiguedad: "" }] })} style={s.addBtn}><MaterialCommunityIcons name="plus-circle-outline" size={18} color={C.primary} /><Text style={s.actionText}>Agregar persona</Text></Pressable>
        ) : null}
      </CampoCard>

      <CampoCard title="Otros pasivos del titular y cónyuge" color={color}>
        <TextField value={st.otrosPasivos} onChangeText={(v) => set({ otrosPasivos: v })} placeholder="Deudas o compromisos que no figuran en la base (opcional)" multiline maxLength={500} />
      </CampoCard>

      <CampoCard title="Otros ingresos (si los tuviera)" color={color} hint="Hasta 3 ingresos adicionales.">
        {st.otrosIngresos.map((x, i) => (
          <View key={i} style={s.itemBox}>
            <View style={s.itemHead}><Text style={s.itemTitle}>Ingreso {i + 1}</Text><Pressable onPress={() => set({ otrosIngresos: st.otrosIngresos.filter((_, j) => j !== i) })} hitSlop={8}><MaterialCommunityIcons name="trash-can-outline" size={18} color={C.danger} /></Pressable></View>
            <TextField label="Origen" value={x.origen} onChangeText={(v) => cambiarIngreso(i, { origen: v })} />
            <TextField label="Monto mensual (S/)" value={x.monto} onChangeText={(v) => cambiarIngreso(i, { monto: v.replace(/[^\d.]/g, "") })} keyboardType="decimal-pad" />
          </View>
        ))}
        {st.otrosIngresos.length < 3 ? (
          <Pressable onPress={() => set({ otrosIngresos: [...st.otrosIngresos, { origen: "", monto: "" }] })} style={s.addBtn}><MaterialCommunityIcons name="plus-circle-outline" size={18} color={C.primary} /><Text style={s.actionText}>Agregar ingreso</Text></Pressable>
        ) : null}
      </CampoCard>
    </>
  );
}

// ---------------------------------------------------------------- 6. Cierre
export function PasoCierre({ s: st, set, plantilla, distanciaM, geo, irA }: { s: FichaState; set: Set; plantilla: Plantilla; distanciaM: number | null; geo: GeoConfig; irA: (id: StepId) => void }) {
  const motivos = bloqueosConforme(st, plantilla, distanciaM, geo.radio);
  const problema = validarEnvio({ ...st, photo: st.photo || "x", signature: st.signature || "x", firmanteDocumento: st.firmanteDocumento || "00000000" }, plantilla, distanciaM, geo.radio);
  const elegir = (valor: string) => {
    if (valor === "CONFORME" && motivos.length) return; // el aviso explica por qué
    set({ resultado: valor });
  };
  return (
    <>
      <CampoCard title="Resultado de la visita" color={TEMA[plantilla].color}>
        <View style={s.resultGrid}>
          {RESULTADOS.map((item) => {
            const bloqueado = item.value === "CONFORME" && motivos.length > 0;
            const on = st.resultado === item.value;
            return (
              <Pressable key={item.value} onPress={() => elegir(item.value)} style={[s.resultChip, on && s.resultChipOn, bloqueado && s.resultChipOff]}>
                <MaterialCommunityIcons name={item.icon as any} size={16} color={on ? "#fff" : bloqueado ? "#C3CCDB" : C.muted} />
                <Text style={[s.resultChipText, on && s.resultChipTextOn, bloqueado && { color: "#C3CCDB" }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {motivos.length ? <View style={{ marginTop: 10 }}><Callout tipo="aviso">No puedes cerrar como Conforme: {motivos.join("; ")}.</Callout></View> : null}
      </CampoCard>

      {plantilla === "CONSUMO_V1" ? (
        <CampoCard title="Comentario general" color={TEMA[plantilla].color}>
          <TextField value={st.comentarioNegocio} onChangeText={(v) => set({ comentarioNegocio: v })} multiline placeholder="Situación observada del cliente" />
        </CampoCard>
      ) : null}

      <CampoCard title="Comentarios finales del auditor" color={TEMA[plantilla].color} hint={st.resultado !== "CONFORME" ? "Obligatorio para este resultado (mínimo 10 caracteres)." : undefined}>
        <TextField value={st.comentarioAuditor} onChangeText={(v) => set({ comentarioAuditor: v })} multiline required={st.resultado !== "CONFORME"} placeholder="Observaciones, incidencias encontradas en la visita" />
      </CampoCard>

      {problema ? (
        <Pressable onPress={() => irA(problema.paso)}>
          <Callout tipo="error">Falta completar: {problema.mensaje} Toca aquí para ir a ese paso.</Callout>
        </Pressable>
      ) : <Callout tipo="ok">La ficha está completa. Falta solo la foto y la firma en el último paso.</Callout>}
    </>
  );
}

// ---------------------------------------------------------------- 7. Evidencias
export function PasoEvidencias({ s: st, set, onFoto, signatureKey }: { s: FichaState; set: Set; onFoto: (slot: 1 | 2) => void; signatureKey: number }) {
  const llegoAlCliente = EXIGE_FICHA.includes(st.resultado);
  return (
    <>
      <CampoCard title="Evidencia fotográfica" color={C.warning} hint="Solo se aceptan fotos tomadas en el momento con la cámara de la app.">
        <View style={s.photoRow}>
          <Pressable onPress={() => onFoto(1)} style={s.photoBox}>
            <MaterialCommunityIcons name={st.photo ? "check-circle" : "camera-plus-outline"} size={28} color={st.photo ? C.success : C.muted} />
            <Text style={s.photoLabel}>{st.photo ? "Foto principal ✓ (toca para repetir)" : "Foto principal *"}</Text>
          </Pressable>
          <Pressable onPress={() => onFoto(2)} style={s.photoBox}>
            <MaterialCommunityIcons name={st.photo2 ? "check-circle" : "camera-plus-outline"} size={28} color={st.photo2 ? C.success : C.muted} />
            <Text style={s.photoLabel}>{st.photo2 ? "Foto adicional ✓" : "Foto adicional (opcional)"}</Text>
          </Pressable>
        </View>
      </CampoCard>

      {llegoAlCliente ? (
        <CampoCard title="Firma del cliente" color={C.warning}>
          <TextField label="Documento de quien firma" required value={st.firmanteDocumento} onChangeText={(v) => set({ firmanteDocumento: v.replace(/\s/g, "") })} maxLength={20} />
          <View style={{ marginTop: 10 }}>
            <SignaturePad key={signatureKey} onChange={(v: string) => set({ signature: v })} />
          </View>
        </CampoCard>
      ) : <Callout tipo="info">Con el resultado «{RESULTADOS.find((r) => r.value === st.resultado)?.label}» no se pide firma del cliente.</Callout>}
    </>
  );
}

const s = StyleSheet.create({
  cliente: { fontSize: 17, fontWeight: "800", color: C.ink, marginBottom: 6 },
  mini: { fontSize: 11, color: C.muted, lineHeight: 15 },
  label: { fontSize: 12.5, fontWeight: "700", color: C.text },
  actions: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#DCE6F7" },
  actionText: { fontSize: 12.5, fontWeight: "800", color: C.primary },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#DCE6F7" },
  dist: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 12, marginTop: 6 },
  distText: { flex: 1, fontSize: 12.5, fontWeight: "800" },
  noEncontrado: { padding: 14, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: "#F3B8BC", gap: 6 },
  noTitle: { fontSize: 13, fontWeight: "900", color: C.text },
  noBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 4 },
  localBox: { borderTopWidth: 1, borderTopColor: "#DCE6F7", marginTop: 6, paddingTop: 4 },
  confBox: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", gap: 4 },
  confTitle: { fontSize: 13, fontWeight: "900", color: C.text },
  confBtns: { flexDirection: "row", gap: 8, marginTop: 6 },
  confBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: "#fff" },
  confBtnText: { fontSize: 12.5, fontWeight: "800", color: C.muted },
  itemBox: { borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 8, marginTop: 8 },
  itemHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemTitle: { fontSize: 12.5, fontWeight: "900", color: C.text },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, alignSelf: "flex-start", paddingVertical: 6 },
  resultGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  resultChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: "#fff" },
  resultChipOn: { backgroundColor: C.primary, borderColor: C.primary },
  resultChipOff: { backgroundColor: "#F8FAFD", borderStyle: "dashed" },
  resultChipText: { fontSize: 12.5, fontWeight: "800", color: C.muted },
  resultChipTextOn: { color: "#fff" },
  photoRow: { flexDirection: "row", gap: 10 },
  photoBox: { flex: 1, minHeight: 96, borderRadius: 14, borderWidth: 1, borderColor: C.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#F9FBFE", padding: 6 },
  photoLabel: { fontSize: 11, fontWeight: "700", color: C.muted, textAlign: "center" },
});
