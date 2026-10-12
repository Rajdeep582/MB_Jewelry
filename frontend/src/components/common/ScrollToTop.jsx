import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLenis } from 'lenis/react';

export default function ScrollToTop() {
  const { pathname, search } = useLocation();
  const lenis = useLenis();

  useEffect(() => {
    // Jump via Lenis when present so its internal target resets too; a bare window.scrollTo
    // during an in-flight Lenis animation gets overridden on the next frame (jumpy navigation).
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
    else window.scrollTo(0, 0);
  }, [pathname, search, lenis]);

  return null;
}
