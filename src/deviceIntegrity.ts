import * as Device from "expo-device";

export type IntegrityCheck = { ok: boolean; reasons: string[] };

// Chequeo de integridad del dispositivo, fase 1: detecta emuladores/simuladores
// mediante expo-device (`isDevice`). La detección de root/jailbreak requiere una
// librería nativa dedicada (p. ej. jail-monkey) — queda como siguiente paso, no
// se finge cobertura que hoy no existe.
export function checkDeviceIntegrity(): IntegrityCheck {
  const reasons: string[] = [];
  if (!Device.isDevice) reasons.push("EMULADOR_O_SIMULADOR");
  return { ok: reasons.length === 0, reasons };
}
