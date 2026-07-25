/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // BOW brand palette — modern blue / white
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#5aa9fb',
          500: '#3fa9f5', // secondary
          600: '#1677ff', // primary
          700: '#0e5fd6',
          800: '#0d4ea8',
          900: '#0f3f85',
          950: '#0a2a5c',
        },
        ink: {
          DEFAULT: '#1f2937',
          soft: '#4b5563',
          muted: '#6b7280',
        },
        line: '#e8eef6',
      },
      fontFamily: {
        sans: ['Be Vietnam Pro', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '1.25rem', // 20px
        xl2: '1.5rem', // 24px
        card2: '1.75rem', // 28px
        pill: '999px',
      },
      boxShadow: {
        card: '0 10px 30px -14px rgba(22, 119, 255, 0.22)',
        soft: '0 6px 24px -12px rgba(15, 63, 133, 0.12)',
        hero: '0 24px 60px -24px rgba(22, 119, 255, 0.35)',
        nav: '0 -6px 24px -14px rgba(15, 63, 133, 0.12)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #3fa9f5 0%, #1677ff 55%, #0e5fd6 100%)',
        'hero-gradient': 'linear-gradient(125deg, #3fa9f5 0%, #1677ff 55%, #0e5fd6 100%)',
        'sky-soft': 'linear-gradient(180deg, #f6fbff 0%, #ffffff 100%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        'fade-in': 'fade-in 0.6s ease-out both',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
