import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiAward, FiHeart, FiGlobe, FiUsers } from 'react-icons/fi';

const stats = [
  { value: '15+', label: 'Years of Excellence' },
  { value: '10K+', label: 'Happy Customers' },
  { value: '500+', label: 'Unique Designs' },
  { value: '4.9★', label: 'Average Rating' },
];

const values = [
  { icon: FiAward, title: 'Craftsmanship', desc: 'Every piece is hand-finished by master artisans with decades of goldsmithing experience.' },
  { icon: FiHeart, title: 'Love For Detail', desc: 'We obsess over every facet, every curve, every shine — because perfection is in the details.' },
  { icon: FiGlobe, title: 'Ethical Sourcing', desc: 'All our diamonds and gemstones are ethically sourced with full traceability.' },
  { icon: FiUsers, title: 'Family Heritage', desc: 'Founded by a family of jewelers, M&B carries forward three generations of artisanal tradition.' },
];

export default function About() {
  useEffect(() => { document.title = 'About Us — M&B Jewelry'; }, []);

  return (
    <div className="min-h-screen pt-20">
      {/* Hero */}
      <section className="relative h-80 md:h-[500px] flex items-center justify-center overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=1400&q=80"
          alt="Jewelry workshop"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-dark-900/70" />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 text-center px-4"
        >
          <p className="section-subtitle mb-3">Our Heritage</p>
          <h1 className="font-display text-4xl md:text-6xl text-white font-light">
            The M&B <span className="text-gradient-gold italic">Story</span>
          </h1>
        </motion.div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-dark-800/30 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map(({ value, label }, i) => (
              <motion.div key={label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <p className="font-display text-4xl md:text-5xl text-gradient-gold font-medium">{value}</p>
                <p className="text-dark-400 text-sm mt-1">{label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="section-subtitle mb-3">Who We Are</p>
            <h2 className="section-title">Crafting Memories Since 2010</h2>
            <div className="gold-divider mt-4" />
          </div>
          <div className="prose prose-invert max-w-none space-y-4 text-dark-300 text-sm md:text-base leading-relaxed">
            <p>
              M&B Jewelry was born from a passion for creating pieces that transcend time. Founded by the 
              Mehta and Bose families — two lineages of master jewelers from Rajasthan and Bengal — 
              we combined our heritages to create something truly unique.
            </p>
            <p>
              Every piece in our collection is crafted with meticulous attention to detail, using only 
              BIS-hallmarked gold, GIA-certified diamonds, and hand-selected gemstones. Our workshop 
              in Mumbai employs over 50 skilled craftspeople who bring our designs to life.
            </p>
            <p>
              Today, M&B serves customers across India and internationally, offering a seamless blend 
              of traditional craftsmanship and contemporary design. Each purchase comes with a 
              certificate of authenticity and a lifetime warranty on craftsmanship.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-dark-800/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="section-subtitle mb-3">What Drives Us</p>
            <h2 className="section-title">Our Values</h2>
            <div className="gold-divider mt-4" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="card p-6 text-center"
              >
                <div className="w-12 h-12 rounded-2xl glass-gold flex items-center justify-center mx-auto mb-4">
                  <Icon size={20} className="text-gold-500" />
                </div>
                <h3 className="font-display text-white text-lg mb-2">{title}</h3>
                <p className="text-dark-400 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="section-title mb-4">Ready to Find Your Perfect Piece?</h2>
          <p className="text-dark-400 mb-8">Explore our curated collection of fine jewelry</p>
          <Link to="/shop" className="btn-gold text-base py-4 px-8 animate-pulse-gold">
            Shop Our Collection
          </Link>
        </div>
      </section>
    </div>
  );
}
