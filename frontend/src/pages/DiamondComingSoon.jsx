import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { GiCutDiamond } from 'react-icons/gi';

export default function DiamondComingSoon() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Diamond Collection — Coming Soon | M.B. JEWELLERS';
  }, []);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen pt-28 pb-20 flex items-center justify-center">
      <div className="max-w-lg mx-auto px-6 text-center">
        {/* Back Button */}
        <div className="absolute top-28 left-4 sm:left-8">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-sm text-dark-400 hover:text-gold-400 transition-colors group cursor-pointer"
            aria-label="Go back to previous page"
          >
            <FiArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform duration-200" />
            <span>Back</span>
          </button>
        </div>

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-14 h-14 rounded-full bg-gold-gradient flex items-center justify-center shadow-gold group-hover:shadow-gold-lg transition-shadow duration-300">
              <span className="text-dark-900 font-bold text-sm font-serif tracking-tight">MB</span>
            </div>
          </Link>
        </div>

        {/* Diamond Icon */}
        <div className="mb-6">
          <div className="w-20 h-20 rounded-3xl glass-gold flex items-center justify-center mx-auto animate-float">
            <GiCutDiamond size={36} className="text-gold-400" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-serif text-white font-normal leading-tight mb-3">
          Diamond Collection
        </h1>
        <p className="text-gradient-gold text-lg md:text-xl font-serif mb-6">
          Coming Soon
        </p>

        {/* Description */}
        <p className="text-dark-400 text-sm md:text-base leading-relaxed max-w-md mx-auto mb-10">
          We are preparing our certified Diamond jewelry collection for you.
          Our Diamond products will be available once the required certifications are in place.
          Stay tuned for an exquisite range of diamond jewelry.
        </p>

        {/* Divider */}
        <div className="gold-divider mb-10" />

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/shop?material=Gold" className="btn-gold text-sm py-3 px-6">
            Explore Gold Collection
          </Link>
          <Link to="/shop?material=Silver" className="btn-outline-gold text-sm py-3 px-6">
            Explore Silver Collection
          </Link>
        </div>
      </div>
    </div>
  );
}
