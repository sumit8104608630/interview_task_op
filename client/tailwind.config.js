/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Modern Luxury Hospitality tokens
        surface: {
          DEFAULT: '#fcf9f4',
          dim: '#dcdad5',
          bright: '#fcf9f4',
          lowest: '#ffffff',
          low: '#f6f3ee',
          container: '#f0ede8',
          high: '#ebe8e3',
          highest: '#e5e2dd',
        },
        'on-surface': {
          DEFAULT: '#1c1c19',
          variant: '#4e453a',
        },
        'inverse-surface': {
          DEFAULT: '#31302d',
          on: '#f3f0eb',
        },
        outline: {
          DEFAULT: '#807569',
          variant: '#d1c5b6',
        },
        primary: {
          DEFAULT: '#775928',
          on: '#ffffff',
          container: '#b08d57', // Champagne Gold
          'on-container': '#3d2700',
          inverse: '#e8c086',
          fixed: '#ffdeae',
          'fixed-dim': '#e8c086',
        },
        secondary: {
          DEFAULT: '#625e55',
          on: '#ffffff',
          container: '#e6dfd3',
          'on-container': '#666259',
        },
        tertiary: {
          DEFAULT: '#496080',
          on: '#ffffff',
          container: '#7d94b7',
          'on-container': '#132c4a',
        },
        error: {
          DEFAULT: '#ba1a1a',
          on: '#ffffff',
          container: '#ffdad6',
          'on-container': '#93000a',
        },
        // Editorial Aliases for rapid, readable layout styling
        champagne: {
          DEFAULT: '#b08d57',
          light: '#c8a873',
          dark: '#94723e',
        },
        ivory: {
          DEFAULT: '#fcf9f4',
          light: '#ffffff',
          dark: '#f0ede8',
        },
        charcoal: {
          DEFAULT: '#1c1c19',
          light: '#252522',
          muted: '#4e453a',
        },
        sand: {
          DEFAULT: '#e8e1d5',
          light: '#f0ede8',
          dark: '#d1c5b6',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        sm: '0.125rem',  // 2px
        DEFAULT: '0.25rem', // 4px (Soft Level 1 geometry)
        md: '0.375rem',  // 6px
        lg: '0.5rem',    // 8px
        xl: '0.75rem',   // 12px
        full: '9999px',
      },
      boxShadow: {
        warm: '0 12px 32px -4px rgba(37, 35, 34, 0.05), 0 4px 12px -2px rgba(37, 35, 34, 0.03)',
        'warm-lg': '0 20px 40px -6px rgba(37, 35, 34, 0.08), 0 8px 16px -4px rgba(37, 35, 34, 0.04)',
      },
      letterSpacing: {
        'luxury': '0.08em',
        'luxury-wide': '0.1em',
      },
    },
  },
  plugins: [],
};
