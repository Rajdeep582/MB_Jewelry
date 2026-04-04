/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          50:  '#fdf8e7',
          100: '#f9eebd',
          200: '#f3da8a',
          300: '#ecc34f',
          400: '#e5ab28',
          500: '#D4AF37', // primary gold
          600: '#C5973B',
          700: '#a87820',
          800: '#8a6018',
          900: '#6b4a12',
        },
        dark: {
          50:  '#f5f5f5',
          100: '#e0e0e0',
          200: '#bdbdbd',
          300: '#9e9e9e',
          400: '#757575',
          500: '#616161',
          600: '#424242',
          700: '#212121',
          800: '#141414',
          900: '#0D0D0D', // primary dark
          950: '#080808',
        },
        cream: {
          50:  '#FDFBF7',
          100: '#F8F3E8',
          200: '#F2E9D5',
          300: '#E8D9BC',
        },
        velvet: {
          400: '#E53E3E',
          500: '#C53030', // base red
          600: '#9B2C2C', // deeper red
          700: '#742A2A', // dark red
          800: '#5C1D1D', // maroon
          900: '#4A1414', // very dark red
          950: '#2A0A0A', // almost black red
        },
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #D4AF37 0%, #F2C94C 50%, #C5973B 100%)',
        'dark-gradient': 'linear-gradient(135deg, #141414 0%, #0D0D0D 100%)',
        'hero-gradient': 'linear-gradient(160deg, #0D0D0D 0%, #1a1508 60%, #0D0D0D 100%)',
        'velvet-gradient': 'radial-gradient(circle at center, #742A2A 0%, #2A0A0A 100%)',
      },
      animation: {
        'fade-in':     'fadeIn 0.5s ease-in-out',
        'slide-up':    'slideUp 0.5s ease-out',
        'slide-down':  'slideDown 0.3s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
        'shimmer':     'shimmer 1.5s infinite',
        'float':       'float 3s ease-in-out infinite',
        'pulse-gold':  'pulseGold 2s ease-in-out infinite',
        'spin-slow':   'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideRight: {
          '0%':   { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-500px 0' },
          '100%': { backgroundPosition: '500px 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(212, 175, 55, 0.4)' },
          '50%':      { boxShadow: '0 0 0 12px rgba(212, 175, 55, 0)' },
        },
      },
      boxShadow: {
        'gold':    '0 4px 24px rgba(212, 175, 55, 0.25)',
        'gold-lg': '0 8px 40px rgba(212, 175, 55, 0.35)',
        'card':    '0 2px 20px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 8px 40px rgba(116, 42, 42, 0.35)', /* velvet glow */
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
      screens: {
        'xs': '475px',
      },
    },
  },
  plugins: [],
}
