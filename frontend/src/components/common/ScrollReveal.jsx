import { motion } from 'framer-motion';

/**
 * Wraps children in a Framer Motion whileInView reveal.
 * variant: 'up' | 'fade' | 'left' | 'right'
 */
export default function ScrollReveal({
  children,
  variant = 'up',
  delay = 0,
  duration = 0.55,
  className = '',
  once = true,
}) {
  const variants = {
    up:    { hidden: { opacity: 0, y: 32 },   visible: { opacity: 1, y: 0 } },
    fade:  { hidden: { opacity: 0 },           visible: { opacity: 1 } },
    left:  { hidden: { opacity: 0, x: -32 },  visible: { opacity: 1, x: 0 } },
    right: { hidden: { opacity: 0, x: 32 },   visible: { opacity: 1, x: 0 } },
  };

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: '-60px' }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
      variants={variants[variant] || variants.up}
    >
      {children}
    </motion.div>
  );
}
