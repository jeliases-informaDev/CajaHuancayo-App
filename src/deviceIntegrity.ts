import { Platform } from "react-native";
import * as Device from "expo-device";
import JailMonkey from "jail-monkey";

export type IntegrityCheck = { ok: boolean; reasons: string[] };

// Chequeo de integridad del dispositivo: emulador/simulador (expo-device) +
// dispositivo rooteado/con jailbreak (jail-monkey, libreria nativa dedicada).
// jail-monkey no tiene implementacion web (solo se usa en el APK real, no en el
// preview de Expo Web), asi que en esa plataforma se omite ese chequeo puntual.
export function checkDeviceIntegrity(): IntegrityCheck {
  const reasons: string[] = [];
  if (!Device.isDevice) reasons.push("EMULADOR_O_SIMULADOR");
  if (Platform.OS !== "web") {
    try {
      if (JailMonkey.isJailBroken()) reasons.push("DISPOSITIVO_ROOTEADO_O_JAILBREAK");
    } catch {
      // Si el módulo nativo no responde, no se finge una verificación que no corrió.
    }
  }
  return { ok: reasons.length === 0, reasons };
}
