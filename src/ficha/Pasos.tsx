import React from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { conMayusculas, FI, money, N, nombreDePersona } from "../theme";
import SignaturePad from "../SignaturePad";
import { BaseCard, BotonClaro, CampoCard, Callout, Chips, ReadRow, TextField, YesNoRow } from "./controls";
import { ESTADOS_NEGOCIO, EXIGE_FICHA, PROPIEDADES_LOCAL, RESULTADOS } from "./config";
import { bloqueosConforme, distanciaTexto, validarEnvio } from "./validacion";
import { abrirRuta, tieneCoordenadas } from "./destino";
import type { Punto } from "./destino";
import type { Conformidad, FichaState, GeoConfig, OtroCliente, OtroIngreso, Plantilla, StepId } from "./types";

type Set = (patch: Partial<FichaState>) => void;

const ORIGEN_UBICACION: Record<string, string> = {
  REFERENCIA: "Coordenadas de la base",
  MANUAL: "Fijada por un supervisor",
  PRIMERA_VISITA: "Tomada en una primera visita",
};

const num = (v: any) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? "-" : Number(v).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const ROJO_ANTIFRAUDE = N.rojoFuerte;

// ---------------------------------------------------------------- 1. Verificación
export function PasoVerificacion({ expediente, plantilla, punto, puntos, onElegir, distanciaM, geo, onVerBase, onNoUbicado, onFoto, ficha, set }: {
  expediente: any; plantilla: Plantilla; punto: Punto; puntos: Punto[]; onElegir: (p: Punto) => void; distanciaM: number | null; geo: GeoConfig; onVerBase: () => void; onNoUbicado: () => void;
  onFoto: (slot: 1 | 2) => void;
  /** Estado de la ficha: en Consumo este paso registra cómo se encontró el negocio o centro de trabajo (la ficha del banco lo pide). */
  ficha?: FichaState; set?: Set;
}) {
  const e = expediente;
  const c = e.datos_cliente || {};
  const cr = e.datos_credito || {};
  const n = e.datos_negocio || {};
  const tieneCoord = tieneCoordenadas(punto);
  const alNegocio = punto.tipo === "NEGOCIO";
  const lugar = alNegocio ? "negocio" : "domicilio";
  const negocio = alNegocio ? (n.negocios || [])[punto.indice] || {} : null;
  const telefono = alNegocio ? negocio.telefono || e.telefono_cliente || c.telefono_celular : e.telefono_cliente || c.telefono_celular || c.telefono_fijo;
  const [faltante, setFaltante] = React.useState("");
  // «No ubicado» se registra aquí mismo: comentario (mínimo 10 caracteres) y foto del lugar; el resto de la ficha no se pide.
  const registrarNoUbicado = () => {
    const comentario = (ficha?.comentarioAuditor || "").trim();
    if (comentario.length < 10) { setFaltante("Escribe un comentario de al menos 10 caracteres sobre lo que encontraste."); return; }
    if (!ficha?.photo) { setFaltante("Toma la foto del lugar."); return; }
    setFaltante("");
    onNoUbicado();
  };
  return (
    <>
      {puntos.length > 1 ? (
        <BaseCard title="¿A qué dirección vas?" hint="Elige a cuál visitas y puedes cambiar en cualquier momento. La distancia y la regla de los 100 m se miden contra la que elijas.">
          <Chips
            options={puntos.map((p) => ({ value: `${p.tipo}:${p.indice}`, label: p.etiqueta }))}
            value={`${punto.tipo}:${punto.indice}`}
            onChange={(v) => { const p = puntos.find((x) => `${x.tipo}:${x.indice}` === v); if (p) onElegir(p); }}
          />
        </BaseCard>
      ) : null}

      <BaseCard title="Información del cliente a visitar">
        <Text style={s.cliente}>{nombreDePersona(e.nombres_cliente)}</Text>
        <Text style={s.codigo}>{[e.codigo_expediente, conMayusculas(e.departamento || e.distrito)].filter(Boolean).join(" · ")}</Text>
        <ReadRow label={e.tipo_documento_cliente || "DNI"} value={e.numero_documento_cliente} />
        {alNegocio ? (
          <>
            <ReadRow label="Dirección del negocio" value={conMayusculas(negocio.direccion)} vacio="No disponible" />
            <ReadRow label="Distrito" value={conMayusculas(negocio.distrito || e.distrito)} vacio="No disponible" />
            <ReadRow label="Referencias" value={negocio.referencia} vacio="No disponibles" />
            <ReadRow label="Contacto en el negocio" value={negocio.contacto} vacio="No disponible" />
          </>
        ) : (
          <>
            <ReadRow label="Dirección" value={conMayusculas(e.direccion_domicilio)} vacio="No disponible" />
            <ReadRow label="Distrito / provincia" value={`${conMayusculas(e.distrito) || "No disponible"} / ${conMayusculas(e.provincia) || "No disponible"}`} />
            <ReadRow label="Referencias" value={c.referencia_domicilio} vacio="No disponibles" />
          </>
        )}
        {plantilla === "MYPE_V1" ? <ReadRow label="Actividad" value={conMayusculas(n.actividad)} /> : null}
        <View style={s.actions}>
          <BotonClaro icono="map-outline" texto="Ubicación" etiqueta="Cómo llegar" onPress={() => abrirRuta(punto)} />
          {telefono ? <BotonClaro icono="phone-outline" texto="Llamar" onPress={() => Linking.openURL(`tel:${String(telefono).replace(/[^\d+]/g, "")}`)} /> : null}
        </View>
      </BaseCard>

      <BaseCard title="Ubicación de referencia">
        {tieneCoord ? (
          <>
            <ReadRow label="Origen" value={ORIGEN_UBICACION[punto.origen || ""] || "Coordenadas registradas"} />
            {distanciaM != null ? (
              <View style={[s.dist, { backgroundColor: distanciaM <= geo.radio ? N.verdeFondo : N.rojoFondo }]}>
                <MaterialCommunityIcons name={distanciaM <= geo.radio ? "map-marker-check-outline" : "map-marker-alert-outline"} size={18} color={distanciaM <= geo.radio ? N.verdeTexto : N.rojoTexto} />
                <Text style={[s.distText, { color: distanciaM <= geo.radio ? N.verdeTexto : N.rojoTexto }]}>
                  Estás a {distanciaTexto(distanciaM)} del {lugar} {distanciaM <= geo.radio ? "(dentro del rango)" : `(el máximo es ${geo.radio} m)`}
                </Text>
              </View>
            ) : <Text style={s.mini}>Activa el GPS para ver tu distancia al {lugar}.</Text>}
          </>
        ) : (
          <Callout tipo="info">La base no trae coordenadas de este {lugar}. Si la visita sale limpia, tu ubicación quedará como referencia (se registra en el historial del expediente).</Callout>
        )}
      </BaseCard>

      {plantilla === "CONSUMO_V1" && ficha && set ? (
        <CampoCard title="Negocio o centro de trabajo" hint="La ficha del banco lo pide también en Consumo. Si no aplica, déjalo sin marcar.">
          <Text style={s.pregunta}>¿Cómo encontraste el negocio o centro de trabajo del cliente?</Text>
          <Chips options={ESTADOS_NEGOCIO} value={ficha.estadoNegocio} onChange={(v) => set({ estadoNegocio: ficha.estadoNegocio === v ? "" : v })} />
        </CampoCard>
      ) : null}

      <BaseCard title="Resumen del crédito">
        <ReadRow label="Monto desembolsado" value={e.monto_desembolso ? money(e.monto_desembolso) : "-"} />
        <ReadRow label="Saldo del capital" value={cr.saldo_capital != null ? num(cr.saldo_capital) : "-"} />
        <ReadRow label="Estado" value={cr.estado} />
        <ReadRow label="Destino" value={cr.destino} />
        <ReadRow label="Asesor responsable" value={nombreDePersona(e.asesor_responsable)} />
        <View style={s.actions}><BotonClaro icono="database-outline" texto="Ver todos los datos de la base" onPress={onVerBase} /></View>
      </BaseCard>

      <View style={s.noEncontrado}>
        <Text style={s.noTitle} accessibilityRole="header">¿No encontraste al cliente?</Text>
        <Text style={s.noTexto}>Registra la visita como no ubicado. Solo necesitas un comentario y la foto del lugar.</Text>
        {ficha && set ? (
          <>
            <TextField label="Comentario" value={ficha.comentarioAuditor} onChangeText={(v) => set({ comentarioAuditor: v })} placeholder="Escribe un comentario breve" />
            <View style={s.field}>
              <Text style={s.noLabel}>Foto del lugar</Text>
              <Pressable onPress={() => onFoto(1)} accessibilityRole="button" style={s.fotoLugar}>
                {ficha.photo ? <Image source={{ uri: ficha.photo }} style={s.fotoMini} /> : <MaterialCommunityIcons name="camera-outline" size={20} color={N.marca} />}
                <Text style={s.fotoLugarTexto}>{ficha.photo ? "Foto principal ✓ (toca para repetir)" : "Agrega una foto del lugar"}</Text>
              </Pressable>
            </View>
          </>
        ) : null}
        {faltante ? <Callout tipo="error">{faltante}</Callout> : null}
        <Pressable onPress={registrarNoUbicado} accessibilityRole="button" style={({ pressed }) => [s.noBtn, pressed && { opacity: 0.85 }]}>
          <Text style={s.noBtnTexto}>Registrar como no ubicado</Text>
        </Pressable>
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
        <ReadRow label="Actividad" value={conMayusculas(n.actividad)} />
        <ReadRow label="Antigüedad" value={n.antiguedad_meses != null ? `${n.antiguedad_meses} meses` : n.antiguedad_texto} />
        {locales.map((l, i) => (
          <View key={i} style={s.localBox}>
            <ReadRow label={`Local ${locales.length > 1 ? i + 1 : ""}`.trim()} value={conMayusculas(l.direccion)} />
            <ReadRow label="Referencia" value={l.referencia} />
          </View>
        ))}
        <View style={s.actions}><BotonClaro icono="database-outline" texto="Ver más datos de la base" onPress={onVerBase} /></View>
      </BaseCard>

      <CampoCard title="Estado del negocio">
        <Text style={s.pregunta}>¿Cómo encontraste el negocio? <Text style={{ color: N.rojo }}>*</Text></Text>
        <Chips options={ESTADOS_NEGOCIO} value={st.estadoNegocio} onChange={(v) => set({ estadoNegocio: v })} />
        {st.estadoNegocio && st.estadoNegocio !== "EN_FUNCIONAMIENTO" ? (
          <Callout tipo="aviso">Un negocio {st.estadoNegocio === "INOPERATIVO" ? "inoperativo" : "de terceros"} no puede registrarse como Conforme: usa Observado y explica el motivo.</Callout>
        ) : null}
        <Text style={[s.pregunta, { marginTop: 8 }]}>Propiedad del local <Text style={{ color: N.rojo }}>*</Text></Text>
        <Chips options={PROPIEDADES_LOCAL} value={st.propiedadLocal} onChange={(v) => set({ propiedadLocal: v })} />
      </CampoCard>

      <CampoCard title="Comentario general del negocio">
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
        <Pressable onPress={() => onChange({ ...valor, conforme: true })} style={[s.confBtn, valor.conforme === true && { backgroundColor: N.verdeTexto, borderColor: N.verdeTexto }]}>
          <MaterialCommunityIcons name="check" size={16} color={valor.conforme === true ? "#fff" : N.apagado} /><Text style={[s.confBtnText, valor.conforme === true && { color: "#fff" }]}>Conforme</Text>
        </Pressable>
        <Pressable onPress={() => onChange({ ...valor, conforme: false })} style={[s.confBtn, valor.conforme === false && { backgroundColor: N.ambar, borderColor: N.ambar }]}>
          <MaterialCommunityIcons name="alert-outline" size={16} color={valor.conforme === false ? "#fff" : N.apagado} /><Text style={[s.confBtnText, valor.conforme === false && { color: "#fff" }]}>Observado</Text>
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
          <View style={s.actions}><BotonClaro icono="database-outline" texto="Ver balance y estado de resultados completos" onPress={onVerBase} /></View>
        </BaseCard>
      ) : <Callout tipo="aviso">La base no trae evaluación financiera de este crédito. Marca cada bloque según lo que puedas verificar.</Callout>}

      <CampoCard title="Análisis y conformidad" hint="Contrasta los números del asesor con lo que ves en el negocio.">
        <BloqueConformidad titulo="Ingresos del negocio" detalle="Ventas, frecuencia y precios son coherentes con el movimiento real." valor={st.conf.ingresos} onChange={(c) => set({ conf: { ...st.conf, ingresos: c } })} />
        <BloqueConformidad titulo="Balance general" detalle="Existencias, activos y deudas coinciden con lo observado." valor={st.conf.balance} onChange={(c) => set({ conf: { ...st.conf, balance: c } })} />
        <BloqueConformidad titulo="Estado de resultados" detalle="Gastos y utilidad son razonables para este negocio." valor={st.conf.resultados} onChange={(c) => set({ conf: { ...st.conf, resultados: c } })} />
      </CampoCard>
    </>
  );
}

