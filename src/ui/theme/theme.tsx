import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { accentById, DARK, LIGHT, RADIUS, SPACE, TYPE, type AccentDef, type Palette } from './tokens';

export interface Theme {
  scheme: 'light' | 'dark';
  colors: Palette & {
    accent: string;
    onAccent: string;
    /** Accent at low opacity for tinted backgrounds. */
    accentSoft: string;
    accentMuted: string;
  };
  accent: AccentDef;
  space: typeof SPACE;
  radius: typeof RADIUS;
  type: typeof TYPE;
}

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function buildTheme(scheme: 'light' | 'dark', accentId: string): Theme {
  const accent = accentById(accentId);
  const base = scheme === 'dark' ? DARK : LIGHT;
  const accentColor = scheme === 'dark' ? accent.dark : accent.light;
  return {
    scheme,
    accent,
    colors: {
      ...base,
      accent: accentColor,
      onAccent: accent.onAccent,
      accentSoft: withAlpha(accentColor, scheme === 'dark' ? 0.2 : 0.12),
      accentMuted: withAlpha(accentColor, scheme === 'dark' ? 0.35 : 0.24),
    },
    space: SPACE,
    radius: RADIUS,
    type: TYPE,
  };
}

const ThemeContext = createContext<Theme>(buildTheme('light', 'tomato'));

export function ThemeProvider({
  children,
  accent,
  preference = 'system',
}: {
  children: ReactNode;
  accent: string;
  preference?: 'system' | 'light' | 'dark';
}) {
  const system = useColorScheme();
  const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const theme = useMemo(() => buildTheme(scheme, accent), [scheme, accent]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
