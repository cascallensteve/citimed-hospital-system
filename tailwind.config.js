// Tailwind v3 config (single source of truth)
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#1E40AF',
          dark: '#1E3A8A',
          light: '#3B82F6',
        },
        secondary: {
          DEFAULT: '#DC2626',
          dark: '#B91C1C',
          light: '#EF4444',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};
