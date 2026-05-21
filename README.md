# Popcraft POS

Point-of-sale Android tablet app for **Popcraft Arts and Collectibles**, built by [Revlv Solutions](https://revlv.com).

The app runs in landscape on Android tablets and talks to a thermal receipt printer over the local network via raw TCP sockets.

## Tech stack

- **Expo SDK 54** with **Expo Router** (file-based routing under `app/`)
- **Expo Dev Client** — native modules required, so Expo Go will not work
- **React Native 0.81** + **React 19** on the New Architecture
- **TypeScript** in strict mode with `noUncheckedIndexedAccess`
- **NativeWind v4** + **Tailwind CSS** for styling
- **TanStack Query v5** for server state, **Zustand** for client state
- **expo-sqlite** for local catalog cache
- **expo-secure-store** for auth tokens, **AsyncStorage** for non-sensitive prefs
- **react-native-tcp-socket** for thermal printer LAN communication
- **EAS Build** for development / preview / production Android builds

## Project layout

```
app/          Expo Router routes (thin — delegate to src/screens)
src/
  api/        API client and endpoint wrappers
  components/ Reusable UI components
  hooks/      Custom hooks
  lib/        Utilities (formatPeso, validators, etc.)
  print/      PrintAdapter interface + Mock and TCP implementations
  screens/    Screen components imported by app/ routes
  state/      Zustand stores
  types/      Shared TypeScript types
```

Path alias `@/*` resolves to `src/*`.

## Setup

```bash
npm install
```

### Build the dev client (one-time)

This project uses native modules (TCP socket, SQLite, SecureStore), so it cannot run in Expo Go. You must build a custom dev client **once** before the Metro dev server is useful:

```bash
eas build --profile development --platform android
```

Install the resulting APK on the tablet. After that, you can iterate over the air:

```bash
npx expo start --dev-client
```

### Production / preview builds

```bash
eas build --profile preview --platform android      # internal APK
eas build --profile production --platform android   # AAB for Play Store
```

## Notes

- `usesCleartextTraffic: true` is enabled via `expo-build-properties` so the app can reach thermal printers on the local LAN over plain HTTP / raw sockets.
- Orientation is locked to **landscape** in `app.json`.
- Bundle ID / Android package: `ph.revlv.popcraftpos`.
