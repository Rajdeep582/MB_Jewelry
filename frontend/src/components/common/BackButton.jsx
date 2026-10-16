import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { FiArrowLeft } from 'react-icons/fi';
import { hasBackButton } from '../../utils/backButtonRoutes';

/**
 * BackButton — a floating back arrow for drill-down pages only (see utils/backButtonRoutes).
 * Sits just under the fixed navbar, tucks away while scrolling down and returns when
 * scrolling up or near the top, so it never sits on top of content while reading.
 * Goes to the previous page inside the site, or home when the page was opened directly.
 */
export default function BackButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);

  // Route changes scroll to the top (ScrollToTop), which brings the button back via onScroll
  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 80) setVisible(true);
      else if (y > lastY.current + 6) setVisible(false);
      else if (y < lastY.current - 6) setVisible(true);
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [location.pathname]);

  if (!hasBackButton(location.pathname)) return null;

  // location.key is 'default' when this page was the first one opened (no in-site history)
  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate('/'));

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          key="back"
          type="button"
          onClick={goBack}
          aria-label="Go back"
          initial={reduce ? false : { opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: -12 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="group fixed z-40 top-[4.375rem] lg:top-[5.75rem] left-3 sm:left-6 lg:left-[max(2rem,calc((100vw-80rem)/2+2rem))] flex items-center justify-center w-10 h-10 rounded-full border border-gold-500/30 bg-dark-900/75 backdrop-blur-md text-gold-400 shadow-[0_6px_24px_-8px_rgba(0,0,0,0.7)] hover:text-gold-300 hover:border-gold-500/60 hover:bg-gold-500/10 active:scale-95 transition-colors"
        >
          <FiArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
