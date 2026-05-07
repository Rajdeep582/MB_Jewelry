import { useEffect } from 'react';

/**
 * Lightweight Lenis-style smooth scroller.
 * Intercepts wheel events, applies lerp (linear interpolation) to scrollY.
 * Skips nested scrollable elements so dropdowns/modals work fine.
 */
export default function useSmoothScroll({ lerp = 0.09, multiplier = 1.0 } = {}) {
  useEffect(() => {
    let current = window.scrollY;
    let target  = window.scrollY;
    let rafId   = null;
    let ticking = false;

    function clamp(val) {
      return Math.max(0, Math.min(val, document.documentElement.scrollHeight - window.innerHeight));
    }

    // Check if element or ancestor is independently scrollable (not the page)
    function isScrollable(el) {
      let node = el;
      while (node && node !== document.documentElement) {
        if (node === document.body) break;
        const style = window.getComputedStyle(node);
        const ov = style.overflow + style.overflowY;
        if ((ov.includes('scroll') || ov.includes('auto')) && node.scrollHeight > node.clientHeight + 1) {
          return true;
        }
        node = node.parentElement;
      }
      return false;
    }

    function tick() {
      const diff = target - current;
      if (Math.abs(diff) < 0.1) {
        current = target;
        window.scrollTo(0, current);
        ticking = false;
        return;
      }
      current += diff * lerp;
      window.scrollTo(0, current);
      rafId = requestAnimationFrame(tick);
    }

    function onWheel(e) {
      if (isScrollable(e.target)) return; // let nested elements scroll normally
      e.preventDefault();

      target = clamp(target + e.deltaY * multiplier);

      if (!ticking) {
        ticking = true;
        rafId = requestAnimationFrame(tick);
      }
    }

    // Sync current/target on programmatic scroll (React Router navigation)
    function onScroll() {
      if (!ticking) {
        current = window.scrollY;
        target  = window.scrollY;
      }
    }

    window.addEventListener('wheel',  onWheel,  { passive: false });
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('wheel',  onWheel);
      window.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [lerp, multiplier]);
}
