import { Link } from 'react-router-dom';
import { FiInstagram, FiTwitter, FiFacebook, FiMail, FiPhone, FiMapPin } from 'react-icons/fi';
import { useState } from 'react';
import toast from 'react-hot-toast';

const footerLinks = {
  Shop: [
    { label: 'All Jewelry', to: '/shop' },
    { label: 'Rings', to: '/shop?type=Ring' },
    { label: 'Necklaces', to: '/shop?type=Necklace' },
    { label: 'Earrings', to: '/shop?type=Earrings' },
    { label: 'Bracelets', to: '/shop?type=Bracelet' },
  ],
  Company: [
    { label: 'About Us', to: '/about' },
    { label: 'Contact', to: '/contact' },
    { label: 'Custom Jewelry', to: '/custom-order' },
    { label: 'Terms & Conditions', to: '/terms' },
    { label: 'Privacy Policy', to: '/privacy-policy' },
  ],
  Materials: [
    { label: 'Gold Jewelry', to: '/shop?material=Gold' },
    { label: 'Silver Jewelry', to: '/shop?material=Silver' },
    { label: 'Diamond Jewelry', to: '/diamond-coming-soon' },
  ],
};

export default function Footer() {
  const [email, setEmail] = useState('');

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email) return;
    toast.success('Thank you for subscribing! 💎');
    setEmail('');
  };

  return (
    <footer className="bg-dark-950 border-t border-white/5">
      {/* Newsletter Banner */}
      <div className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="section-subtitle mb-2">Exclusive Offers</p>
              <h3 className="text-2xl md:text-3xl font-display text-white">
                Join the <span className="text-gradient-gold">Inner Circle</span>
              </h3>
              <p className="text-dark-400 mt-1 text-sm">Get 10% off your first order + new arrivals</p>
            </div>
            <form id="newsletter-form" onSubmit={handleSubscribe} className="flex gap-3 w-full md:w-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="input-dark flex-1 md:w-72"
                required
              />
              <button type="submit" className="btn-gold whitespace-nowrap">Subscribe</button>
            </form>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">

          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-5 group">
              <div className="w-9 h-9 rounded-full bg-gold-gradient flex items-center justify-center shadow-gold group-hover:shadow-gold-lg transition-shadow duration-300">
                <span className="text-dark-900 font-bold text-[10px] font-serif tracking-tight">MB</span>
              </div>
              <span className="font-jakarta font-bold text-white tracking-widest text-sm uppercase">
                M.B.<span className="text-gradient-gold"> JEWELLERS</span>
              </span>
            </Link>
            <p className="text-dark-400 text-sm leading-relaxed max-w-xs">
              Crafting timeless luxury jewelry since 2010. Every piece tells a story of elegance, 
              craftsmanship, and heritage passed down through generations.
            </p>

            {/* Contact Info */}
            <div className="mt-6 space-y-2.5">
              <div className="flex items-center gap-2.5 text-dark-400 text-sm">
                <FiMail size={14} className="text-gold-500 flex-shrink-0" />
                <a href="mailto:mbjewellers2021@gmail.com" className="hover:text-gold-400 transition-colors">mbjewellers2021@gmail.com</a>
              </div>
              <div className="flex items-center gap-2.5 text-dark-400 text-sm">
                <FiPhone size={14} className="text-gold-500 flex-shrink-0" />
                <a href="tel:09830424257" className="hover:text-gold-400 transition-colors">09830424257</a>
              </div>
              <div className="flex items-start gap-2.5 text-dark-400 text-sm">
                <FiMapPin size={14} className="text-gold-500 flex-shrink-0 mt-0.5" />
                <span>BOYS&apos; HIGH SCHOOL, 217/3, Netaji Subhash Bose Rd, beside NEW BARRACKPORE, New Barrackpur, West Bengal 700131</span>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex gap-3 mt-6">
              {[
                { Icon: FiInstagram, label: 'Instagram', href: '#' },
                { Icon: FiTwitter, label: 'Twitter', href: '#' },
                { Icon: FiFacebook, label: 'Facebook', href: '#' },
              ].map((item) => {
                 
                const SIcon = item.Icon;
                return (
                <a
                  key={item.label}
                  href={item.href}
                  aria-label={item.label}
                  className="w-9 h-9 rounded-full bg-dark-800 border border-white/10 flex items-center justify-center text-dark-400 hover:text-gold-500 hover:border-gold-500/30 transition-all duration-200"
                >
                  <SIcon size={15} />
                </a>
              )})}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-white uppercase tracking-widest mb-4">{title}</h4>
              <ul className="space-y-2.5">
                {links.map(({ label, to }) => (
                  <li key={label}>
                    <Link
                      to={to}
                      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                      className="text-dark-400 hover:text-gold-400 text-sm transition-colors duration-200"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs text-dark-500">
            <span>© {new Date().getFullYear()} M.B. JEWELLERS. All rights reserved.</span>
            <Link to="/terms" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-gold-400 transition-colors">
              Terms & Conditions
            </Link>
            <Link to="/privacy-policy" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-gold-400 transition-colors">
              Privacy Policy
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-dark-500 text-xs">Secure payments by</span>
            <div className="flex items-center gap-2">
              <div className="badge badge-gold text-xs">Razorpay</div>
              <div className="badge bg-dark-800 text-dark-300 border border-white/10 text-xs">SSL Secured</div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
