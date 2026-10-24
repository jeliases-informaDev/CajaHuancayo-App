import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { FI, N } from "../theme";
import { BaseCard, ReadRow } from "./controls";
import type { Plantilla } from "./types";

// Visor de los datos de la base (solo lectura). Vive en una ventana aparte para que no se
// confunda con lo que el auditor debe verificar y registrar en cada paso de la ficha.

const num = (v: any) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? "-" : Number(v).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const fecha = (v: any) => {
  const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v || "-";
};

export type TabRef = "cliente" | "credito" | "negocio" | "evaluacion" | "deuda";

function Cliente({ e }: { e: any }) {
  const c = e.datos_cliente || {};
  return (
    <BaseCard title="Cliente">
      <ReadRow label="Nombres" value={e.nombres_cliente} />
      <ReadRow label="Documento" value={`${e.tipo_documento_cliente || "DNI"} ${e.numero_documento_cliente}`} />
      <ReadRow label="Nacimiento / edad" value={`${fecha(c.fecha_nacimiento)} · ${c.edad ?? "-"} años`} />
      <ReadRow label="Estado civil" value={c.estado_civil} />
      <ReadRow label="Teléfono" value={[c.telefono_fijo, c.telefono_celular].filter(Boolean).join(" · ") || e.telefono_cliente} />
      <ReadRow label="Dirección" value={e.direccion_domicilio} />
      <ReadRow label="Distrito / provincia" value={`${e.distrito || "-"} / ${e.provincia || "-"}`} />
      <ReadRow label="Referencia" value={c.referencia_domicilio} />
      <ReadRow label="Tipo de vivienda" value={c.tipo_vivienda} />
      <ReadRow label="N.º de suministro" value={c.numero_suministro} />
      <ReadRow label="Tipo de cliente" value={c.tipo_cliente} />
      <ReadRow label="Sexo" value={c.sexo} />
      <ReadRow label="Zona" value={c.zona} />
      <ReadRow label="Oficina / agencia" value={e.oficina} />
      <ReadRow label="Fuente" value={c.fuente} />
      <ReadRow label="Código de cliente" value={c.codigo_cliente} />
      <ReadRow label="Expediente (core)" value={c.codigo_expediente_core} />
    </BaseCard>
  );
}

// Códigos internos del core (moneda, tipo, producto, pagaré, oficina…): la base los trae y aquí se ven todos, compactos.
const CODIGOS: [string, string][] = [["moneda", "Mon."], ["tipo_credito", "Tipo"], ["producto", "Prod."], ["subproducto", "Subprod."], ["pagare", "Pagaré"], ["normal_refinanciado", "N/R"], ["estado_contable", "Est. cont."], ["modalidad", "Modal."], ["plazo", "Plazo"], ["oficina", "Ofic."]];
function codigosCore(cr: any, cliente: any) {
  const c = cr.codigos || {}; const cc = cliente.codigos || {};
  const items = CODIGOS.filter(([k]) => c[k]).map(([k, etiqueta]) => `${etiqueta} ${c[k]}`);
  if (cc.sexo) items.push(`Sexo ${cc.sexo}`);
  if (cc.estado_civil) items.push(`Est. civil ${cc.estado_civil}`);
  return items.length ? items.join(" · ") : undefined;
}

