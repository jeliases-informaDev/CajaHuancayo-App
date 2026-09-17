import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
// @ts-ignore aes-js no trae tipados propios
import aesjs from "aes-js";

// Cifrado en reposo para la cola de visitas offline (SQLite solo guarda metadatos;
// el contenido sensible -cuestionario, comentarios, firma- se escribe cifrado en un
// archivo privado de la app). La clave AES-256 vive en el llavero del sistema
// (Keychain/Keystore), nunca en texto plano en disco.
const KEY_STORE_KEY = "ch_offline_key_v1";
const NATIVE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

let cachedKey: Uint8Array | null = null;

const NodeBuffer: any = (globalThis as any).Buffer;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return typeof btoa === "function" ? btoa(binary) : NodeBuffer.from(bytes).toString("base64");
}
function base64ToBytes(value: string) {
  const binary = typeof atob === "function" ? atob(value) : NodeBuffer.from(value, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getOrCreateKey(): Promise<Uint8Array> {
  if (cachedKey) return cachedKey;
  const stored = Platform.OS === "web"
    ? globalThis.localStorage?.getItem(KEY_STORE_KEY)
    : await SecureStore.getItemAsync(KEY_STORE_KEY, NATIVE_STORE_OPTIONS);
  if (stored) {
    cachedKey = base64ToBytes(stored);
    return cachedKey;
  }
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const key = new Uint8Array(randomBytes);
  const encoded = bytesToBase64(key);
  if (Platform.OS === "web") globalThis.localStorage?.setItem(KEY_STORE_KEY, encoded);
  else await SecureStore.setItemAsync(KEY_STORE_KEY, encoded, NATIVE_STORE_OPTIONS);
  cachedKey = key;
  return key;
}

// Empaqueta iv(16) + ciphertext + huella de integridad SHA-256(clave || texto plano),
// para detectar si el archivo cifrado fue alterado antes de sincronizar.
export async function encryptJson(value: unknown): Promise<string> {
  const key = await getOrCreateKey();
  const plaintext = aesjs.utils.utf8.toBytes(JSON.stringify(value));
  const iv = await Crypto.getRandomBytesAsync(16);
  const cipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(new Uint8Array(iv)));
  const ciphertext: Uint8Array = cipher.encrypt(plaintext);
  const fingerprint = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    bytesToBase64(key) + aesjs.utils.hex.fromBytes(plaintext),
  );
  const packed = { iv: bytesToBase64(new Uint8Array(iv)), data: bytesToBase64(ciphertext), fp: fingerprint };
  return JSON.stringify(packed);
}

export async function decryptJson<T = any>(packedJson: string): Promise<T> {
  const key = await getOrCreateKey();
  const packed = JSON.parse(packedJson);
  const iv = base64ToBytes(packed.iv);
  const ciphertext = base64ToBytes(packed.data);
  const cipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(iv));
  const plaintext: Uint8Array = cipher.decrypt(ciphertext);
  const fingerprint = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    bytesToBase64(key) + aesjs.utils.hex.fromBytes(plaintext),
  );
  if (fingerprint !== packed.fp) {
    throw new Error("La visita guardada localmente no pasó la verificación de integridad (posible manipulación).");
  }
  return JSON.parse(aesjs.utils.utf8.fromBytes(plaintext));
}
