import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';

/**
 * BrandLogo — the M.B. JEWELLERS mark used in the site navbar
 * (gold "MB" medallion + "M.B. JEWELLERS" wordmark), shared everywhere a logo appears.
 *
 * size:     'sm' | 'md' | 'lg'
 * showText: hide the wordmark to show the medallion only (e.g. collapsed sidebar)
 * subtitle: optional small gold line under the wordmark (e.g. "Admin Panel")
 * to:       optional link target
 */
const SIZES = {
  sm: { mark: 'w-7 h-7',   mono: 'text-[8px]',  word: 'text-xs',  sub: 'text-[9px]' },
  md: { mark: 'w-9 h-9',   mono: 'text-[10px]', word: 'text-sm',  sub: 'text-[10px]' },
  lg: { mark: 'w-12 h-12', mono: 'text-[13px]', word: 'text-base', sub: 'text-[11px]' },
};

export default function BrandLogo({ size = 'md', showText = true, subtitle, to, className = '' }) {
  const s = SIZES[size] || SIZES.md;
  const content = (
    <span className={`inline-flex items-center gap-2 group ${className}`}>
      <span className={`${s.mark} rounded-full bg-gold-gradient flex items-center justify-center flex-shrink-0 shadow-gold group-hover:shadow-gold-lg transition-shadow duration-300`}>
        <span className={`text-dark-900 font-bold ${s.mono} font-serif tracking-tight leading-none`}>MB</span>
      </span>
      {showText && (
        <span className="min-w-0 text-left leading-none">
          <span className={`block font-jakarta font-bold text-white tracking-widest ${s.word} uppercase whitespace-nowrap`}>
            M.B.<span className="text-gradient-gold"> JEWELLERS</span>
          </span>
          {subtitle && (
            <span className={`block font-jakarta text-gold-500/90 ${s.sub} uppercase tracking-[0.25em] mt-1`}>{subtitle}</span>
          )}
        </span>
      )}
    </span>
  );
  return to ? <Link to={to} aria-label="M.B. Jewellers home" className="inline-flex">{content}</Link> : content;
}

BrandLogo.propTypes = {
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  showText: PropTypes.bool,
  subtitle: PropTypes.string,
  to: PropTypes.string,
  className: PropTypes.string,
};