function Credito({ e }: { e: any }) {
  const cr = e.datos_credito || {};
  const apr = cr.nivel_aprobador || {};
  const h: any[] = cr.historial || [];
  return (
    <>
      <BaseCard title="Crédito y participantes">
        <ReadRow label="N.º de crédito" value={cr.numero_credito || e.codigo_expediente} />
        <ReadRow label="Producto / subproducto" value={[cr.producto, cr.subproducto].filter(Boolean).join(" / ")} />
        <ReadRow label="Tipo / modalidad" value={[cr.tipo_credito_desc, cr.modalidad].filter(Boolean).join(" · ")} />
        <ReadRow label="Línea / solicitud" value={[cr.linea_credito, cr.solicitud].filter(Boolean).join(" / ")} />
        <ReadRow label="Desembolso" value={`${e.moneda === "USD" ? "US$" : "S/"} ${num(e.monto_desembolso)} · ${fecha(cr.fecha_desembolso)}`} />
        {e.moneda === "USD" ? <ReadRow label="Desembolso en soles / T.C." value={`S/ ${num(cr.monto_desembolsado_soles)} · ${num(cr.tipo_cambio)}`} /> : null}
        <ReadRow label="Saldo de capital" value={num(cr.saldo_capital) + (e.moneda === "USD" && cr.saldo_capital_soles != null ? ` (S/ ${num(cr.saldo_capital_soles)})` : "")} />
        <ReadRow label="Días de gracia" value={cr.dias_gracia} />
        <ReadRow label="Cuota" value={`${num(cr.monto_cuota)} · ${cr.plazo_cuotas ?? "-"} cuotas`} />
        <ReadRow label="Destino" value={cr.destino} />
        <ReadRow label="Estado / condición" value={`${cr.estado || "-"} / ${cr.condicion_contable || "-"}`} />
        <ReadRow label="Vencimiento" value={fecha(cr.fecha_vencimiento)} />
        <ReadRow label="Último pago" value={fecha(cr.fecha_ultimo_pago)} />
        <ReadRow label="Días de atraso" value={cr.dias_atraso} />
        <ReadRow label="Calificación SBS / entidades" value={`${cr.calificacion_sbs || "-"} · ${cr.numero_entidades ?? "-"}`} />
        <ReadRow label="Asesor responsable" value={[cr.asesor_actual || e.asesor_responsable, cr.usuario_asesor_actual].filter(Boolean).join(" · ")} />
        <ReadRow label="Asesor de la solicitud" value={[cr.asesor_solicitud, cr.usuario_asesor_solicitud].filter(Boolean).join(" · ")} />
        <ReadRow label="Nivel aprobador" value={[apr.nombre, apr.cargo, apr.usuario].filter(Boolean).join(" - ")} />
        <ReadRow label="Cónyuge" value={cr.conyuge && cr.marca_conyuge && cr.marca_conyuge !== "NOCONYU" ? `${cr.conyuge} (${cr.marca_conyuge})` : cr.conyuge} />
        <ReadRow label="Aval / rep. legal" value={`${cr.aval || "-"} / ${cr.rep_legal || "-"}`} />
        <ReadRow label="Códigos del core" value={codigosCore(cr, e.datos_cliente || {})} />
      </BaseCard>
      <BaseCard title="Historial crediticio">
        {h.length ? h.map((x, i) => (
          <View key={i} style={s.itemBox}>
            <ReadRow label="Línea / tipo" value={`${x.linea || "-"} · ${x.tipo || "-"}`} />
            <ReadRow label="Desembolso" value={`${fecha(x.fecha_desembolso)} · ${x.moneda === "USD" ? "US$" : "S/"} ${num(x.monto)}`} />
            <ReadRow label="Solicitud / N.º de crédito" value={`${x.solicitud || "-"} / ${x.numero_credito || "-"}`} />
            <ReadRow label="Plazo / cuota" value={`${x.plazo_cuotas ?? "-"} cuotas · ${num(x.cuota)}`} />
            <ReadRow label="Condición" value={x.condicion} />
            <ReadRow label="Saldo" value={num(x.saldo)} />
            <ReadRow label="Cuota más atrasada" value={x.cuota_mas_atrasada} />
          </View>
        )) : <Text style={s.vacio}>La base no trae historial.</Text>}
      </BaseCard>
    </>
  );
}

function Negocio({ e }: { e: any }) {
  const n = e.datos_negocio || {};
  const locales: any[] = n.negocios || [];
  return (
    <>
      <BaseCard title="Negocio">
        <ReadRow label="Actividad" value={n.actividad} />
        <ReadRow label="Antigüedad" value={n.antiguedad_meses != null ? `${n.antiguedad_meses} meses` : n.antiguedad_texto} />
        <ReadRow label="Sector económico" value={n.sector_economico} />
      </BaseCard>
      {locales.map((x, i) => (
        <BaseCard key={i} title={`Local ${locales.length > 1 ? i + 1 : ""}`.trim()}>
          <ReadRow label="Dirección" value={x.direccion} />
          <ReadRow label="Distrito / dpto." value={[x.distrito, x.departamento].filter(Boolean).join(" / ")} />
          <ReadRow label="Referencia" value={x.referencia} />
          <ReadRow label="Teléfono" value={x.telefono} />
          <ReadRow label="Contacto" value={x.contacto} />
        </BaseCard>
      ))}
    </>
  );
}

// Encabezado de los comparativos: número y fecha de cada evaluación (reevaluación = la más reciente).
const periodos = (re: any, an: any) => `Reeval. ${re ? [re.numero_evaluacion, fecha(re.fecha)].filter(Boolean).join(" · ") : "—"}   |   Anterior ${an ? [an.numero_evaluacion, fecha(an.fecha)].filter(Boolean).join(" · ") : "—"}`;

