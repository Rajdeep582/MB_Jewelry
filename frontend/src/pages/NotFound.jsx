import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function NotFound() {
  useEffect(() => { document.title = '404 — Page Not Found | M&B Jewelry'; }, []);

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center overflow-hidden relative">
      {/* Decorative */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full border border-gold-500/5 animate-spin-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full border border-gold-500/5 animate-spin-slow" style={{ animationDirection: 'reverse' }} />

      <div className="relative z-10 text-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          <p className="text-[120px] md:text-[180px] font-display font-light leading-none text-gradient-gold">
            404
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h1 className="font-display text-3xl md:text-4xl text-white mb-3">Page Not Found</h1>
          <p className="text-dark-400 mb-8 max-w-md mx-auto">
            The page you're looking for seems to have wandered off like a lost gem. 
            Let's get you back to our collection.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/" className="btn-gold">Go to Homepage</Link>
            <Link to="/shop" className="btn-outline-gold">Browse Shop</Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
