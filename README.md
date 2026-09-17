# Auditoría de Visitas — Caja Huancayo (App móvil)

Aplicación React Native/Expo para supervisores y auditores de campo. Proyecto
nuevo e independiente de `App-Afaccop`, construido reusando su mismo stack,
tema visual y componentes.

## Configuración

1. Copie `.env.example` a `.env`.
2. Emulador Android: `EXPO_PUBLIC_API_URL=http://10.0.2.2:4100`.
3. Teléfono físico: reemplace `10.0.2.2` por la IP LAN del equipo que ejecuta el backend.
4. Inicie el backend (`caja-huancayo-auditoria-backend`, puerto 4100) y luego ejecute `npm start`.

## Usuarios de prueba

Ver el README del backend (`scripts/seed-test-data.js`): usuarios
`auditor1.test` / `auditor2.test` / `auditor3.test` / `supervisor.test`,
contraseña `CajaHuancayo2026!`.

## Seguridad implementada

- Token JWT en `expo-secure-store`; sesión offline cifrada válida hasta 8 h.
- **Vínculo a un solo dispositivo**: cada cuenta de campo solo puede usarse desde
  un dispositivo autorizado a la vez (ver `src/deviceIdentity.ts`).
- **Detección de ubicación simulada (Fake GPS)**: se lee el flag `mocked` de
  `expo-location` (Android) en cada visita; si es `true`, el backend rechaza el
  registro (`src/useAuditorLocation.ts`).
- **Detección básica de emulador**: `expo-device` (`src/deviceIntegrity.ts`).
  La detección de root/jailbreak requiere una librería nativa dedicada
  (p. ej. `jail-monkey`) — queda pendiente para una siguiente iteración.
- **Cola offline cifrada**: las visitas pendientes de sincronizar se guardan
  cifradas con AES-256 (clave en el llavero del sistema) más una huella de
  integridad que detecta manipulación antes de sincronizar
  (`src/offlineCrypto.ts`, `src/offlineSync.ts`).
- Cámara integrada obligatoria (no se permite adjuntar fotos de la galería).

## APK

El proyecto incluye `eas.json`. Para una compilación APK de prueba:

```powershell
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

Este proyecto necesita su **propio** `projectId` de EAS (no reutiliza el de
Afacop): ejecute `npx eas-cli init` la primera vez.

La compilación local requiere JDK 17 y Android SDK.

## Pendiente / fuera de alcance de esta fase

Diseño básico (mismos íconos/colores de Afacop, sin branding nuevo), sin
publicación en tiendas, sin detección de root/jailbreak todavía.
