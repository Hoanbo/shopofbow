/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // BOW brand palette — cyan / blue / white
        brand: {
          50: '#ecfeff',
          100: '#cff9fe',
          200: '#a5f0fc',
          300: '#67e3f9',
          400: '#22ccee',
          500: '#06b6d4', // primary cyan
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
          950: '#083344',
        },
        ink: {
          DEFAULT: '#0b2b36',
          soft: '#33555f',
          muted: '#6b8791',
        },
      },
      fontFamily: {
        sans: ['Be Vietnam Pro', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '1.25rem',
        pill: '999px',
      },
      boxShadow: {
        card: '0 8px 30px -12px rgba(6, 182, 212, 0.28)',
        soft: '0 4px 20px -8px rgba(11, 43, 54, 0.15)',
        hero: '0 20px 60px -20px rgba(8, 145, 178, 0.45)',
        nav: '0 -6px 24px -12px rgba(11, 43, 54, 0.18)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #06b6d4 0%, #0891b2 45%, #0e7490 100%)',
        'hero-gradient': 'linear-gradient(120deg, #22ccee 0%, #06b6d4 40%, #0e7490 100%)',
        'sky-soft': 'linear-gradient(180deg, #ecfeff 0%, #ffffff 100%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
