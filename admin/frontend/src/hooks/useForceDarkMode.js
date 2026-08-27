import { useEffect } from 'react';

const FORCE_DARK_CLASS = 'smartpdm-force-dark';
const DARK_CLASS = 'dark';
const SEMANTIC_DARK_CLASS = 'dark-mode';

export default function useForceDarkMode(enabled) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(FORCE_DARK_CLASS, enabled === true);
    root.classList.toggle(DARK_CLASS, enabled === true);
    root.classList.toggle(SEMANTIC_DARK_CLASS, enabled === true);

    return () => {
      root.classList.remove(FORCE_DARK_CLASS);
      root.classList.remove(DARK_CLASS);
      root.classList.remove(SEMANTIC_DARK_CLASS);
    };
  }, [enabled]);
}
