import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem('callmissed-theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('callmissed-theme', theme);
    } catch {
      // Theme remains available for this page if storage is disabled.
    }
  }, [theme]);

  return { theme, toggleTheme: () => setTheme((value) => (value === 'dark' ? 'light' : 'dark')) };
}
