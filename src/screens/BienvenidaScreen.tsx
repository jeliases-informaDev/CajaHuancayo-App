import React from "react";
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import Svg, { Path } from "react-native-svg";
import { FI, N } from "../theme";

// Pantalla de bienvenida (Figma «LOGIN APP 2»): arriba la foto del asesor con su cliente dentro de una ventana de ondas; abajo el saludo y «ENTRAR».
// Las ondas están medidas sobre el diseño de 440 de ancho y se dibujan como SVG, así quedan nítidas en cualquier celular.
const ANCHO = 440;
const ALTO_ARTE = 470;
const MANCHA = "M92,0C96.7,1.7 108.7,5.8 120,10C131.3,14.2 146.7,19.0 160,25C173.3,31.0 186.7,38.2 200,46C213.3,53.8 226.7,64.8 240,72C253.3,79.2 266.7,84.7 280,89C293.3,93.3 306.7,96.2 320,98C333.3,99.8 346.7,100.5 360,100C373.3,99.5 386.7,97.3 400,95C413.3,92.7 433.3,87.5 440,86L440,0Z";
const MORADA = "M0,307C10.0,307.5 43.3,307.5 60,310C76.7,312.5 86.7,316.5 100,322C113.3,327.5 130.0,338.5 140,343C150.0,347.5 150.0,345.8 160,349C170.0,352.2 186.7,356.8 200,362C213.3,367.2 226.7,375.2 240,380C253.3,384.8 266.7,388.8 280,391C293.3,393.2 306.7,393.5 320,393C333.3,392.5 346.7,391.0 360,388C373.3,385.0 386.7,381.5 400,375C413.3,368.5 433.3,353.3 440,349L440,436L340,452C333.3,452.2 313.3,453.7 300,453C286.7,452.3 273.3,451.2 260,448C246.7,444.8 233.3,439.8 220,434C206.7,428.2 193.3,420.5 180,413C166.7,405.5 153.3,395.5 140,389C126.7,382.5 113.3,377.5 100,374C86.7,370.5 76.7,368.2 60,368C43.3,367.8 10.0,372.2 0,373Z";
const BLANCA = "M160,349C166.7,351.2 186.7,356.8 200,362C213.3,367.2 226.7,375.2 240,380C253.3,384.8 266.7,388.8 280,391C293.3,393.2 306.7,393.5 320,393C333.3,392.5 346.7,391.0 360,388C373.3,385.0 386.7,381.5 400,375C413.3,368.5 433.3,353.3 440,349L440,436C433.3,437.7 413.3,443.7 400,446C386.7,448.3 373.3,450.0 360,450C346.7,450.0 333.3,448.7 320,446C306.7,443.3 293.3,439.2 280,434C266.7,428.8 253.3,422.5 240,415C226.7,407.5 210.0,396.2 200,389C190.0,381.8 187.5,379.3 180,372C172.5,364.7 159.2,349.5 155,345Z";
// Todo lo que queda por debajo de las ondas es fondo liso: tapa lo que sobre de la foto (cuerpos de las personas).
const CUBIERTA = "M0,373C10.0,372.2 43.3,367.8 60,368C76.7,368.2 86.7,370.5 100,374C113.3,377.5 126.7,382.5 140,389C153.3,395.5 166.7,405.5 180,413C193.3,420.5 206.7,428.2 220,434C233.3,439.8 246.7,444.8 260,448C273.3,451.2 286.7,452.3 300,453C313.3,453.7 333.3,452.2 340,452C350,451.5 355,450.2 360,450C373.3,450.0 386.7,448.3 400,446C413.3,443.7 433.3,437.7 440,436L440,470L0,470Z";

export default function BienvenidaScreen({ onEntrar }: { onEntrar: () => void }) {
  const { width } = useWindowDimensions();
  const ancho = Math.min(width, 560); // en tablet o navegador la composición no se estira
  const k = ancho / ANCHO;
  return (
    <View style={s.pantalla}>
      <StatusBar style="light" />
      <View style={[s.arte, { width: ancho, height: ALTO_ARTE * k }]}>
        {/* ventana de la foto: fondo claro y las dos personas (recorte con transparencia); las ondas la tapan por abajo y por arriba a la derecha */}
        <LinearGradient colors={["#E7EAFA", "#F6F7FD"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: "absolute", left: 0, top: 0, width: ancho, height: 400 * k }} />
        <Image
          source={require("../../assets/bienvenida/equipo.webp")}
          accessibilityLabel="Un asesor de Caja Huancayo con una clienta, revisando la ficha en la tableta"
          resizeMode="contain"
          style={{ position: "absolute", left: 0, top: 112 * k, width: ancho * 0.9, height: ancho * 0.9 * (998 / 1000) }}
        />
        <Svg width={ancho} height={ALTO_ARTE * k} viewBox={`0 0 ${ANCHO} ${ALTO_ARTE}`} preserveAspectRatio="none" style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path d={MANCHA} fill={N.marca} />
          <Path d={MORADA} fill={N.violeta} />
          <Path d={BLANCA} fill="#FFFFFF" />
          <Path d={CUBIERTA} fill="#4954B8" />
        </Svg>
      </View>
      <View style={s.texto}>
        <Text style={s.titulo} accessibilityRole="header">BIENVENIDO</Text>
        <Text style={s.sub}>Inicia sesión para empezar tu jornada</Text>
        <Pressable onPress={onEntrar} accessibilityRole="button" accessibilityLabel="Entrar" style={({ pressed }) => [s.boton, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}>
          <Text style={s.botonTexto}>ENTRAR</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#4954B8", alignItems: "center" },
  arte: { overflow: "hidden" },
  texto: { flex: 1, width: "100%", maxWidth: 440, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingBottom: 56 },
  titulo: { fontFamily: FI.light, fontSize: 35, lineHeight: 44, letterSpacing: 11, color: "#fff", textAlign: "center", paddingLeft: 11 },
  sub: { fontFamily: FI.reg, fontSize: 15, lineHeight: 22, color: "#fff", textAlign: "center", marginTop: 0 },
  boton: { marginTop: 48, alignSelf: "center", maxWidth: 320, width: "100%", height: 50, borderRadius: 25, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#1B2060", shadowOpacity: 0.55, shadowRadius: 0, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  botonTexto: { fontFamily: FI.semi, fontSize: 15, letterSpacing: 3, color: "#524CBC", paddingLeft: 3 },
});