function Evaluacion({ e, mype }: { e: any; mype: boolean }) {
  const ev = e.evaluacion_financiera || {};
  const ingresos: any[] = ev.ingresos || [];
  const re = ev.reevaluacion;
  const an = ev.anterior;
  const Fila = ({ etiqueta, bloque, clave }: { etiqueta: string; bloque: "balance" | "resultados"; clave: string }) => (
    <View style={s.cmpRow}>
      <Text style={s.cmpLabel}>{etiqueta}</Text>
      <Text style={s.cmpValue}>{num(re?.[bloque]?.[clave])}</Text>
      <Text style={[s.cmpValue, s.cmpPrev]}>{num(an?.[bloque]?.[clave])}</Text>
    </View>
  );
  return (
    <>
      <BaseCard title={mype ? "Ingresos del negocio" : "Ingresos"}>
        {ingresos.length ? ingresos.map((l, i) => (
          <View key={i} style={s.itemBox}>
            <ReadRow label="Descripción" value={l.descripcion} />
            {mype ? (
              <>
                <ReadRow label="Veces al mes" value={num(l.frecuencia)} />
                <ReadRow label="Días buenos (cant. · días)" value={`${num(l.dias_buenos?.cantidad)} · ${l.dias_buenos?.dias ?? "-"}`} />
                <ReadRow label="Días malos (cant. · días)" value={`${num(l.dias_malos?.cantidad)} · ${l.dias_malos?.dias ?? "-"}`} />
                <ReadRow label="Días estándar (cant. · días)" value={`${num(l.dias_estandar?.cantidad)} · ${l.dias_estandar?.dias ?? "-"}`} />
                <ReadRow label="Precio compra / venta" value={`${num(l.precio_compra)} / ${num(l.precio_venta)}`} />
                <ReadRow label="Total mercaderías" value={num(l.total_mercaderias)} />
                <ReadRow label="Total compras" value={num(l.total_compras)} />
                <ReadRow label="Total ventas" value={num(l.total_ventas)} />
                <ReadRow label="Cant. estándar al cierre" value={num(l.cantidad_estandar_fin)} />
              </>
            ) : (
              <>
                <ReadRow label="Relación" value={l.relacion} />
                <ReadRow label="Monto" value={`${l.moneda || ""} ${l.monto ?? "-"}`} />
                <ReadRow label="Tipo de ingreso" value={l.tipo_ingreso} />
              </>
            )}
          </View>
        )) : <Text style={s.vacio}>La base no trae ingresos.</Text>}
      </BaseCard>
      {mype && (re || an) ? (
        <>
          <BaseCard title="Balance general" hint={periodos(re, an)}>
            <Fila etiqueta="Activo corriente" bloque="balance" clave="activo_corriente" />
            <Fila etiqueta="  Disponibles" bloque="balance" clave="disponibles" />
            <Fila etiqueta="  Cuentas por cobrar" bloque="balance" clave="cuentas_por_cobrar" />
            <Fila etiqueta="  Otras ctas. por cobrar" bloque="balance" clave="otras_cuentas_por_cobrar" />
            <Fila etiqueta="  Adelanto a proveedores" bloque="balance" clave="adelanto_proveedores" />
            <Fila etiqueta="  Existencias" bloque="balance" clave="existencias" />
            <Fila etiqueta="Activo no corriente" bloque="balance" clave="activo_no_corriente" />
            <Fila etiqueta="Total activo" bloque="balance" clave="total_activo" />
            <Fila etiqueta="Pasivo corriente" bloque="balance" clave="pasivo_corriente" />
            <Fila etiqueta="  Proveedores" bloque="balance" clave="proveedores" />
            <Fila etiqueta="  Otras ctas. por pagar" bloque="balance" clave="otras_cuentas_por_pagar" />
            <Fila etiqueta="  Préstamos corto plazo" bloque="balance" clave="prestamos_corto_plazo" />
            <Fila etiqueta="Pasivo no corriente" bloque="balance" clave="pasivo_no_corriente" />
            <Fila etiqueta="  Préstamos largo plazo" bloque="balance" clave="prestamos_largo_plazo" />
            <Fila etiqueta="Total pasivo" bloque="balance" clave="total_pasivo" />
            <Fila etiqueta="Patrimonio" bloque="balance" clave="patrimonio" />
            <Fila etiqueta="Total pasivo + patrimonio" bloque="balance" clave="total_pasivo_patrimonio" />
          </BaseCard>
          <BaseCard title="Estado de resultados" hint={periodos(re, an)}>
            <Fila etiqueta="Ventas netas" bloque="resultados" clave="ventas_netas" />
            <Fila etiqueta="Costo de ventas" bloque="resultados" clave="costo_ventas" />
            <Fila etiqueta="Utilidad bruta" bloque="resultados" clave="utilidad_bruta" />
            <Fila etiqueta="Gastos operativos" bloque="resultados" clave="gastos_operativos" />
            <Fila etiqueta="Utilidad operativa" bloque="resultados" clave="utilidad_operativa" />
            <Fila etiqueta="Obligaciones del negocio" bloque="resultados" clave="obligaciones_negocio" />
            <Fila etiqueta="Utilidad neta" bloque="resultados" clave="utilidad_neta" />
            <Fila etiqueta="Otros ingresos U.E.F." bloque="resultados" clave="otros_ingresos_uef" />
            <Fila etiqueta="Obligaciones U.E.F." bloque="resultados" clave="obligaciones_uef" />
            <Fila etiqueta="Gastos familiares" bloque="resultados" clave="gastos_familiares" />
            <Fila etiqueta="Resultado U.E.F." bloque="resultados" clave="resultado_uef" />
            <Fila etiqueta="Capacidad de pago" bloque="resultados" clave="capacidad_pago" />
            <Fila etiqueta="% del resultado U.E.F." bloque="resultados" clave="porcentaje_capacidad" />
          </BaseCard>
        </>
      ) : null}
    </>
  );
}

