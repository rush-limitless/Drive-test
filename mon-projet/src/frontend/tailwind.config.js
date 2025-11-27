module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f8ff',
          100: '#e4ecff',
          200: '#cdd9ff',
          300: '#a9c0ff',
          400: '#7b9eff',
          500: '#4d7cff',
          600: '#315de5',
          700: '#2346b2',
          800: '#1b3585',
          900: '#13265c',
        },
      },
      boxShadow: {
        glass: '0 24px 48px rgba(15, 23, 42, 0.18)',
      },
    },
  },
  plugins: [],
};
