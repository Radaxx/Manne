This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npm run lint                # Biome : format + lint + imports (npm run fix pour appliquer)
npx tsc --noEmit            # typecheck
npm test                    # Jest (jest-expo) — tests live in __tests__/*-test.ts
npm run build:android       # release build installed on a plugged-in Android phone (no Metro)
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint, typecheck and tests before declaring any task done.

`npx expo run:android --device <name>` takes the device name from `adb devices -l` (e.g. `Pixel_10`), not its serial. If Gradle reports "SDK location not found", set `ANDROID_HOME=$HOME/Library/Android/sdk` rather than editing `android/`.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- `android/` and `ios/` are gitignored and generated from `app.json`. After changing `app.json`, regenerate them with `npx expo prebuild` before a local native build.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Project conventions

- UI copy is in French, and it must match what the code does — especially privacy claims (what stays on the phone vs. what syncs to Supabase).
- Colors come from the palette: `useThemed(stylesFor)` or `usePalette()` (`src/theme.tsx`). Don't hard-code hex values in screens; add a token to `Palette` in `src/appearance.ts`, with a value for both `DARK` and `LIGHT`.
- Use the shared helpers: `src/dates.ts` (local dates, French month and day names), `src/haptics.ts` (`haptic()`), `PrayerText` from `src/prayers.tsx`, `agoPhrase` and `lastTimeLabel` from `src/today.ts`.
- Progress lives in `src/storage.ts`: change it only through its actions (`useApp()` for state and actions, `useActions()` when a component only acts). A new persisted field must be validated in `prepareStored`, handled in `mergeProgress` (`src/sync.ts`), and covered by a test.
- The confession list never leaves the phone: `cloudState` in `src/sync.ts` strips it before syncing.
- Supabase schema changes go in a new numbered file in `supabase/migrations/`; never edit a migration that has already been applied.
