import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { setDeviceIdHeader } from "./api";

const DEVICE_ID_KEY = "ch_device_id_v1";
const NATIVE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

let cached: string | null = null;

// Identificador estable por instalación (no por hardware): se genera una sola vez
// y se guarda cifrado en el llavero del sistema. El backend lo usa para vincular la
// cuenta a un único dispositivo activo (ver auth.service.js -> enforceDeviceBinding).
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  const existing = Platform.OS === "web"
    ? globalThis.localStorage?.getItem(DEVICE_ID_KEY)
    : await SecureStore.getItemAsync(DEVICE_ID_KEY, NATIVE_STORE_OPTIONS);
  if (existing) {
    cached = existing;
    setDeviceIdHeader(existing);
    return existing;
  }
  const generated = Crypto.randomUUID();
  if (Platform.OS === "web") globalThis.localStorage?.setItem(DEVICE_ID_KEY, generated);
  else await SecureStore.setItemAsync(DEVICE_ID_KEY, generated, NATIVE_STORE_OPTIONS);
  cached = generated;
  setDeviceIdHeader(generated);
  return generated;
}
