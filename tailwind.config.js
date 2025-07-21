// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./**/*.liquid",
    "./assets/**/*.js",
    "./sections/**/*.liquid",
    // …adjust to your theme structure
  ],
  safelist: [
    "grid-cols-1","grid-cols-2","grid-cols-3",
    "grid-cols-4","grid-cols-5","grid-cols-6",
    "md:grid-cols-3","md:grid-cols-4","md:grid-cols-5","md:grid-cols-6",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
