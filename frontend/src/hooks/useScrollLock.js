import { useEffect } from 'react';
import { useLenis } from 'lenis/react';

// Shared counter so overlapping overlays (menu + cart, etc.) don't unlock each other.
let locks = 0;

/**
 * Locks page scroll while `locked` is true.
 * Stops Lenis (otherwise wheel/keyboard scroll keeps moving the page behind overlays)
 * and sets overflow:hidden on <html> — the actual scroll container — rather than <body>.
 */
export default function useScrollLock(locked) {
  const lenis = useLenis();

  useEffect(() => {
    if (!locked) return undefined;
    const html = document.documentElement;
    locks += 1;
    if (locks === 1) {
      html.style.overflow = 'hidden';
      lenis?.stop();
    }
    return () => {
      locks = Math.max(0, locks - 1);
      if (locks === 0) {
        html.style.overflow = '';
        lenis?.start();
      }
    };
  }, [locked, lenis]);
}
