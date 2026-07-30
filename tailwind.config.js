/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")], // DÒNG NÀY RẤT QUAN TRỌNG
  theme: {
    extend: {},
  },
  plugins: [],
}