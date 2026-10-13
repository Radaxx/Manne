import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { Palette } from './appearance';

/** Barre de statut de l'écran au premier plan. Absente sinon, pour laisser celle de l'app. */
export function FocusedStatusBar({ style }: { style: 'light' | 'dark' }) {
  const focused = useIsFocused();
  if (!focused) return null;
  return <StatusBar style={style} />;
}

const PaletteContext = createContext<Palette | null>(null);

export function PaletteProvider({ value, children }: { value: Palette; children: ReactNode }) {
  return <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>;
}

export function usePalette(): Palette {
  const palette = useContext(PaletteContext);
  if (!palette) throw new Error('usePalette doit être utilisé dans <PaletteProvider>');
  return palette;
}

/** Styles recalculés quand la palette change. `factory` doit être stable (déclarée hors du composant). */
export function useThemed<T>(factory: (c: Palette) => T): { C: Palette; styles: T } {
  const C = usePalette();
  const styles = useMemo(() => factory(C), [C, factory]);
  return { C, styles };
}
