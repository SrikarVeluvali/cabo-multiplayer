'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DECK_THEME_STORAGE_KEY,
  defaultDeckTheme,
  getDeckTheme,
  type DeckTheme,
} from '@/lib/deck-themes';

const DeckContext = createContext<{ theme: DeckTheme; select: (id: string) => void }>({
  theme: getDeckTheme(),
  select: () => {},
});
export function DeckThemeProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState(defaultDeckTheme);
  useEffect(() => {
    try {
      setId(getDeckTheme(localStorage.getItem(DECK_THEME_STORAGE_KEY)).id);
    } catch {
      /* Storage can be disabled; the deck still works. */
    }
    const sync = (event: StorageEvent) => {
      if (event.key === DECK_THEME_STORAGE_KEY || event.key === null)
        setId(getDeckTheme(event.newValue).id);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const select = useCallback((next: string) => {
    const selected = getDeckTheme(next).id;
    setId(selected);
    try {
      localStorage.setItem(DECK_THEME_STORAGE_KEY, selected);
    } catch {
      /* Keep this session's choice. */
    }
  }, []);
  const value = useMemo(() => ({ theme: getDeckTheme(id), select }), [id, select]);
  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>;
}
export const useDeckTheme = () => useContext(DeckContext);
