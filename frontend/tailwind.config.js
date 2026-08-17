/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef1fb',
          100: '#dce3f7',
          200: '#b9c6ee',
          300: '#8fa4e1',
          400: '#5f7bd0',
          500: '#3d58bd',
          600: '#2e3c8f',
          700: '#273475',
          800: '#1f2a5e',
          900: '#1a234d',
          950: '#12173a',
        },
        prl: {
          navy: '#2e3c8f',
          blue: '#0b74b8',
          green: '#0b6b2d',
          red: '#d71920',
          gold: '#c9a227',
        },
        ink: {
          900: '#0f172a',
          700: '#334155',
          500: '#64748b',
          300: '#cbd5e1',
          200: '#e2e8f0',
          100: '#f1f5f9',
          50: '#f8fafc',
        },
        success: '#16a34a',
        danger: '#dc2626',
        warn: '#d97706',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        pop: '0 10px 25px -5px rgb(15 23 42 / 0.15)',
      },
    },
  },
  plugins: [],
};