function Deuda({ e }: { e: any }) {
  const d = e.endeudamiento || {};
  const bloque = (titulo: string, lista: any[]) => (
    <BaseCard title={titulo} hint={[d.fecha_corte ? `Situación al ${fecha(d.fecha_corte)}` : "", d.numero_entidades != null ? `${d.numero_entidades} entidad(es) reportada(s)` : ""].filter(Boolean).join(" · ") || undefined}>
      {lista.length ? lista.map((x, i) => (
        <View key={i} style={s.itemBox}>
          <ReadRow label="Entidad" value={x.entidad} />
          <ReadRow label="Saldo" value={num(x.saldo)} />
          <ReadRow label="Calificación / tipo" value={`${x.calificacion || "-"} · ${x.tipo_credito || "-"}`} />
        </View>
      )) : <Text style={s.vacio}>Sin deudas en otras entidades.</Text>}
    </BaseCard>
  );
  return (
    <>
      {bloque("Endeudamiento del cliente", d.entidades || [])}
      {(d.entidades_conyuge || []).length ? bloque("Endeudamiento del cónyuge", d.entidades_conyuge) : null}
    </>
  );
}

export default function Referencia({ visible, onClose, expediente, plantilla, inicial = "cliente" }: { visible: boolean; onClose: () => void; expediente: any; plantilla: Plantilla; inicial?: TabRef }) {
  const mype = plantilla === "MYPE_V1";
  const tabs: { id: TabRef; label: string }[] = [
    { id: "cliente", label: "Cliente" }, { id: "credito", label: "Crédito" },
    ...(mype ? [{ id: "negocio" as TabRef, label: "Negocio" }] : []),
    { id: "evaluacion", label: mype ? "Evaluación" : "Ingresos" }, { id: "deuda", label: "Deudas" },
  ];
  const [tab, setTab] = useState<TabRef>(inicial);
  React.useEffect(() => { if (visible) setTab(inicial); }, [visible, inicial]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        <View style={s.head}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Datos de la base</Text>
            <Text style={s.sub} numberOfLines={1}>{expediente.nombres_cliente} · {expediente.codigo_expediente}</Text>
          </View>
          <Pressable onPress={onClose} style={s.close} accessibilityLabel="Cerrar"><MaterialCommunityIcons name="close" size={22} color={N.tinta} /></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsScroll} contentContainerStyle={s.tabsRow}>
          {tabs.map((t) => (
            <Pressable key={t.id} onPress={() => setTab(t.id)} style={[s.tab, tab === t.id && s.tabOn]}>
              <Text style={[s.tabText, tab === t.id && s.tabTextOn]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          {tab === "cliente" ? <Cliente e={expediente} /> : null}
          {tab === "credito" ? <Credito e={expediente} /> : null}
          {tab === "negocio" ? <Negocio e={expediente} /> : null}
          {tab === "evaluacion" ? <Evaluacion e={expediente} mype={mype} /> : null}
          {tab === "deuda" ? <Deuda e={expediente} /> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: N.fondo },
  head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontFamily: FI.bold, fontSize: 22, lineHeight: 28, color: "#000" },
  sub: { fontFamily: FI.reg, fontSize: 13.5, color: N.apagado, marginTop: 2 },
  close: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: N.borde },
  tabsScroll: { flexGrow: 0 },
  tabsRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 10 },
  tab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: N.borde },
  tabOn: { backgroundColor: N.marca, borderColor: N.marca },
  tabText: { fontFamily: FI.med, fontSize: 13.5, color: N.apagado },
  tabTextOn: { fontFamily: FI.semi, color: "#fff" },
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  itemBox: { borderTopWidth: 1, borderTopColor: N.borde2, paddingTop: 6, marginTop: 6 },
  vacio: { fontFamily: FI.reg, fontSize: 13, color: N.apagado },
  cmpRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  cmpLabel: { flex: 1.3, fontFamily: FI.med, fontSize: 12.5, color: N.apagado },
  cmpValue: { flex: 1, fontFamily: FI.semi, fontSize: 13, color: N.tinta, textAlign: "right" },
  cmpPrev: { fontFamily: FI.reg, color: N.apagado },
});