// ---------------------------------------------------------------- 4. Cuestionario
export function PasoCuestionario({ s: st, set }: { s: FichaState; set: Set; plantilla: Plantilla }) {
  return (
    <>
      <CampoCard title="Verificación Anti-fraude" acento={ROJO_ANTIFRAUDE} hint="Las 3 preguntas son obligatorias">
        <YesNoRow required label="¿Alguna vez entregó dinero al asesor por alguna razón?" value={st.entregoDinero} onChange={(v) => set({ entregoDinero: v })} />
        <YesNoRow required label="¿Pagó alguna comisión adicional por el desembolso?" value={st.pagoComision} onChange={(v) => set({ pagoComision: v })} />
        <YesNoRow required label="¿Recibió el total del monto solicitado?" value={st.recibioMontoTotal} onChange={(v) => set({ recibioMontoTotal: v })} />
      </CampoCard>

      <CampoCard title="Crédito y Hogar" acento={N.marino}>
        <YesNoRow label="¿Cónyuge tiene conocimiento del préstamo?" value={st.conyugeConoce} onChange={(v) => set({ conyugeConoce: v })} />
        <YesNoRow label="¿Tiene créditos paralelos?" value={st.creditosParalelos} onChange={(v) => set({ creditosParalelos: v })} />
        <YesNoRow label="¿Comparte el dinero del crédito con otra persona?" value={st.comparteDinero} onChange={(v) => set({ comparteDinero: v })} />
        <YesNoRow label="¿El titular administra el negocio?" value={st.titularAdministra} onChange={(v) => set({ titularAdministra: v })} />
        <TextField label="¿Dónde realiza sus pagos?" value={st.dondePaga} onChangeText={(v) => set({ dondePaga: v })} placeholder="Agencia, agente, app, etc." />
      </CampoCard>

      <CampoCard title="Microseguro" acento={N.marino}>
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
export function PasoOtros({ s: st, set }: { s: FichaState; set: Set; plantilla: Plantilla }) {
  const cambiarCliente = (i: number, patch: Partial<OtroCliente>) => set({ otrosClientes: st.otrosClientes.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const cambiarIngreso = (i: number, patch: Partial<OtroIngreso>) => set({ otrosIngresos: st.otrosIngresos.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <>
      <CampoCard title="Otros clientes que viven en la vivienda" acento={N.marino} hint="Solo si hay otras personas con crédito en la misma vivienda">
        {st.otrosClientes.map((x, i) => (
          <View key={i} style={s.itemBox}>
            <View style={s.itemHead}><Text style={s.itemTitle}>Persona {i + 1}</Text><Pressable onPress={() => set({ otrosClientes: st.otrosClientes.filter((_, j) => j !== i) })} hitSlop={8} accessibilityLabel={`Quitar persona ${i + 1}`}><MaterialCommunityIcons name="trash-can-outline" size={18} color={N.rojoTexto} /></Pressable></View>
            <TextField label="Nombre" value={x.nombre} onChangeText={(v) => cambiarCliente(i, { nombre: v })} />
            <TextField label="Parentesco" value={x.parentesco} onChangeText={(v) => cambiarCliente(i, { parentesco: v })} />
            <TextField label="Actividad" value={x.actividad} onChangeText={(v) => cambiarCliente(i, { actividad: v })} />
            <TextField label="Antigüedad del negocio" value={x.antiguedad} onChangeText={(v) => cambiarCliente(i, { antiguedad: v })} placeholder="Ej. 2 años" />
          </View>
        ))}
        {st.otrosClientes.length < 5 ? (
          <Pressable onPress={() => set({ otrosClientes: [...st.otrosClientes, { nombre: "", parentesco: "", actividad: "", antiguedad: "" }] })} style={s.addBtn} accessibilityRole="button"><MaterialCommunityIcons name="plus-circle-outline" size={20} color={N.marca} /><Text style={s.addText}>Agregar persona</Text></Pressable>
        ) : null}
      </CampoCard>

      <CampoCard title="Otros pasivos del titular y cónyuge" acento={N.marino}>
        <TextField value={st.otrosPasivos} onChangeText={(v) => set({ otrosPasivos: v })} placeholder="Deudas o compromisos que no figuran en la base (opcional)" multiline maxLength={500} />
      </CampoCard>

      <CampoCard title="Otros ingresos (si los tuviera)" acento={N.marino} hint="Hasta 3 ingresos adicionales">
        {st.otrosIngresos.map((x, i) => (
          <View key={i} style={s.itemBox}>
            <View style={s.itemHead}><Text style={s.itemTitle}>Ingreso {i + 1}</Text><Pressable onPress={() => set({ otrosIngresos: st.otrosIngresos.filter((_, j) => j !== i) })} hitSlop={8} accessibilityLabel={`Quitar ingreso ${i + 1}`}><MaterialCommunityIcons name="trash-can-outline" size={18} color={N.rojoTexto} /></Pressable></View>
            <TextField label="Origen" value={x.origen} onChangeText={(v) => cambiarIngreso(i, { origen: v })} />
            <TextField label="Monto mensual (S/)" value={x.monto} onChangeText={(v) => cambiarIngreso(i, { monto: v.replace(/[^\d.]/g, "") })} keyboardType="decimal-pad" />
          </View>
        ))}
        {st.otrosIngresos.length < 3 ? (
          <Pressable onPress={() => set({ otrosIngresos: [...st.otrosIngresos, { origen: "", monto: "" }] })} style={s.addBtn} accessibilityRole="button"><MaterialCommunityIcons name="plus-circle-outline" size={20} color={N.marca} /><Text style={s.addText}>Agregar ingreso</Text></Pressable>
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
      <CampoCard title="Resultado de la visita">
        {/* «No ubicado» se registra desde el primer paso, con su propio comentario y foto */}
        <Chips options={RESULTADOS.filter((r) => r.value !== "NO_UBICADO").map((r) => ({ value: r.value, label: r.label }))} value={st.resultado} onChange={elegir} disabled={motivos.length ? ["CONFORME"] : []} />
        {motivos.length ? <Callout tipo="aviso">No puedes cerrar como Conforme: {motivos.join("; ")}.</Callout> : null}
      </CampoCard>

      {plantilla === "CONSUMO_V1" ? (
        <CampoCard title="Comentario general">
          <TextField value={st.comentarioNegocio} onChangeText={(v) => set({ comentarioNegocio: v })} multiline placeholder="Situación observada del cliente" />
        </CampoCard>
      ) : null}

      <CampoCard title="Comentario del auditor" hint={st.resultado !== "CONFORME" ? "Obligatorio para este resultado (mínimo 10 caracteres)." : undefined}>
        <TextField value={st.comentarioAuditor} onChangeText={(v) => set({ comentarioAuditor: v })} multiline required={st.resultado !== "CONFORME"} placeholder="Observaciones e incidencias observadas en la visita" />
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
function FotoTile({ uri, rotulo, hecho, onPress }: { uri: string; rotulo: string; hecho: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={uri ? hecho : rotulo} style={({ pressed }) => [s.photoBox, pressed && { opacity: 0.8 }]}>
      {uri ? <Image source={{ uri }} style={s.photoImg} resizeMode="cover" /> : null}
      {uri ? (
        <View style={s.photoOk}><MaterialCommunityIcons name="check-circle" size={20} color={N.verde} /><Text style={s.photoOkTexto}>{hecho}</Text></View>
      ) : (
        <>
          <MaterialCommunityIcons name="tray-arrow-up" size={26} color={N.apagado} />
          <Text style={s.photoLabel}>{rotulo}</Text>
        </>
      )}
    </Pressable>
  );
}

export function PasoEvidencias({ s: st, set, onFoto, signatureKey }: { s: FichaState; set: Set; onFoto: (slot: 1 | 2) => void; signatureKey: number }) {
  const llegoAlCliente = EXIGE_FICHA.includes(st.resultado);
  return (
    <>
      <CampoCard title="Evidencia fotográfica" hint="Solo se aceptan fotos tomadas en el momento con la cámara de la app">
        <View style={s.photoRow}>
          <FotoTile uri={st.photo} rotulo="Foto principal" hecho="Foto principal ✓" onPress={() => onFoto(1)} />
          <FotoTile uri={st.photo2} rotulo="Foto adicional (opcional)" hecho="Foto adicional ✓" onPress={() => onFoto(2)} />
        </View>
      </CampoCard>

      {llegoAlCliente ? (
        <CampoCard title="Firma del cliente">
          <TextField label="Documento de quien firma" required value={st.firmanteDocumento} onChangeText={(v) => set({ firmanteDocumento: v.replace(/\s/g, "") })} placeholder="DNI" maxLength={20} />
          <View style={{ marginTop: 6 }}>
            <SignaturePad key={signatureKey} onChange={(v: string) => set({ signature: v })} />
          </View>
        </CampoCard>
      ) : <Callout tipo="info">Con el resultado «{RESULTADOS.find((r) => r.value === st.resultado)?.label}» no se pide firma del cliente.</Callout>}
    </>
  );
}

const s = StyleSheet.create({
  cliente: { fontFamily: FI.bold, fontSize: 16, color: N.tinta },
  codigo: { fontFamily: FI.reg, fontSize: 14, color: N.apagado, marginBottom: 4 },
  mini: { fontFamily: FI.reg, fontSize: 12.5, color: N.apagado, lineHeight: 17 },
  pregunta: { fontFamily: FI.reg, fontSize: 14, lineHeight: 20, color: N.apagado },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  dist: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, marginTop: 4 },
  distText: { flex: 1, fontFamily: FI.semi, fontSize: 13 },
  noEncontrado: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: N.ambarBorde, backgroundColor: N.ambarFondo, gap: 8 },
  noTitle: { fontFamily: FI.semi, fontSize: 16, color: N.ambar },
  noTexto: { fontFamily: FI.reg, fontSize: 14, lineHeight: 20, color: N.ambar },
  noLabel: { fontFamily: FI.reg, fontSize: 13.5, color: N.ambar },
  field: { gap: 6, marginTop: 4 },
  fotoLugar: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: N.borde, borderRadius: 10, paddingHorizontal: 14, backgroundColor: "#fff" },
  fotoLugarTexto: { fontFamily: FI.reg, fontSize: 14, color: N.apagado, flex: 1 },
  fotoMini: { width: 32, height: 32, borderRadius: 6 },
  noBtn: { minHeight: 48, borderRadius: 10, backgroundColor: N.rojoBoton, alignItems: "center", justifyContent: "center", marginTop: 6 },
  noBtnTexto: { fontFamily: FI.semi, fontSize: 15, color: "#fff" },
  localBox: { borderTopWidth: 1, borderTopColor: N.borde2, marginTop: 6, paddingTop: 4 },
  confBox: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: N.borde2, gap: 4 },
  confTitle: { fontFamily: FI.semi, fontSize: 14, color: N.tinta },
  confBtns: { flexDirection: "row", gap: 8, marginTop: 6 },
  confBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: N.borde, backgroundColor: "#fff" },
  confBtnText: { fontFamily: FI.semi, fontSize: 13, color: N.apagado },
  itemBox: { borderTopWidth: 1, borderTopColor: N.borde2, paddingTop: 8, marginTop: 8 },
  itemHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemTitle: { fontFamily: FI.semi, fontSize: 13.5, color: N.tinta },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, alignSelf: "flex-start", paddingVertical: 6 },
  addText: { fontFamily: FI.semi, fontSize: 15, color: N.marca },
  photoRow: { flexDirection: "row", gap: 12 },
  photoBox: { flex: 1, minHeight: 130, borderRadius: 20, borderWidth: 1, borderColor: N.borde, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#fff", padding: 10, overflow: "hidden" },
  photoImg: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  photoOk: { position: "absolute", left: 8, right: 8, bottom: 8, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  photoOkTexto: { fontFamily: FI.semi, fontSize: 12, color: N.tinta, flex: 1 },
  photoLabel: { fontFamily: FI.semi, fontSize: 13.5, color: N.tinta, textAlign: "center" },
});
