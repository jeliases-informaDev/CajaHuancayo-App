// Estado del celular que acompaña a cada posición que se envía durante la jornada: el supervisor distingue «no se mueve» de
// «se quedó sin batería». Nunca falla: si el celular no lo informa (algunos navegadores), simplemente no se envía.
import * as Battery from "expo-battery";

export async function estadoBateria(): Promise<{ bateria?: number; cargando?: boolean }> {
  try {
    const [nivel, estado] = await Promise.all([Battery.getBatteryLevelAsync(), Battery.getBatteryStateAsync()]);
    if (!(nivel >= 0)) return {}; // -1 = el dispositivo no lo informa
    return { bateria: Math.round(nivel * 100), cargando: estado === Battery.BatteryState.CHARGING || estado === Battery.BatteryState.FULL };
  } catch {
    return {};
  }
}
