import { ReactLenis } from 'lenis/react';
import 'lenis/dist/lenis.css';

export default function SmoothScroller({ children }) {
  return (
    <ReactLenis
      root
      options={{
        // Single mode only — mixing lerp + duration made Lenis ignore duration and feel choppy.
        // Duration + expo-out easing = consistent, premium cinematic glide.
        duration: 1.15,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        syncTouch: true,
        touchMultiplier: 1.6,
        wheelMultiplier: 1,
      }}
    >
      {children}
    </ReactLenis>
  );
}
